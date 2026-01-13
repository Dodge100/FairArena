import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

// Constants
const BCRYPT_ROUNDS = ENV.BCRYPT_ROUNDS!;
const ACCESS_TOKEN_EXPIRY = ENV.ACCESS_TOKEN_EXPIRY!;
const REFRESH_TOKEN_EXPIRY_DAYS = ENV.REFRESH_TOKEN_EXPIRY_DAYS!;
const SESSION_PREFIX = ENV.SESSION_PREFIX!;
const USER_SESSIONS_PREFIX = ENV.USER_SESSIONS_PREFIX!;

// Types
export interface TokenPayload {
    userId: string;
    sessionId: string;
    type: 'access' | 'refresh';
}

export interface SessionData {
    userId: string;
    refreshTokenHash: string;
    deviceName?: string;
    deviceType?: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
    isBanned?: boolean;
    banReason?: string;
}

export interface DeviceInfo {
    deviceName?: string;
    deviceType?: string;
    userAgent?: string;
    ipAddress?: string;
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a password using bcrypt with 12 rounds
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number
 */
export function validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// ============================================================================
// TOKEN GENERATION & VERIFICATION
// ============================================================================

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage (using SHA-256)
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate an access token (JWT)
 */
export function generateAccessToken(userId: string, sessionId: string): string {
    const payload: TokenPayload = {
        userId,
        sessionId,
        type: 'access',
    };

    return jwt.sign(payload, ENV.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY as any,
        issuer: 'fairarena',
        audience: 'fairarena-api',
    });
}

/**
 * Generate a refresh token (opaque token, stored hashed in Redis)
 */
export function generateRefreshToken(): string {
    return generateSecureToken(48);
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): TokenPayload {
    try {
        const payload = jwt.verify(token, ENV.JWT_SECRET, {
            issuer: 'fairarena',
            audience: 'fairarena-api',
        }) as JwtPayload & TokenPayload;

        if (payload.type !== 'access') {
            throw new Error('Invalid token type');
        }

        return {
            userId: payload.userId,
            sessionId: payload.sessionId,
            type: payload.type,
        };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw error;
    }
}

// ============================================================================
// SESSION MANAGEMENT (REDIS-BACKED)
// ============================================================================

/**
 * Create a new session
 */
export async function createSession(
    userId: string,
    refreshToken: string,
    deviceInfo: DeviceInfo = {},
    banInfo: { isBanned: boolean; banReason?: string | null } = { isBanned: false },
): Promise<string> {
    const sessionId = generateSecureToken(16);
    const refreshTokenHash = hashToken(refreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const sessionData: SessionData = {
        userId,
        refreshTokenHash,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ipAddress,
        createdAt: now,
        lastActiveAt: now,
        expiresAt,
        isBanned: banInfo.isBanned,
        banReason: banInfo.banReason || undefined,
    };

    // Store session in Redis
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    await redis.setex(
        sessionKey,
        REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
        JSON.stringify(sessionData),
    );

    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    try {
        await redis.sadd(userSessionsKey, sessionId);
    } catch (error: any) {
        if (error.message && error.message.includes('WRONGTYPE')) {
            logger.warn('Recovering from WRONGTYPE error for session set', { userId });
            await redis.del(userSessionsKey);
            await redis.sadd(userSessionsKey, sessionId);
        } else {
            throw error;
        }
    }

    logger.info('Session created', { userId, sessionId, deviceType: deviceInfo.deviceType });

    return sessionId;
}

/**
 * Store session binding hash
 */
export async function storeSessionBinding(sessionId: string, bindingHash: string): Promise<void> {
    const bindingKey = `binding:${sessionId}`;
    await redis.setex(
        bindingKey,
        REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
        bindingHash,
    );
}

/**
 * Verify session binding token
 */
export async function verifySessionBinding(sessionId: string, token: string): Promise<boolean> {
    const bindingKey = `binding:${sessionId}`;
    const storedHash = await redis.get<string>(bindingKey);

    if (!storedHash) return false;

    const tokenHash = hashToken(token);
    return tokenHash === storedHash;
}

/**
 * Update ban status for all user sessions
 * Used to immediately enforce a ban without waiting for session expiry
 */
export async function updateUserBanStatus(
    userId: string,
    isBanned: boolean,
    banReason?: string,
): Promise<void> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    let sessionIds: string[] = [];
    try {
        sessionIds = await redis.smembers(userSessionsKey);
    } catch (error: any) {
        if (error.message && error.message.includes('WRONGTYPE')) {
            logger.warn('Recovering from WRONGTYPE error in ban status update', { userId });
            await redis.del(userSessionsKey);
            sessionIds = [];
        } else {
            throw error;
        }
    }

    for (const sessionId of sessionIds) {
        const session = await getSession(sessionId);
        if (session) {
            session.isBanned = isBanned;
            session.banReason = banReason;

            const sessionKey = `${SESSION_PREFIX}${sessionId}`;
            const ttl = await redis.ttl(sessionKey);

            if (ttl > 0) {
                await redis.setex(sessionKey, ttl, JSON.stringify(session));
            }
        }
    }

    logger.info('User ban status updated in sessions', { userId, isBanned, sessionCount: sessionIds.length });
}

