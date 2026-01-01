import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

// Constants
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';

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
        expiresIn: ACCESS_TOKEN_EXPIRY,
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
    };

    // Store session in Redis
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    await redis.setex(
        sessionKey,
        REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
        JSON.stringify(sessionData),
    );

    // Add to user's session list
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    await redis.sadd(userSessionsKey, sessionId);

    logger.info('Session created', { userId, sessionId, deviceType: deviceInfo.deviceType });

    return sessionId;
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
        logger.error('Failed to parse session data', {
            sessionId,
            dataType: typeof data,
            error: error instanceof Error ? error.message : String(error)
        });
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
 */
export async function rotateRefreshToken(
    sessionId: string,
    oldRefreshToken: string,
): Promise<{ newRefreshToken: string; accessToken: string } | null> {
    const session = await validateRefreshToken(sessionId, oldRefreshToken);

    if (!session) {
        return null;
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

    logger.info('Session destroyed', { sessionId });
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(
    userId: string,
): Promise<Array<{ sessionId: string; data: SessionData }>> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

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
    const sessionIds = await redis.smembers(userSessionsKey);

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