/**
 * Get session data by session ID
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const data = await redis.get(sessionKey);

    if (!data) {
        return null;
    }

    try {
        // Handle both string and object responses (Upstash may return parsed JSON)
        let session: SessionData;
        if (typeof data === 'string') {
            session = JSON.parse(data) as SessionData;
        } else if (typeof data === 'object') {
            session = data as unknown as SessionData;
        } else {
            logger.error('Unexpected session data type', { sessionId, type: typeof data });
            return null;
        }

        // Convert date strings to Date objects
        session.createdAt = new Date(session.createdAt);
        session.lastActiveAt = new Date(session.lastActiveAt);
        session.expiresAt = new Date(session.expiresAt);
        return session;
    } catch (error) {
        logger.error('Failed to parse session data, deleting corrupt session', {
            sessionId,
            dataType: typeof data,
            error: error instanceof Error ? error.message : String(error)
        });
        // Delete corrupt session to clear state
        await redis.del(sessionKey).catch(e => logger.error('Failed to delete corrupt session', { error: e }));
        return null;
    }
}

/**
 * Validate a refresh token against a session
 */
export async function validateRefreshToken(
    sessionId: string,
    refreshToken: string,
): Promise<SessionData | null> {
    const session = await getSession(sessionId);

    if (!session) {
        return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
        await destroySession(sessionId);
        return null;
    }

    // Check if banned
    if (session.isBanned) {
        return session; // Return session so caller can handle ban check
    }

    // Verify refresh token hash
    const tokenHash = hashToken(refreshToken);
    if (tokenHash !== session.refreshTokenHash) {
        logger.warn('Invalid refresh token attempted', { sessionId });
        return null;
    }

    return session;
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
    const session = await getSession(sessionId);

    if (session) {
        session.lastActiveAt = new Date();
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        const ttl = await redis.ttl(sessionKey);

        if (ttl > 0) {
            await redis.setex(sessionKey, ttl, JSON.stringify(session));
        }
    }
}

/**
 * Rotate refresh token (security best practice)
 * For new multi-session format, oldRefreshToken is not passed (binding token is used instead)
 */
export async function rotateRefreshToken(
    sessionId: string,
    oldRefreshToken?: string,
): Promise<{ newRefreshToken: string; accessToken: string } | null> {
    let session: SessionData | null = null;

    if (oldRefreshToken) {
        // Legacy format - validate refresh token
        session = await validateRefreshToken(sessionId, oldRefreshToken);
    } else {
        // New multi-session format - just get the session (binding token already validated)
        session = await getSession(sessionId);
    }

    if (!session) {
        return null; // Invalid session or token
    }

    if (session.isBanned) {
        return null; // Don't rotate tokens for banned users
    }

    // Generate new tokens
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const accessToken = generateAccessToken(session.userId, sessionId);

    // Update session with new refresh token hash
    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActiveAt = new Date();

    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const ttl = await redis.ttl(sessionKey);

    if (ttl > 0) {
        await redis.setex(sessionKey, ttl, JSON.stringify(session));
    }

    logger.info('Refresh token rotated', { sessionId, userId: session.userId });

    return { newRefreshToken, accessToken };
}

/**
 * Destroy a session
 */
export async function destroySession(sessionId: string): Promise<void> {
    const session = await getSession(sessionId);

    if (session) {
        // Remove from user's session list
        const userSessionsKey = `${USER_SESSIONS_PREFIX}${session.userId}`;
        await redis.srem(userSessionsKey, sessionId);
    }

    // Delete session
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    await redis.del(sessionKey);

    // Delete binding
    const bindingKey = `binding:${sessionId}`;
    await redis.del(bindingKey);

    logger.info('Session destroyed', { sessionId });
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(
    userId: string,
): Promise<Array<{ sessionId: string; data: SessionData }>> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    let sessionIds: string[] = [];
    try {
        sessionIds = await redis.smembers(userSessionsKey);
    } catch (error: any) {
        if (error.message && error.message.includes('WRONGTYPE')) {
            logger.warn('Recovering from WRONGTYPE error in getUserSessions', { userId });
            await redis.del(userSessionsKey);
            sessionIds = [];
        } else {
            throw error;
        }
    }

    const sessions: Array<{ sessionId: string; data: SessionData }> = [];

    for (const sessionId of sessionIds) {
        const session = await getSession(sessionId);
        if (session) {
            sessions.push({ sessionId, data: session });
        } else {
            // Clean up stale reference
            await redis.srem(userSessionsKey, sessionId);
        }
    }

    return sessions;
}

/**
 * Destroy all sessions for a user (logout everywhere)
 */
export async function destroyAllUserSessions(userId: string): Promise<number> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    let sessionIds: string[] = [];
    try {
        sessionIds = await redis.smembers(userSessionsKey);
    } catch (error: any) {
        if (error.message && error.message.includes('WRONGTYPE')) {
            logger.warn('Recovering from WRONGTYPE error in destroyAllUserSessions', { userId });
            await redis.del(userSessionsKey);
            sessionIds = [];
        } else {
            throw error;
        }
    }

    for (const sessionId of sessionIds) {
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        await redis.del(sessionKey);
    }

    await redis.del(userSessionsKey);

    logger.info('All user sessions destroyed', { userId, count: sessionIds.length });

    return sessionIds.length;
}

// ============================================================================
// EMAIL VERIFICATION & PASSWORD RESET TOKENS
// ============================================================================

const EMAIL_VERIFICATION_PREFIX = 'email_verify:';
const PASSWORD_RESET_PREFIX = 'password_reset:';
const EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60; // 24 hours
const PASSWORD_RESET_EXPIRY = 60 * 60; // 1 hour

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);

    // Store hash -> userId mapping
    await redis.setex(`${EMAIL_VERIFICATION_PREFIX}${tokenHash}`, EMAIL_VERIFICATION_EXPIRY, userId);

    return token;
}

/**
 * Verify email verification token
 */
export async function verifyEmailVerificationToken(token: string): Promise<string | null> {
    const tokenHash = hashToken(token);
    const userId = await redis.get<string>(`${EMAIL_VERIFICATION_PREFIX}${tokenHash}`);

    if (userId) {
        // Delete token after use (one-time use)
        await redis.del(`${EMAIL_VERIFICATION_PREFIX}${tokenHash}`);
    }

    return userId;
}

/**
 * Create password reset token
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);

    // Store hash -> userId mapping
    await redis.setex(`${PASSWORD_RESET_PREFIX}${tokenHash}`, PASSWORD_RESET_EXPIRY, userId);

    return token;
}

/**
 * Verify password reset token
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
    const tokenHash = hashToken(token);
    const userId = await redis.get<string>(`${PASSWORD_RESET_PREFIX}${tokenHash}`);

    return userId;
}

/**
 * Invalidate password reset token
 */
export async function invalidatePasswordResetToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await redis.del(`${PASSWORD_RESET_PREFIX}${tokenHash}`);
}

// ============================================================================
// BRUTE FORCE PROTECTION
// ============================================================================

const FAILED_LOGIN_PREFIX = 'failed_login:';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(identifier: string): Promise<{
    attempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
}> {
    const key = `${FAILED_LOGIN_PREFIX}${identifier}`;

    // Get current count
    const currentStr = await redis.get<string>(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;
    const newCount = current + 1;

    if (newCount >= MAX_FAILED_ATTEMPTS) {
        // Lock the account
        await redis.setex(key, LOCKOUT_DURATION, newCount.toString());
        logger.warn('Account locked due to failed login attempts', { identifier, attempts: newCount });

        return {
            attempts: newCount,
            isLocked: true,
            lockoutRemaining: LOCKOUT_DURATION,
        };
    }

    // Increment counter with 1 hour expiry
    await redis.setex(key, 3600, newCount.toString());

    return {
        attempts: newCount,
        isLocked: false,
    };
}

/**
 * Check if an identifier is locked
 */
export async function isLockedOut(identifier: string): Promise<{
    locked: boolean;
    remainingSeconds?: number;
}> {
    const key = `${FAILED_LOGIN_PREFIX}${identifier}`;
    const countStr = await redis.get<string>(key);

    if (!countStr) {
        return { locked: false };
    }

    const count = parseInt(countStr, 10);

    if (count >= MAX_FAILED_ATTEMPTS) {
        const ttl = await redis.ttl(key);
        return { locked: true, remainingSeconds: ttl };
    }

    return { locked: false };
}

/**
 * Clear failed login attempts (on successful login)
 */
export async function clearFailedLogins(identifier: string): Promise<void> {
    const key = `${FAILED_LOGIN_PREFIX}${identifier}`;
    await redis.del(key);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract bearer token from request header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

/**
 * Parse user agent to get device info
 */
export function parseUserAgent(userAgent: string | undefined): {
    deviceType: string;
    deviceName: string;
} {
    if (!userAgent) {
        return { deviceType: 'unknown', deviceName: 'Unknown Device' };
    }

    const ua = userAgent.toLowerCase();

    let deviceType = 'desktop';
    let deviceName = 'Desktop Browser';

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        deviceType = 'mobile';
        deviceName = 'Mobile Device';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
        deviceType = 'tablet';
        deviceName = 'Tablet';
    }

    // Try to get browser name
    if (ua.includes('chrome')) {
        deviceName = `Chrome on ${deviceType === 'mobile' ? 'Mobile' : 'Desktop'}`;
    } else if (ua.includes('firefox')) {
        deviceName = `Firefox on ${deviceType === 'mobile' ? 'Mobile' : 'Desktop'}`;
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
        deviceName = `Safari on ${deviceType === 'mobile' ? 'iPhone' : 'Mac'}`;
    } else if (ua.includes('edge')) {
        deviceName = `Edge on ${deviceType === 'mobile' ? 'Mobile' : 'Desktop'}`;
    }

    return { deviceType, deviceName };
}


export interface MultiSessionCookie {
    sessionId: string;
    bindingToken: string;
}

export interface ActiveSessionData {
    sessionId: string;
    bindingToken: string;
    session: SessionData;
}

/**
 * Parse all session cookies from request
 * Returns array of {sessionId, bindingToken} for all `session_*` cookies
 */
export function parseSessionCookies(
    cookies: Record<string, string | undefined>,
): MultiSessionCookie[] {
    const result: MultiSessionCookie[] = [];
    const sessionPrefix = 'session_';

    for (const [key, value] of Object.entries(cookies)) {
        if (key.startsWith(sessionPrefix) && value) {
            const sessionId = key.slice(sessionPrefix.length);
            // Validate sessionId format (should be UUID-like)
            if (sessionId.length >= 20) {
                result.push({
                    sessionId,
                    bindingToken: value,
                });
            }
        }
    }

    return result;
}

/**
 * Validate session binding token against stored hash
 * Uses timing-safe comparison to prevent timing attacks
 */
export function validateSessionBinding(
    bindingToken: string,
    storedBindingHash: string,
): boolean {
    const inputHash = hashToken(bindingToken);
    try {
        return crypto.timingSafeEqual(
            Buffer.from(inputHash, 'hex'),
            Buffer.from(storedBindingHash, 'hex'),
        );
    } catch {
        return false;
    }
}

/**
 * Get the active session with full validation
 * Returns null if:
 * - No active_session cookie
 * - Session doesn't exist in Redis
 * - Binding token validation fails
 *
 * If active session is invalid but other sessions exist, returns first valid one
 */
export async function getActiveSession(
    cookies: Record<string, string | undefined>,
): Promise<ActiveSessionData | null> {
    const activeSessionId = cookies.active_session;
    const allSessions = parseSessionCookies(cookies);

    // Try active session first
    if (activeSessionId) {
        const activeCookie = allSessions.find(s => s.sessionId === activeSessionId);
        if (activeCookie) {
            const session = await getSession(activeSessionId);
            if (session && session.refreshTokenHash) {
                // Validate binding if hash exists
                const bindingHash = await redis.get(`binding:${activeSessionId}`);
                if (!bindingHash || validateSessionBinding(activeCookie.bindingToken, bindingHash as string)) {
                    return {
                        sessionId: activeSessionId,
                        bindingToken: activeCookie.bindingToken,
                        session,
                    };
                }
            }
        }
    }

    // Fallback: find first valid session
    for (const cookie of allSessions) {
        const session = await getSession(cookie.sessionId);
        if (session) {
            const bindingHash = await redis.get(`binding:${cookie.sessionId}`);
            if (!bindingHash || validateSessionBinding(cookie.bindingToken, bindingHash as string)) {
                return {
                    sessionId: cookie.sessionId,
                    bindingToken: cookie.bindingToken,
                    session,
                };
            }
        }
    }

    return null;
}

/**
 * Get all valid sessions for a user from cookies
 * Validates each session exists in Redis
 */
export async function getAllValidSessions(
    cookies: Record<string, string | undefined>,
): Promise<Array<{ sessionId: string; session: SessionData }>> {
    const allCookies = parseSessionCookies(cookies);
    const validSessions: Array<{ sessionId: string; session: SessionData }> = [];

    for (const cookie of allCookies) {
        const session = await getSession(cookie.sessionId);
        if (session) {
            // Validate binding
            const bindingHash = await redis.get(`binding:${cookie.sessionId}`);
            if (!bindingHash || validateSessionBinding(cookie.bindingToken, bindingHash as string)) {
                validSessions.push({ sessionId: cookie.sessionId, session });
            }
        }
    }

    return validSessions;
}

/**
 * Count current sessions for a user (for limit enforcement)
 */
export async function countUserSessions(userId: string): Promise<number> {
    const sessionIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
    if (!sessionIds) return 0;

    // Verify sessions actually exist (cleanup stale references)
    let count = 0;
    for (const sessionId of sessionIds) {
        const exists = await redis.exists(`${SESSION_PREFIX}${sessionId}`);
        if (exists) {
            count++;
        }
    }
    return count;
}

/**
 * Generate binding token and hash for session cookie security
 */
export function generateBindingToken(): { token: string; hash: string } {
    const token = generateSecureToken(24);
    const hash = hashToken(token);
    return { token, hash };
}

/**
 * Check if user already has a session in the current cookies
 */
export async function findExistingUserSession(
    cookies: Record<string, string | undefined>,
    userId: string,
): Promise<{ sessionId: string; bindingToken: string } | null> {
    const allCookies = parseSessionCookies(cookies);

    for (const cookie of allCookies) {
        const session = await getSession(cookie.sessionId);
        if (session && session.userId === userId) {
            return cookie;
        }
    }

    return null;
}

/**
 * Migrate legacy single-session cookies to new format
 * One-time, destructive, logged
 */
export async function migrateLegacyCookies(
    cookies: Record<string, string | undefined>,
    clearCookieCallback: (name: string) => void,
    setCookieCallback: (name: string, value: string) => void,
): Promise<{ migrated: boolean; sessionId?: string; bindingToken?: string }> {
    // Check if already migrated
    if (cookies._multi_session_migrated === 'true') {
        return { migrated: false };
    }

    const legacyRefreshToken = cookies.refreshToken;
    const legacySessionId = cookies.sessionId;

    if (legacyRefreshToken && legacySessionId) {
        // Validate legacy session
        const session = await getSession(legacySessionId);
        if (session) {
            // Generate binding token for new format
            const { token, hash } = generateBindingToken();

            // Store binding hash in Redis
            await redis.hset(`${SESSION_PREFIX}${legacySessionId}`, { bindingHash: hash });

            // Set new format cookies
            setCookieCallback(`session_${legacySessionId}`, token);
            setCookieCallback('active_session', legacySessionId);

            logger.info('legacy_session_migrated', {
                sessionId: legacySessionId,
                userId: session.userId,
            });

            // Clear legacy cookies
            clearCookieCallback('refreshToken');
            clearCookieCallback('sessionId');

            // Set migration flag
            setCookieCallback('_multi_session_migrated', 'true');

            return { migrated: true, sessionId: legacySessionId, bindingToken: token };
        }
    }

    // No valid legacy session, but still mark as migrated
    if (legacyRefreshToken || legacySessionId) {
        clearCookieCallback('refreshToken');
        clearCookieCallback('sessionId');
    }
    setCookieCallback('_multi_session_migrated', 'true');

    return { migrated: false };
}

/**
 * Get all logged-in accounts with user info
 * Fetches from database for complete user data
 */
export async function getLoggedInAccountsInfo(
    cookies: Record<string, string | undefined>,
    prisma: { user: { findMany: Function } },
): Promise<
    Array<{
        sessionId: string;
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profileImageUrl: string | null;
        deviceName?: string;
        lastActiveAt: Date;
    }>
> {
    const validSessions = await getAllValidSessions(cookies);
    if (validSessions.length === 0) return [];

    const userIds = [...new Set(validSessions.map(s => s.session.userId))];

    interface UserInfo {
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profileImageUrl: string | null;
    }

    const users: UserInfo[] = await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
        },
    });

    const userMap = new Map<string, UserInfo>(users.map((u) => [u.userId, u]));

    return validSessions.map(({ sessionId, session }) => {
        const user = userMap.get(session.userId);
        return {
            sessionId,
            userId: session.userId,
            email: user?.email || '',
            firstName: user?.firstName || null,
            lastName: user?.lastName || null,
            profileImageUrl: user?.profileImageUrl || null,
            deviceName: session.deviceName,
            lastActiveAt: session.lastActiveAt,
        };
    });
}
