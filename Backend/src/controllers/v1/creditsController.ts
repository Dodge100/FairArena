import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { sendFreeCreditsClaimedEmail, sendPhoneNumberAddedEmail } from '../../email/v1/send-mail.js';
import { inngest } from '../../inngest/v1/client.js';
import { getUserCreditBalance, getUserCreditHistory } from '../../services/v1/creditService.js';
import logger from '../../utils/logger.js';

// Enhanced cache configuration for high-scale operations
const CACHE_TTL = {
  USER_CREDITS: 1800, // 30 minutes (reduced for accuracy)
  USER_CREDIT_HISTORY: 900, // 15 minutes
  ELIGIBILITY_CHECK: 300, // 5 minutes
  OTP_VERIFICATION: 900, // 15 minutes for verification status
} as const;

// Security configuration
const SECURITY_CONFIG = {
  MAX_OTP_ATTEMPTS: 3,
  OTP_RATE_LIMIT_WINDOW: 86400, // 24 hours
  VERIFICATION_RATE_LIMIT_WINDOW: 3600, // 1 hour
  MAX_PHONE_LENGTH: 15, // Including country code
  MIN_PHONE_LENGTH: 8,
  CACHE_SECURITY_TTL: 300, // 5 minutes for security-related caches
  SALT_ROUNDS: 12, // For bcrypt hashing
} as const;

// Input validation schemas
const creditHistoryQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional(),
  type: z.enum(['PURCHASE', 'REFUND', 'BONUS', 'DEDUCTION', 'ADJUSTMENT', 'INITIAL_ALLOCATION', 'EXPIRY', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
});

const sendSmsOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\d{1,10}$/, 'Phone number must be 1-10 digits'),
  countryCode: z.string().regex(/^\+\d{1,4}$/, 'Invalid country code format'),
  isResend: z.boolean().optional(),
});

const verifySmsOtpSchema = z.object({
  otp: z.string().refine(otp => /^\d{6}$/.test(otp) || /^[A-Z0-9]{6,12}$/i.test(otp), 'Invalid OTP format'),
});

// Security utilities
const generateSecureCacheKey = (prefix: string, userId: string, ...params: string[]) => {
  return `${prefix}${userId}:${params.join(':')}`;
};

const sanitizeInput = (input: string): string => {
  return input.replace(/[<>'"&]/g, '');
};

const logSecurityEvent = (event: string, userId: string, details: Record<string, unknown>) => {
  logger.warn(`SECURITY: ${event}`, { userId, ...details, timestamp: new Date().toISOString() });
};

const checkDisposablePhoneNumber = async (
  phoneNumber: string,
  userId: string
): Promise<{ isDisposable: boolean; error?: string }> => {
  // Strip the + from the phone number for the API call
  const phoneForApi = phoneNumber.replace(/^\+/, '');

  // Check if credential validator URL is configured
  if (!ENV.CREDENTIAL_VALIDATOR_URL) {
    logger.info('CREDENTIAL_VALIDATOR_URL not configured, skipping disposable phone check', { userId });
    return { isDisposable: false };
  }

  try {
    const checkUrl = `${ENV.CREDENTIAL_VALIDATOR_URL}/check-phone?phone=${encodeURIComponent(phoneForApi)}`;

    logger.info('Checking phone number against disposable database', {
      userId,
      phoneNumber: phoneNumber.substring(0, 5) + '***',
    });

    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      // Non-200 response - fail open (allow the request)
      logger.warn('Disposable phone check API returned non-OK status, allowing request', {
        userId,
        status: response.status,
        statusText: response.statusText,
      });
      return { isDisposable: false };
    }

    const data = await response.json();
    const tempphoneValue = data.tempphone;

    // Handle "invalid phone number" string response
    if (tempphoneValue === 'invalid phone number') {
      logger.warn('Phone validation returned invalid phone format', {
        userId,
        phoneNumber: phoneNumber.substring(0, 5) + '***',
      });
      return {
        isDisposable: true,
        error: 'Invalid phone number format. Please enter a valid mobile number.'
      };
    }

    // Handle null (API internal error) - fail open
    if (tempphoneValue === null) {
      logger.warn('Phone validation API returned null (internal error), allowing request', {
        userId,
        phoneNumber: phoneNumber.substring(0, 5) + '***',
      });
      return { isDisposable: false };
    }

    // Handle boolean response
    const isDisposable = tempphoneValue === true;

    if (isDisposable) {
      logger.warn('Temporary/disposable phone number detected - BLOCKING', {
        userId,
        phoneNumber: phoneNumber.substring(0, 5) + '***',
      });
      return {
        isDisposable: true,
        error: 'Temporary or virtual phone numbers are not allowed. Please use a real mobile number.'
      };
    }

    logger.info('Phone number passed disposable check', { userId });
    return { isDisposable: false };
  } catch (error) {
    // API failure (timeout, network error, etc.) - fail open (allow the request)
    logger.warn('Disposable phone check failed (API down/timeout), allowing request to proceed', {
      userId,
      phoneNumber: phoneNumber.substring(0, 5) + '***',
      error: error instanceof Error ? error.message : String(error),
    });
    return { isDisposable: false };
  }
};

// Cache invalidation helper
const invalidateUserCaches = async (userId: string) => {
  const keys = [
    `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`,
    `${REDIS_KEYS.USER_CREDITS_CACHE}eligibility:${userId}`,
    `${REDIS_KEYS.USER_CREDITS_CACHE}history:${userId}:*`,
  ];

  try {
    for (const key of keys) {
      await redis.del(key);
    }
    logger.info('User caches invalidated', { userId });
  } catch (error) {
    logger.warn('Failed to invalidate user caches', { userId, error });
  }
};

export const getCreditBalance = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'getCreditBalance' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Security: Rate limit balance checks (max 10 per minute)
    const rateLimitKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'balance_check');
    try {
      const currentRequests = await redis.incr(rateLimitKey);
      if (currentRequests === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute window
      }
      if (currentRequests > 10) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', userId, { endpoint: 'getCreditBalance', attempts: currentRequests });
        return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
      }
    } catch (error) {
      logger.warn('Rate limiting check failed', { userId, error });
    }

    const cacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'balance');

    try {
      // Try cache first with error handling
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        logger.info('Returning cached credit balance', { userId });
        const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;

        // Add security headers
        res.set({
          'Cache-Control': 'private, max-age=1800',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        });

        return res.json(parsedData);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for credit balance', { error, userId });
      // Continue to database query if cache fails
    }

    const balance = await getUserCreditBalance(userId);

    const responseData = {
      success: true,
      data: {
        balance,
        userId,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache the result with error handling
    try {
      await redis.setex(cacheKey, CACHE_TTL.USER_CREDITS, JSON.stringify(responseData));
      logger.info('Credit balance cached successfully', { userId });
    } catch (error) {
      logger.warn('Redis cache write failed for credit balance', { error, userId });
      // Don't fail the request if caching fails
    }

    // Add security headers
    res.set({
      'Cache-Control': 'private, max-age=1800',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });

    logger.info('Credit balance retrieved from database', { userId, balance });

    res.json(responseData);
  } catch (error) {
    logger.error('Failed to get credit balance', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve credit balance. Please try again later.',
    });
  }
};

/**
 * Get user's credit transaction history
 */
export const getCreditHistory = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'getCreditHistory' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Security: Rate limit history requests (max 5 per minute)
    const rateLimitKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'history_check');
    try {
      const currentRequests = await redis.incr(rateLimitKey);
      if (currentRequests === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute window
      }
      if (currentRequests > 5) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', userId, { endpoint: 'getCreditHistory', attempts: currentRequests });
        return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
      }
    } catch (error) {
      logger.warn('Rate limiting check failed', { userId, error });
    }

    // Validate and sanitize query parameters
    const validation = creditHistoryQuerySchema.safeParse(req.query);
    if (!validation.success) {
      logSecurityEvent('INVALID_INPUT', userId, { endpoint: 'getCreditHistory', errors: validation.error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.issues,
      });
    }

    const { limit = 50, offset = 0, type } = validation.data;

    // Security: Prevent excessive data retrieval
    if (limit > 100) {
      logSecurityEvent('EXCESSIVE_LIMIT', userId, { limit, endpoint: 'getCreditHistory' });
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 100 records',
      });
    }

    // Create secure cache key that includes sanitized query parameters
    const cacheKeyParams = JSON.stringify({ limit, offset, type });
    const cacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'history', cacheKeyParams);

    try {
      // Try cache first with error handling
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        logger.info('Returning cached credit history', { userId, limit, offset, type });
        const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;

        // Add security headers
        res.set({
          'Cache-Control': 'private, max-age=900',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        });

        return res.json(parsedData);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for credit history', { error, userId });
    }

    const result = await getUserCreditHistory(userId, {
      limit,
      offset,
      type,
    });

    const responseData = {
      success: true,
      data: {
        ...result,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache the result with error handling
    try {
      await redis.setex(cacheKey, CACHE_TTL.USER_CREDIT_HISTORY, JSON.stringify(responseData));
      logger.info('Credit history cached successfully', { userId, limit, offset, type });
    } catch (error) {
      logger.warn('Redis cache write failed for credit history', { error, userId });
    }

    // Add security headers
    res.set({
      'Cache-Control': 'private, max-age=900',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });

    logger.info('Credit history retrieved from database', {
      userId,
      count: result.transactions.length,
      total: result.total,
      limit,
      offset,
    });

    res.json(responseData);
  } catch (error) {
    logger.error('Failed to get credit history', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve credit history. Please try again later.',
    });
  }
};

/**
 * Check if user is eligible for free credits
 */
export const checkFreeCreditsEligibility = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'checkFreeCreditsEligibility' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Security: Rate limit eligibility checks (max 10 per minute)
    const eligibilityRateLimitKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'eligibility_check');
    try {
      const eligibilityRequests = await redis.incr(eligibilityRateLimitKey);
      if (eligibilityRequests === 1) {
        await redis.expire(eligibilityRateLimitKey, 60); // 1 minute window
      }
      if (eligibilityRequests > 10) {
        logSecurityEvent('ELIGIBILITY_RATE_LIMIT_EXCEEDED', userId, { attempts: eligibilityRequests });
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: 60,
        });
      }
    } catch (error) {
      logger.warn('Eligibility rate limiting check failed', { userId, error });
    }

    // Enhanced caching with secure cache key
    const cacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'eligibility');
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        logger.info('Returning cached eligibility check', { userId });
        const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;

        // Add security headers
        res.set({
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        });

        return res.json(parsedData);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for eligibility', { error, userId });
    }

    // Get user data with enhanced checks
    let user;
    const userCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'user_status');

    try {
      const cachedUser = await redis.get(userCacheKey);
      if (typeof cachedUser === 'string') {
        user = typeof cachedUser === 'string' ? JSON.parse(cachedUser) : cachedUser;
      } else {
        user = await prisma.user.findUnique({
          where: { userId },
          select: {
            hasClaimedFreeCredits: true,
            createdAt: true,
            isDeleted: true,
            phoneNumber: true,
            isPhoneVerified: true
          },
        });

        if (user) {
          await redis.setex(userCacheKey, CACHE_TTL.USER_CREDITS, JSON.stringify(user));
        }
      }
    } catch (error) {
      logger.warn('User data retrieval failed', { userId, error });
      // Fallback to direct database query
      user = await prisma.user.findUnique({
        where: { userId },
        select: {
          hasClaimedFreeCredits: true,
          createdAt: true,
          isDeleted: true,
          phoneNumber: true,
          isPhoneVerified: true
        },
      });
    }

    if (!user) {
      logSecurityEvent('USER_NOT_FOUND', userId, { endpoint: 'checkFreeCreditsEligibility' });
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isDeleted) {
      logSecurityEvent('DELETED_USER_ATTEMPT', userId, { endpoint: 'checkFreeCreditsEligibility' });
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Check if user already has INITIAL_ALLOCATION credits with caching
    let existingInitialAllocation = false;
    const creditCheckCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'initial_allocation_check');

    try {
      const cachedCheck = await redis.get(creditCheckCacheKey);
      if (cachedCheck !== null) {
        existingInitialAllocation = cachedCheck === 'true';
      } else {
        const transaction = await prisma.creditTransaction.findFirst({
          where: {
            userId,
            type: 'INITIAL_ALLOCATION',
          },
          select: { id: true },
        });
        existingInitialAllocation = !!transaction;

        // Cache the result
        await redis.setex(creditCheckCacheKey, CACHE_TTL.USER_CREDITS, existingInitialAllocation ? 'true' : 'false');
      }
    } catch (error) {
      logger.warn('Credit allocation check failed', { userId, error });
      // Fallback to direct database check
      const transaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type: 'INITIAL_ALLOCATION',
        },
        select: { id: true },
      });
      existingInitialAllocation = !!transaction;
    }

    // Check if phone is verified for credits claim with enhanced security
    // Priority: Database verification status (permanent) > Redis cache (temporary)
    let isVerified = false;
    const verificationKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'verified');

    try {
      const verificationStatus = await redis.get(verificationKey);
      isVerified = verificationStatus === 'true';
    } catch (error) {
      logger.warn('Verification status check failed', { userId, error });
    }

    // Database phone verification has higher priority - once verified in DB, always considered verified
    const phoneVerified = user.isPhoneVerified === true || isVerified;

    // CRITICAL FIX: Only consider credits claimed if there's an INITIAL_ALLOCATION transaction
    // Don't rely on the hasClaimedFreeCredits flag as it can be inconsistent
    const hasClaimedFreeCredits = existingInitialAllocation;
    const canClaimFreeCredits = !hasClaimedFreeCredits && phoneVerified;

    logger.info('Eligibility check completed', {
      userId,
      phoneVerified,
      dbPhoneVerified: user.isPhoneVerified,
      redisPhoneVerified: isVerified,
      hasClaimedFreeCredits,
      existingInitialAllocation,
      dbHasClaimedFlag: user.hasClaimedFreeCredits,
      canClaimFreeCredits,
    });

    const responseData = {
      success: true,
      data: {
        canClaimFreeCredits,
        hasClaimedFreeCredits,
        phoneVerified,
        hasPhoneNumber: !!user.phoneNumber,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache the result with enhanced TTL
    try {
      await redis.setex(cacheKey, CACHE_TTL.ELIGIBILITY_CHECK, JSON.stringify(responseData));
      logger.info('Eligibility check cached successfully', { userId });
    } catch (error) {
      logger.warn('Failed to cache eligibility result', { error, userId });
    }

    // Add security headers
    res.set({
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });

    logger.info('Free credits eligibility checked', {
      userId,
      canClaimFreeCredits,
      hasClaimedFreeCredits,
      phoneVerified,
    });

    res.json(responseData);
  } catch (error) {
    logger.error('Failed to check free credits eligibility', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to check eligibility. Please try again later.',
    });
  }
};

/**
 * Claim free credits for new users
 */
export const claimFreeCredits = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'claimFreeCredits' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Security: Rate limit credit claims (max 3 per day)
    const claimRateLimitKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'claim_free_credits');
    try {
      const claimRequests = await redis.incr(claimRateLimitKey);
      if (claimRequests === 1) {
        await redis.expire(claimRateLimitKey, 86400); // 24 hour window
      }
      if (claimRequests > 3) {
        logSecurityEvent('CLAIM_RATE_LIMIT_EXCEEDED', userId, { attempts: claimRequests });
        return res.status(429).json({
          success: false,
          message: 'Too many credit claim attempts. Please try again tomorrow.',
          retryAfter: 86400,
        });
      }
    } catch (error) {
      logger.warn('Claim rate limiting check failed', { userId, error });
    }

    // Check user existence and status with caching
    const userCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'user_status');
    let user;

    try {
      const cachedUser = await redis.get(userCacheKey);
      if (typeof cachedUser === 'string') {
        user = JSON.parse(cachedUser);
      } else {
        user = await prisma.user.findUnique({
          where: { userId },
          select: { hasClaimedFreeCredits: true, createdAt: true, isDeleted: true, email: true, firstName: true, lastName: true },
        });

        if (user) {
          await redis.setex(userCacheKey, CACHE_TTL.USER_CREDITS, JSON.stringify(user));
        }
      }
    } catch (error) {
      logger.warn('User status check failed', { userId, error });
      // Fallback to direct database query
      user = await prisma.user.findUnique({
        where: { userId },
        select: { hasClaimedFreeCredits: true, createdAt: true, isDeleted: true, email: true, firstName: true, lastName: true },
      });
    }

    if (!user) {
      logSecurityEvent('USER_NOT_FOUND', userId, { endpoint: 'claimFreeCredits' });
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isDeleted) {
      logSecurityEvent('DELETED_USER_ATTEMPT', userId, { endpoint: 'claimFreeCredits' });
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // CRITICAL FIX: Check if user has already claimed by looking for INITIAL_ALLOCATION transaction
    // Don't rely on hasClaimedFreeCredits flag as it can be inconsistent
    if (user.hasClaimedFreeCredits) {
      logSecurityEvent('DUPLICATE_CLAIM_ATTEMPT', userId, { hasClaimedFreeCredits: true });
      return res.status(400).json({ success: false, message: 'Free credits already claimed' });
    }

    // Double-check: Ensure user doesn't already have INITIAL_ALLOCATION credits with caching
    const creditCheckCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'initial_allocation_check');
    let existingInitialAllocation = null;

    try {
      const cachedCheck = await redis.get(creditCheckCacheKey);
      if (cachedCheck !== null) {
        existingInitialAllocation = cachedCheck === 'true';
      } else {
        const transaction = await prisma.creditTransaction.findFirst({
          where: {
            userId,
            type: 'INITIAL_ALLOCATION',
          },
          select: { id: true },
        });
        existingInitialAllocation = !!transaction;

        // Cache the result
        await redis.setex(creditCheckCacheKey, CACHE_TTL.USER_CREDITS, existingInitialAllocation ? 'true' : 'false');
      }
    } catch (error) {
      logger.warn('Credit allocation check failed', { userId, error });
      // Fallback to direct database check
      const transaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type: 'INITIAL_ALLOCATION',
        },
        select: { id: true },
      });
      existingInitialAllocation = !!transaction;
    }

    if (existingInitialAllocation) {
      logSecurityEvent('DUPLICATE_INITIAL_ALLOCATION', userId, { endpoint: 'claimFreeCredits' });
      return res.status(400).json({
        success: false,
        message: 'You have already received free credits. You cannot claim additional free credits.',
      });
    }

    // Check if phone is verified for credits claim with enhanced security
    // CRITICAL FIX: Check database first, then Redis cache
    const verificationKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'verified');
    let isVerifiedInRedis = false;

    try {
      const verificationStatus = await redis.get(verificationKey);
      isVerifiedInRedis = verificationStatus === 'true';
    } catch (error) {
      logger.warn('Verification status check failed', { userId, error });
    }

    // Query database for permanent phone verification status
    let isPhoneVerifiedInDb = false;
    try {
      const userVerification = await prisma.user.findUnique({
        where: { userId },
        select: { isPhoneVerified: true, phoneNumber: true },
      });
      isPhoneVerifiedInDb = userVerification?.isPhoneVerified === true;

      logger.info('Phone verification status check', {
        userId,
        isPhoneVerifiedInDb,
        isVerifiedInRedis,
        hasPhoneNumber: !!userVerification?.phoneNumber,
      });
    } catch (dbError) {
      logger.error('Failed to check phone verification from database', { userId, error: dbError });
      // Continue with Redis check only if DB fails
    }

    // User is considered verified if either database shows verified OR Redis cache shows verified
    const isVerified = isPhoneVerifiedInDb || isVerifiedInRedis;

    if (!isVerified) {
      logSecurityEvent('UNVERIFIED_PHONE_CLAIM_ATTEMPT', userId, {
        endpoint: 'claimFreeCredits',
        dbVerified: isPhoneVerifiedInDb,
        redisVerified: isVerifiedInRedis,
      });
      return res.status(400).json({
        success: false,
        message: 'Phone verification required. Please verify your phone number first.',
        requiresVerification: true,
      });
    }

    // Atomic transaction for credit claiming to prevent race conditions
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Double-check inside transaction to prevent race conditions
        const userCheck = await tx.user.findUnique({
          where: { userId },
          select: { hasClaimedFreeCredits: true },
        });

        if (userCheck?.hasClaimedFreeCredits) {
          throw new Error('Free credits already claimed');
        }

        const creditCheck = await tx.creditTransaction.findFirst({
          where: {
            userId,
            type: 'INITIAL_ALLOCATION',
          },
          select: { id: true },
        });

        if (creditCheck) {
          throw new Error('Initial allocation already exists');
        }

        // Get current balance (avoid nested transaction by doing this inline)
        const lastTransaction = await tx.creditTransaction.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        const currentBalance = lastTransaction?.balance || 0;
        const newBalance = currentBalance + 200;

        // Create credit transaction
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            amount: 200,
            balance: newBalance,
            type: 'INITIAL_ALLOCATION',
            description: 'Welcome bonus - Free credits for all users',
            metadata: {
              type: 'free_credits_claim',
              ip: req.ip,
              userAgent: req.get('User-Agent'),
            },
          },
        });

        // Update user to mark as claimed
        await tx.user.update({
          where: { userId },
          data: { hasClaimedFreeCredits: true },
        });

        return {
          success: true,
          newBalance,
          transactionId: transaction.id,
        };
      }, {
        timeout: 30000, // 30 second timeout for the transaction
      });

      // Comprehensive cache invalidation after successful transaction
      await invalidateUserCaches(userId);

      // Invalidate ALL specific caches related to credits and eligibility
      const cachesToInvalidate = [
        claimRateLimitKey,
        generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'user_status'),
        generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'eligibility'),
        generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'balance'),
        generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'initial_allocation_check'),
        creditCheckCacheKey,
        userCacheKey,
        // Also invalidate credit history caches
        `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`,
        `${REDIS_KEYS.USER_CREDIT_HISTORY_CACHE}${userId}:*`,
      ];

      try {
        // Delete specific cache keys
        await redis.del(...cachesToInvalidate.filter(key => !key.includes('*')));

        // Handle pattern-based deletions
        const patternKeys = cachesToInvalidate.filter(key => key.includes('*'));
        for (const pattern of patternKeys) {
          const keys = await redis.keys(pattern);
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        }

        logger.info('All credit claim caches invalidated', { userId, cachesCleared: cachesToInvalidate.length });
      } catch (error) {
        logger.warn('Failed to invalidate some claim caches', { userId, error });
      }

    } catch (transactionError) {
      logger.error('Credit claim transaction failed', { userId, error: transactionError });
      logSecurityEvent('TRANSACTION_FAILURE', userId, { error: transactionError });

      // Handle specific database errors
      if (transactionError instanceof Error) {
        if (transactionError.message.includes('already claimed')) {
          return res.status(400).json({
            success: false,
            message: 'Free credits already claimed',
          });
        }

        // Handle transaction timeout (P2028)
        if (transactionError.message.includes('P2028') || transactionError.message.includes('Unable to start a transaction')) {
          logger.warn('Transaction timeout during credit claim, suggesting retry', { userId });
          return res.status(503).json({
            success: false,
            message: 'Service temporarily unavailable. Please try again in a few moments.',
            retryAfter: 30,
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to process credit claim. Please try again.',
      });
    }

    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    logger.info('Free credits claimed successfully', {
      userId,
      credits: 200,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Send in-app notification for successful credit claim
    try {
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          title: '🎉 Welcome Bonus Credits!',
          message: 'Congratulations! You\'ve received 200 free credits to get started.',
          description: `Your new balance is ${result.newBalance} credits. Use them to explore our platform features.`,
          actionUrl: '/credits',
          actionLabel: 'View Credits',
          metadata: {
            type: 'credit_claim_success',
            creditsAdded: 200,
            newBalance: result.newBalance,
            transactionId: result.transactionId,
          },
        },
      });
      logger.info('In-app notification sent for credit claim', { userId, transactionId: result.transactionId });
    } catch (notificationError) {
      logger.warn('Failed to send in-app notification for credit claim', { userId, error: notificationError });
      // Don't fail the request if notification fails
    }

    // Send email notification for free credits claimed
    try {
      const userName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || 'User';

      await sendFreeCreditsClaimedEmail(user.email, userName, 200, result.newBalance);
      logger.info('Free credits claimed email sent', { userId, email: user.email });
    } catch (emailError) {
      logger.warn('Failed to send free credits claimed email', { userId, error: emailError });
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Free credits claimed successfully',
      data: {
        creditsAdded: 200,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        claimedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to claim free credits', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to claim free credits. Please try again later.',
    });
  }
};

/**
 * Send SMS OTP for phone verification
 */
export const sendSmsOtp = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'sendSmsOtp' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate and sanitize input using Zod schema
    const validation = sendSmsOtpSchema.safeParse(req.body);
    if (!validation.success) {
      logSecurityEvent('INVALID_INPUT', userId, { endpoint: 'sendSmsOtp', errors: validation.error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: validation.error.issues,
      });
    }

    const { phoneNumber, countryCode, isResend } = validation.data;

    // Check if current user already has a verified phone number
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { isPhoneVerified: true, phoneNumber: true },
    });

    if (currentUser?.isPhoneVerified) {
      logSecurityEvent('OTP_REQUEST_FOR_ALREADY_VERIFIED_USER', userId, { endpoint: 'sendSmsOtp' });
      return res.status(400).json({
        success: false,
        message: 'Your phone number is already verified. Please go ahead and claim your credits.',
        alreadyVerified: true,
      });
    }

    // Check for resend timing restriction (2 minutes minimum between OTP requests)
    const otpTimestampKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'timestamp');
    if (isResend) {
      try {
        const lastOtpTime = await redis.get(otpTimestampKey);
        if (lastOtpTime) {
          const timeSinceLastOtp = Date.now() - parseInt(lastOtpTime as string);
          const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds

          if (timeSinceLastOtp < twoMinutes) {
            const remainingTime = Math.ceil((twoMinutes - timeSinceLastOtp) / 1000);
            logSecurityEvent('RESEND_TOO_SOON', userId, { remainingTime, endpoint: 'sendSmsOtp' });
            return res.status(429).json({
              success: false,
              message: `Please wait ${remainingTime} seconds before requesting a new code.`,
              retryAfter: remainingTime,
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to check OTP timestamp', { userId, error });
      }
    }

    // Additional security: Check for suspicious patterns
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    if (fullPhoneNumber.length < SECURITY_CONFIG.MIN_PHONE_LENGTH ||
      fullPhoneNumber.length > SECURITY_CONFIG.MAX_PHONE_LENGTH) {
      logSecurityEvent('SUSPICIOUS_PHONE_FORMAT', userId, { phoneLength: fullPhoneNumber.length });
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }

    // Security: Check if phone number contains only allowed characters
    if (!/^\+\d+$/.test(fullPhoneNumber)) {
      logSecurityEvent('MALFORMED_PHONE_NUMBER', userId, { phoneNumber: fullPhoneNumber.substring(0, 3) + '***' });
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }

    // Check for disposable/temporary phone numbers
    const disposableCheck = await checkDisposablePhoneNumber(fullPhoneNumber, userId);
    if (disposableCheck.isDisposable) {
      logSecurityEvent('DISPOSABLE_PHONE_BLOCKED', userId, {
        phoneNumber: fullPhoneNumber.substring(0, 5) + '***',
        reason: disposableCheck.error,
      });
      return res.status(400).json({
        success: false,
        message: disposableCheck.error || 'Temporary or virtual phone numbers are not allowed. Please use a real mobile number.',
        code: 'DISPOSABLE_PHONE',
      });
    }

    // Check if phone number is already verified by another user (with caching)
    const phoneCheckCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, 'phone_check', fullPhoneNumber);
    let existingVerifiedUser = null;

    try {
      const cachedCheck = await redis.get(phoneCheckCacheKey);
      if (typeof cachedCheck === 'string') {
        existingVerifiedUser = JSON.parse(cachedCheck);
      } else {
        existingVerifiedUser = await prisma.user.findFirst({
          where: {
            phoneNumber: fullPhoneNumber,
            isPhoneVerified: true,
            userId: { not: userId }, // Exclude current user
          },
          select: { userId: true },
        });

        // Cache the result for 1 hour
        await redis.setex(phoneCheckCacheKey, 3600, JSON.stringify(existingVerifiedUser));
      }
    } catch (error) {
      logger.warn('Phone verification check failed', { userId, error });
      // Continue without caching if Redis fails
      existingVerifiedUser = await prisma.user.findFirst({
        where: {
          phoneNumber: fullPhoneNumber,
          isPhoneVerified: true,
          userId: { not: userId },
        },
        select: { userId: true },
      });
    }

    if (existingVerifiedUser) {
      logSecurityEvent('DUPLICATE_PHONE_VERIFICATION_ATTEMPT', userId, { existingUserId: existingVerifiedUser.userId });
      return res.status(400).json({
        success: false,
        message: 'This phone number is already verified by another user. Please use a different phone number.',
      });
    }

    // CRITICAL: Check if phone number is currently being verified by another user (race condition prevention)
    const phoneVerificationLockKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, 'phone_lock', fullPhoneNumber);
    let phoneLockOwner = null;

    try {
      phoneLockOwner = await redis.get(phoneVerificationLockKey);
      if (phoneLockOwner && phoneLockOwner !== userId) {
        // Different user is verifying this phone number
        logSecurityEvent('RACE_CONDITION_PHONE_VERIFICATION', userId, {
          phoneNumber: fullPhoneNumber.substring(0, 3) + '***',
          lockOwner: phoneLockOwner,
          message: 'Phone number already being verified by another user'
        });
        return res.status(409).json({
          success: false,
          message: 'This phone number is currently being verified by another user. Please try again in a few minutes or use a different phone number.',
        });
      } else if (phoneLockOwner === userId && isResend) {
        // Same user resending - this is allowed, will overwrite the existing OTP
        logger.info('Same user resending OTP - allowed', { userId, phoneNumber: fullPhoneNumber.substring(0, 3) + '***' });
      }
    } catch (error) {
      logger.warn('Phone lock check failed', { userId, error });
    }

    // Check if user already has INITIAL_ALLOCATION credits (with caching)
    const creditCheckCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'initial_allocation_check');
    let existingInitialAllocation = null;

    try {
      const cachedCheck = await redis.get(creditCheckCacheKey);
      if (cachedCheck !== null) {
        existingInitialAllocation = cachedCheck === 'true';
      } else {
        const transaction = await prisma.creditTransaction.findFirst({
          where: {
            userId,
            type: 'INITIAL_ALLOCATION',
          },
          select: { id: true },
        });
        existingInitialAllocation = !!transaction;

        // Cache the result for 1 hour
        await redis.setex(creditCheckCacheKey, 3600, existingInitialAllocation ? 'true' : 'false');
      }
    } catch (error) {
      logger.warn('Credit allocation check failed', { userId, error });
      // Fallback to direct database check
      const transaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type: 'INITIAL_ALLOCATION',
        },
        select: { id: true },
      });
      existingInitialAllocation = !!transaction;
    }

    if (existingInitialAllocation) {
      logSecurityEvent('DUPLICATE_FREE_CREDITS_ATTEMPT', userId, { endpoint: 'sendSmsOtp' });
      return res.status(400).json({
        success: false,
        message: 'You have already received free credits. You cannot claim additional free credits.',
      });
    }

    // Store phone number in Redis temporarily with enhanced security and race condition prevention
    const phoneKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'phone');
    try {
      // Use Redis transaction to atomically check and set the phone lock
      const redisTransaction = redis.multi();

      if (phoneLockOwner === userId) {
        // Same user resending - just update the values
        redisTransaction.setex(phoneVerificationLockKey, 3600, userId); // Update lock
        redisTransaction.setex(phoneKey, 3600, fullPhoneNumber); // Update phone number
      } else {
        // New verification attempt - set lock if not exists
        redisTransaction.set(phoneVerificationLockKey, userId, { ex: 3600, nx: true }); // Set lock if not exists
        redisTransaction.setex(phoneKey, 3600, fullPhoneNumber); // Store phone number
      }

      const transactionResults = await redisTransaction.exec();

      if (!transactionResults || (phoneLockOwner !== userId && transactionResults[0] === null)) {
        // Lock was not acquired (already exists) and it's not the same user
        logSecurityEvent('PHONE_LOCK_ACQUISITION_FAILED', userId, {
          phoneNumber: fullPhoneNumber.substring(0, 3) + '***',
          message: 'Failed to acquire phone verification lock - another user is verifying this number'
        });
        return res.status(409).json({
          success: false,
          message: 'This phone number is currently being verified by another user. Please try again in a few minutes.',
        });
      }

      logger.info('Phone verification lock acquired/updated', { userId, phoneNumber: fullPhoneNumber.substring(0, 3) + '***', isResend: !!isResend });
    } catch (redisError) {
      logger.error('Failed to store phone number and acquire lock in Redis', { userId, error: redisError });
      return res.status(500).json({ success: false, message: 'Failed to process request' });
    }

    // Enhanced rate limiting: 3 OTPs per 24 hours with better tracking
    const otpCountKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'count');

    try {
      const currentCount = await redis.get(otpCountKey);
      const count = currentCount ? parseInt(currentCount as string) : 0;

      if (count >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
        const ttl = await redis.ttl(otpCountKey);
        const remainingHours = Math.ceil(ttl / 3600);
        logSecurityEvent('OTP_RATE_LIMIT_EXCEEDED', userId, { attempts: count, remainingHours });
        return res.status(429).json({
          success: false,
          message: `Maximum OTP requests reached. Try again in ${remainingHours} hours.`,
          retryAfter: ttl,
        });
      }

      // Increment count (24 hour window)
      if (count === 0) {
        await redis.setex(otpCountKey, SECURITY_CONFIG.OTP_RATE_LIMIT_WINDOW, 1);
      } else {
        await redis.incr(otpCountKey);
      }
    } catch (redisError) {
      logger.warn('Redis error in SMS OTP rate limiting', { userId, error: redisError });
      // Continue without rate limiting if Redis fails, but log it
      logSecurityEvent('RATE_LIMITING_FAILURE', userId, { error: redisError });
    }

    // Generate cryptographically secure OTP
    const crypto = await import('crypto');
    const isNumeric = Math.random() < 0.6;
    let otp: string;

    if (isNumeric) {
      // 6-digit numeric OTP using crypto.randomInt for better security
      otp = crypto.randomInt(100000, 999999).toString();
    } else {
      // 6-12 character alphanumeric OTP
      const length = crypto.randomInt(6, 13); // Random length between 6-12
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      otp = '';
      for (let i = 0; i < length; i++) {
        otp += chars.charAt(crypto.randomInt(0, chars.length));
      }
    }

    // Hash the OTP for secure storage
    let otpHash;
    try {
      otpHash = await bcrypt.hash(otp.toUpperCase(), SECURITY_CONFIG.SALT_ROUNDS);
    } catch (hashError) {
      logger.error('Failed to hash OTP', {
        userId,
        error: hashError instanceof Error ? hashError.message : String(hashError),
      });
      return res.status(500).json({ success: false, message: 'Failed to generate OTP' });
    }

    // Store OTP data in Redis with enhanced security
    const otpKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'otp');
    const otpData = {
      userId,
      phoneNumber: fullPhoneNumber,
      otpHash,
      createdAt: Date.now(),
      attempts: 0,
    };

    try {
      await redis.setex(otpKey, 900, JSON.stringify(otpData)); // 15 minutes
      await redis.setex(otpTimestampKey, 900, Date.now().toString()); // Store timestamp for resend validation
    } catch (redisError) {
      logger.error('Failed to store SMS OTP in Redis', { userId, error: redisError });
      return res.status(500).json({ success: false, message: 'Failed to generate OTP' });
    }

    // Send SMS via notification service with enhanced logging
    try {
      await inngest.send({
        name: 'credits/send-sms-otp',
        data: {
          userId,
          phoneNumber: fullPhoneNumber,
          otp,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (inngestError) {
      logger.error('Failed to send inngest event for SMS OTP', { userId, error: inngestError });
      return res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }

    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Rate-Limit-Remaining': (
        SECURITY_CONFIG.MAX_OTP_ATTEMPTS -
        (parseInt(await redis.get(otpCountKey) as string) || 0)
      ).toString(),
    });

    logger.info('SMS OTP sent for credits verification', {
      userId,
      phoneNumber: fullPhoneNumber.substring(0, 3) + '***' + fullPhoneNumber.slice(-3), // Mask phone number in logs
      otpType: isNumeric ? 'numeric' : 'alphanumeric',
    });

    res.json({
      success: true,
      message: 'OTP sent to your phone number',
      data: {
        expiresIn: 600, // 10 minutes
        rateLimitRemaining: SECURITY_CONFIG.MAX_OTP_ATTEMPTS - (parseInt(await redis.get(otpCountKey) as string) || 0),
      },
    });
  } catch (error) {
    logger.error('Failed to send SMS OTP', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to send OTP. Please try again later.',
    });
  }
};

/**
 * Verify SMS OTP for phone verification
 */
export const verifySmsOtp = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'verifySmsOtp' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Security: Enhanced rate limiting for verification attempts
    const verifyCountKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'verify-count');

    try {
      const currentCount = await redis.get(verifyCountKey);
      const count = currentCount ? parseInt(currentCount as string) : 0;

      if (count >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
        const ttl = await redis.ttl(verifyCountKey);
        const remainingMinutes = Math.ceil(ttl / 60);
        logSecurityEvent('VERIFICATION_RATE_LIMIT_EXCEEDED', userId, { attempts: count, remainingMinutes });
        return res.status(429).json({
          success: false,
          message: `Too many verification attempts. Try again in ${remainingMinutes} minutes.`,
          retryAfter: ttl,
        });
      }

      // Increment count (1 hour window)
      if (count === 0) {
        await redis.setex(verifyCountKey, SECURITY_CONFIG.VERIFICATION_RATE_LIMIT_WINDOW, 1);
      } else {
        await redis.incr(verifyCountKey);
      }
    } catch (redisError) {
      logger.warn('Redis error in OTP verification rate limiting', { userId, error: redisError });
      logSecurityEvent('RATE_LIMITING_FAILURE', userId, { error: redisError });
    }

    // Validate and sanitize input
    const validation = verifySmsOtpSchema.safeParse(req.body);
    if (!validation.success) {
      logSecurityEvent('INVALID_OTP_INPUT', userId, { endpoint: 'verifySmsOtp', errors: validation.error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format',
        errors: validation.error.issues,
      });
    }

    const { otp } = validation.data;

    // Security: Additional input sanitization
    const sanitizedOtp = sanitizeInput(otp);

    // Normalize OTP to uppercase for comparison
    const normalizedOtp = sanitizedOtp.toUpperCase();

    // Get stored OTP data from Redis
    const otpKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'otp');
    let otpDataRaw;

    try {
      otpDataRaw = await redis.get(otpKey);
    } catch (redisError) {
      logger.error('Failed to retrieve SMS OTP from Redis', { userId, error: redisError });
      return res.status(500).json({ success: false, message: 'Verification failed' });
    }

    if (!otpDataRaw) {
      logSecurityEvent('OTP_EXPIRED_OR_MISSING', userId, { endpoint: 'verifySmsOtp' });
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new code.',
        expired: true,
      });
    }

    // Parse OTP data
    let otpData;
    try {
      otpData = typeof otpDataRaw === 'string' ? JSON.parse(otpDataRaw) : otpDataRaw;

      // Validate OTP data structure
      if (!otpData.otpHash || !otpData.userId || typeof otpData.attempts !== 'number') {
        throw new Error('Invalid OTP data structure');
      }
    } catch (parseError) {
      logger.error('Failed to parse OTP data', {
        userId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      await redis.del(otpKey); // Clean up corrupted data
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP data. Please request a new OTP',
      });
    }

    // Check if OTP has been verified too many times (max 5 attempts per OTP)
    if (otpData.attempts >= 5) {
      logger.warn('OTP verification attempts exceeded', { userId });
      await redis.del(otpKey); // Delete the OTP
      return res.status(400).json({
        success: false,
        message: 'OTP expired due to too many attempts',
      });
    }

    // Verify the OTP using constant-time comparison
    let isValidOtp = false;
    try {
      isValidOtp = await bcrypt.compare(normalizedOtp, otpData.otpHash);
    } catch (bcryptError) {
      logger.error('Bcrypt comparison error', {
        userId,
        error: bcryptError instanceof Error ? bcryptError.message : String(bcryptError),
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to verify OTP. Please try again',
      });
    }

    if (!isValidOtp) {
      // Increment OTP-specific verification attempts
      otpData.attempts = (otpData.attempts || 0) + 1;

      try {
        await redis.setex(otpKey, Math.max(60, 900 - (Date.now() - otpData.createdAt) / 1000), JSON.stringify(otpData));
      } catch (updateError) {
        logger.warn('Failed to update OTP attempts', { userId, error: updateError });
      }

      logSecurityEvent('INVALID_OTP_ATTEMPT', userId, { endpoint: 'verifySmsOtp', attempts: otpData.attempts });
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Get phone number from OTP data
    const phoneNumber = otpData.phoneNumber;

    // OTP verified successfully - clean up Redis keys immediately
    const keysToDelete = [
      otpKey,
      generateSecureCacheKey(REDIS_KEYS.OTP_STORE, 'phone_lock', phoneNumber || ''), // Release phone lock
      verifyCountKey, // Reset verification attempt count
    ];

    try {
      await Promise.all(keysToDelete.map(key => key ? redis.del(key) : Promise.resolve(0)));
    } catch (redisError) {
      logger.warn('Failed to delete verification keys from Redis', { userId, error: redisError });
      // Continue even if cleanup fails
    }

    // Save phone number to database (simplified without transaction to avoid timeouts)
    if (phoneNumber) {
      try {
        // Direct update without nested transaction
        const updatedUser = await prisma.user.update({
          where: { userId },
          data: {
            phoneNumber: phoneNumber as string,
            isPhoneVerified: true,
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        logger.info('Phone number saved to database and marked as verified', {
          userId,
          phoneNumber: (phoneNumber as string).substring(0, 5) + '***',
          nowVerified: true, // Since we just set it
        });

        // Send email notification for phone number addition
        try {
          const userName = updatedUser.firstName && updatedUser.lastName
            ? `${updatedUser.firstName} ${updatedUser.lastName}`
            : updatedUser.firstName || updatedUser.lastName || 'User';

          await sendPhoneNumberAddedEmail(updatedUser.email, userName, phoneNumber as string);
          logger.info('Phone number addition email sent', { userId, email: updatedUser.email });
        } catch (emailError) {
          logger.warn('Failed to send phone number addition email', { userId, error: emailError });
          // Don't fail the verification if email fails
        }

        // Send in-app notification for phone verification
        try {
          await inngest.send({
            name: 'notification/send',
            data: {
              userId,
              title: '📱 Phone Number Verified!',
              message: 'Your phone number has been successfully verified.',
              description: 'You can now claim your free credits and use additional security features.',
              actionUrl: '/credits',
              actionLabel: 'Claim Credits',
              metadata: {
                type: 'phone_verification_success',
                phoneNumber: phoneNumber,
              },
            },
          });
          logger.info('In-app notification sent for phone verification', { userId });
        } catch (notificationError) {
          logger.warn('Failed to send in-app notification for phone verification', { userId, error: notificationError });
          // Don't fail the verification if notification fails
        }

        // Invalidate ALL related caches including eligibility and user status
        await invalidateUserCaches(userId);

        // Also invalidate specific cache keys
        const cachesToInvalidate = [
          generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'user_status'),
          generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'eligibility'),
          `${REDIS_KEYS.USER_CREDITS_CACHE}phone_check:${phoneNumber}`,
        ];

        try {
          await Promise.all(cachesToInvalidate.map(key => redis.del(key)));
          logger.info('All verification caches invalidated', { userId });
        } catch (cacheError) {
          logger.warn('Failed to invalidate some caches', { userId, error: cacheError });
        }
      } catch (dbError) {
        logger.error('Failed to save phone number to database', {
          userId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
        });

        // Try one more time with a direct query
        try {
          await prisma.$executeRaw`
            UPDATE "User"
            SET "phoneNumber" = ${phoneNumber as string},
                "isPhoneVerified" = true
            WHERE "userId" = ${userId}
          `;
          logger.info('Phone number saved via raw query', { userId });
          await invalidateUserCaches(userId);

          // Invalidate specific caches after raw query
          const cachesToInvalidate = [
            generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'user_status'),
            generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'eligibility'),
            `${REDIS_KEYS.USER_CREDITS_CACHE}phone_check:${phoneNumber}`,
          ];

          try {
            await Promise.all(cachesToInvalidate.map(key => redis.del(key)));
          } catch (cacheError) {
            logger.warn('Failed to invalidate caches after raw query', { userId, error: cacheError });
          }
        } catch (retryError) {
          logger.error('Retry also failed', { userId, error: retryError });
          // Don't fail the verification - user can verify again later
          // Store in Redis as backup
          const backupKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'verified-phone-backup');
          await redis.setex(backupKey, 86400, phoneNumber as string); // 24 hours

          return res.status(207).json({
            success: true,
            message: 'Phone verified successfully. Database update pending.',
            data: {
              phoneVerified: true,
              verificationExpiresAt: new Date(Date.now() + CACHE_TTL.OTP_VERIFICATION * 1000).toISOString(),
              warning: 'Please proceed to claim credits. Phone number will be saved shortly.',
            },
          });
        }
      }
    } else {
      logger.error('Phone number not found in Redis after OTP verification', { userId });
      return res.status(500).json({
        success: false,
        message: 'Verification data missing. Please try again.',
      });
    }

    // Mark phone as verified for credits claim with enhanced caching
    const verificationKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'sms-credits', 'verified');
    try {
      await redis.setex(verificationKey, CACHE_TTL.OTP_VERIFICATION, 'true');
    } catch (redisError) {
      logger.warn('Failed to store verification status in Redis', { userId, error: redisError });
    }

    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    logger.info('SMS OTP verified for credits claim', {
      userId,
      phoneVerified: !!phoneNumber,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: {
        phoneVerified: true,
        verificationExpiresAt: new Date(Date.now() + CACHE_TTL.OTP_VERIFICATION * 1000).toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to verify SMS OTP', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to verify OTP. Please try again later.',
    });
  }
};

/**
 * Send voice call OTP for phone verification
 */
export const sendVoiceOtp = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'sendVoiceOtp' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate and sanitize input using Zod schema
    const validation = sendSmsOtpSchema.safeParse(req.body);
    if (!validation.success) {
      logSecurityEvent('INVALID_INPUT', userId, { endpoint: 'sendVoiceOtp', errors: validation.error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: validation.error.issues,
      });
    }

    const { phoneNumber, countryCode, isResend } = validation.data;

    // Check if current user already has a verified phone number
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { isPhoneVerified: true, phoneNumber: true },
    });

    if (currentUser?.isPhoneVerified) {
      logSecurityEvent('OTP_REQUEST_FOR_ALREADY_VERIFIED_USER', userId, { endpoint: 'sendVoiceOtp' });
      return res.status(400).json({
        success: false,
        message: 'Your phone number is already verified. Please go ahead and claim your credits.',
        alreadyVerified: true,
      });
    }

    // Check for resend timing restriction (2 minutes minimum between OTP requests)
    const otpTimestampKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'timestamp');
    if (isResend) {
      try {
        const lastOtpTime = await redis.get(otpTimestampKey);
        if (lastOtpTime) {
          const timeSinceLastOtp = Date.now() - parseInt(lastOtpTime as string);
          const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds

          if (timeSinceLastOtp < twoMinutes) {
            const remainingTime = Math.ceil((twoMinutes - timeSinceLastOtp) / 1000);
            logSecurityEvent('RESEND_TOO_SOON', userId, { remainingTime, endpoint: 'sendVoiceOtp' });
            return res.status(429).json({
              success: false,
              message: `Please wait ${remainingTime} seconds before requesting a new code.`,
              retryAfter: remainingTime,
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to check OTP timestamp', { userId, error });
      }
    }

    // Additional security: Check for suspicious patterns
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    if (fullPhoneNumber.length < SECURITY_CONFIG.MIN_PHONE_LENGTH ||
      fullPhoneNumber.length > SECURITY_CONFIG.MAX_PHONE_LENGTH) {
      logSecurityEvent('SUSPICIOUS_PHONE_FORMAT', userId, { phoneLength: fullPhoneNumber.length });
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }

    // Security: Check if phone number contains only allowed characters
    if (!/^\+\d+$/.test(fullPhoneNumber)) {
      logSecurityEvent('MALFORMED_PHONE_NUMBER', userId, { phoneNumber: fullPhoneNumber.substring(0, 3) + '***' });
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }

    // Check for disposable/temporary phone numbers
    const disposableCheck = await checkDisposablePhoneNumber(fullPhoneNumber, userId);
    if (disposableCheck.isDisposable) {
      logSecurityEvent('DISPOSABLE_PHONE_BLOCKED', userId, {
        phoneNumber: fullPhoneNumber.substring(0, 5) + '***',
        reason: disposableCheck.error,
      });
      return res.status(400).json({
        success: false,
        message: disposableCheck.error || 'Temporary or virtual phone numbers are not allowed. Please use a real mobile number.',
        code: 'DISPOSABLE_PHONE',
      });
    }

    // Check if phone number is already verified by another user (with caching)
    const phoneCheckCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, 'phone_check', fullPhoneNumber);
    let existingVerifiedUser = null;

    try {
      const cachedCheck = await redis.get(phoneCheckCacheKey);
      if (typeof cachedCheck === 'string') {
        existingVerifiedUser = JSON.parse(cachedCheck);
      } else {
        existingVerifiedUser = await prisma.user.findFirst({
          where: {
            phoneNumber: fullPhoneNumber,
            isPhoneVerified: true,
            userId: { not: userId }, // Exclude current user
          },
          select: { userId: true },
        });

        // Cache the result for 1 hour
        await redis.setex(phoneCheckCacheKey, 3600, JSON.stringify(existingVerifiedUser));
      }
    } catch (error) {
      logger.warn('Phone verification check failed', { userId, error });
      // Continue without caching if Redis fails
      existingVerifiedUser = await prisma.user.findFirst({
        where: {
          phoneNumber: fullPhoneNumber,
          isPhoneVerified: true,
          userId: { not: userId },
        },
        select: { userId: true },
      });
    }

    if (existingVerifiedUser) {
      logSecurityEvent('DUPLICATE_PHONE_VERIFICATION_ATTEMPT', userId, { existingUserId: existingVerifiedUser.userId });
      return res.status(400).json({
        success: false,
        message: 'This phone number is already verified by another user. Please use a different phone number.',
      });
    }

    // CRITICAL: Check if phone number is currently being verified by another user (race condition prevention)
    const phoneVerificationLockKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, 'phone_lock', fullPhoneNumber);
    let phoneLockOwner = null;

    try {
      phoneLockOwner = await redis.get(phoneVerificationLockKey);
      if (phoneLockOwner && phoneLockOwner !== userId) {
        // Different user is verifying this phone number
        logSecurityEvent('RACE_CONDITION_PHONE_VERIFICATION', userId, {
          phoneNumber: fullPhoneNumber.substring(0, 3) + '***',
          lockOwner: phoneLockOwner,
          message: 'Phone number already being verified by another user'
        });
        return res.status(409).json({
          success: false,
          message: 'This phone number is currently being verified by another user. Please try again in a few minutes or use a different phone number.',
        });
      } else if (phoneLockOwner === userId && isResend) {
        // Same user resending - this is allowed, will overwrite the existing OTP
        logger.info('Same user resending voice OTP - allowed', { userId, phoneNumber: fullPhoneNumber.substring(0, 3) + '***' });
      }
    } catch (error) {
      logger.warn('Phone lock check failed', { userId, error });
    }

    // Check if user already has INITIAL_ALLOCATION credits (with caching)
    const creditCheckCacheKey = generateSecureCacheKey(REDIS_KEYS.USER_CREDITS_CACHE, userId, 'initial_allocation_check');
    let existingInitialAllocation = null;

    try {
      const cachedCheck = await redis.get(creditCheckCacheKey);
      if (cachedCheck !== null) {
        existingInitialAllocation = cachedCheck === 'true';
      } else {
        const transaction = await prisma.creditTransaction.findFirst({
          where: {
            userId,
            type: 'INITIAL_ALLOCATION',
          },
          select: { id: true },
        });
        existingInitialAllocation = !!transaction;

        // Cache the result for 1 hour
        await redis.setex(creditCheckCacheKey, 3600, existingInitialAllocation ? 'true' : 'false');
      }
    } catch (error) {
      logger.warn('Credit allocation check failed', { userId, error });
      // Fallback to direct database check
      const transaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type: 'INITIAL_ALLOCATION',
        },
        select: { id: true },
      });
      existingInitialAllocation = !!transaction;
    }

    if (existingInitialAllocation) {
      logSecurityEvent('DUPLICATE_FREE_CREDITS_ATTEMPT', userId, { endpoint: 'sendVoiceOtp' });
      return res.status(400).json({
        success: false,
        message: 'You have already received free credits. You cannot claim additional free credits.',
      });
    }

    // Store phone number in Redis temporarily with enhanced security and race condition prevention
    const phoneKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'phone');
    try {
      // Use Redis transaction to atomically check and set the phone lock
      const redisTransaction = redis.multi();

      if (phoneLockOwner === userId) {
        // Same user resending - just update the values
        redisTransaction.setex(phoneVerificationLockKey, 3600, userId); // Update lock
        redisTransaction.setex(phoneKey, 3600, fullPhoneNumber); // Update phone number
      } else {
        // New verification attempt - set lock if not exists
        redisTransaction.set(phoneVerificationLockKey, userId, { ex: 3600, nx: true }); // Set lock if not exists
        redisTransaction.setex(phoneKey, 3600, fullPhoneNumber); // Store phone number
      }

      const transactionResults = await redisTransaction.exec();

      if (!transactionResults || (phoneLockOwner !== userId && transactionResults[0] === null)) {
        // Lock was not acquired (already exists) and it's not the same user
        logSecurityEvent('PHONE_LOCK_ACQUISITION_FAILED', userId, {
          phoneNumber: fullPhoneNumber.substring(0, 3) + '***',
          message: 'Failed to acquire phone verification lock - another user is verifying this number'
        });
        return res.status(409).json({
          success: false,
          message: 'This phone number is currently being verified by another user. Please try again in a few minutes.',
        });
      }

      logger.info('Phone verification lock acquired/updated', { userId, phoneNumber: fullPhoneNumber.substring(0, 3) + '***', isResend: !!isResend });
    } catch (redisError) {
      logger.error('Failed to store phone number and acquire lock in Redis', { userId, error: redisError });
      return res.status(500).json({ success: false, message: 'Failed to process request' });
    }

    // Enhanced rate limiting: 3 OTPs per 24 hours with better tracking
    const otpCountKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'count');

    try {
      const currentCount = await redis.get(otpCountKey);
      const count = currentCount ? parseInt(currentCount as string) : 0;

      if (count >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
        const ttl = await redis.ttl(otpCountKey);
        const remainingHours = Math.ceil(ttl / 3600);
        logSecurityEvent('OTP_RATE_LIMIT_EXCEEDED', userId, { attempts: count, remainingHours });
        return res.status(429).json({
          success: false,
          message: `Maximum OTP requests reached. Try again in ${remainingHours} hours.`,
          retryAfter: ttl,
        });
      }

      // Increment count (24 hour window)
      if (count === 0) {
        await redis.setex(otpCountKey, SECURITY_CONFIG.OTP_RATE_LIMIT_WINDOW, 1);
      } else {
        await redis.incr(otpCountKey);
      }
    } catch (redisError) {
      logger.warn('Redis error in voice OTP rate limiting', { userId, error: redisError });
      // Continue without rate limiting if Redis fails, but log it
      logSecurityEvent('RATE_LIMITING_FAILURE', userId, { error: redisError });
    }

    // Generate cryptographically secure OTP
    const crypto = await import('crypto');
    const isNumeric = Math.random() < 0.6;
    let otp: string;

    if (isNumeric) {
      // 6-digit numeric OTP using crypto.randomInt for better security
      otp = crypto.randomInt(100000, 999999).toString();
    } else {
      // 6-12 character alphanumeric OTP
      const length = crypto.randomInt(6, 13); // Random length between 6-12
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      otp = '';
      for (let i = 0; i < length; i++) {
        otp += chars.charAt(crypto.randomInt(0, chars.length));
      }
    }

    // Hash the OTP for secure storage
    let otpHash;
    try {
      otpHash = await bcrypt.hash(otp.toUpperCase(), SECURITY_CONFIG.SALT_ROUNDS);
    } catch (hashError) {
      logger.error('Failed to hash voice OTP', {
        userId,
        error: hashError instanceof Error ? hashError.message : String(hashError),
      });
      return res.status(500).json({ success: false, message: 'Failed to generate OTP' });
    }

    // Store OTP data in Redis with enhanced security
    const otpKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'otp');
    const otpData = {
      userId,
      phoneNumber: fullPhoneNumber,
      otpHash,
      createdAt: Date.now(),
      attempts: 0,
    };

    try {
      await redis.setex(otpKey, 900, JSON.stringify(otpData)); // 15 minutes
      await redis.setex(otpTimestampKey, 900, Date.now().toString()); // Store timestamp for resend validation
    } catch (redisError) {
      logger.error('Failed to store voice OTP in Redis', { userId, error: redisError });
      return res.status(500).json({ success: false, message: 'Failed to generate OTP' });
    }

    // Send voice call via notification service with enhanced logging
    try {
      await inngest.send({
        name: 'credits/send-voice-otp',
        data: {
          userId,
          phoneNumber: fullPhoneNumber,
          otp,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (inngestError) {
      logger.error('Failed to send inngest event for voice OTP', { userId, error: inngestError });
      return res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }

    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    logger.info('Voice OTP sent successfully', {
      userId,
      phoneNumber: fullPhoneNumber.substring(0, 3) + '***',
      otpType: otp.length === 6 && /^\d+$/.test(otp) ? 'numeric' : 'alphanumeric',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Voice call OTP sent successfully. You will receive a call with your verification code.',
      data: {
        otpSent: true,
        expiresIn: 900, // 15 minutes
        otpType: otp.length === 6 && /^\d+$/.test(otp) ? 'numeric' : 'alphanumeric',
      },
    });
  } catch (error) {
    logger.error('Failed to send voice OTP', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to send voice OTP. Please try again later.',
    });
  }
};

/**
 * Verify voice call OTP for phone verification
 */
export const verifyVoiceOtp = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', userId || 'unknown', { endpoint: 'verifyVoiceOtp' });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate and sanitize input using Zod schema
    const validation = verifySmsOtpSchema.safeParse(req.body);
    if (!validation.success) {
      logSecurityEvent('INVALID_INPUT', userId, { endpoint: 'verifyVoiceOtp', errors: validation.error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: validation.error.issues,
      });
    }

    const { otp } = validation.data;

    // Get stored OTP data from Redis
    const otpKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'otp');
    let otpDataRaw;

    try {
      otpDataRaw = await redis.get(otpKey);
    } catch (redisError) {
      logger.error('Failed to retrieve voice OTP from Redis', { userId, error: redisError });
      return res.status(500).json({ success: false, message: 'Verification failed' });
    }

    if (!otpDataRaw) {
      logSecurityEvent('OTP_EXPIRED_OR_MISSING', userId, { endpoint: 'verifyVoiceOtp' });
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new code.',
        expired: true,
      });
    }

    // Parse OTP data
    let otpData;
    try {
      otpData = typeof otpDataRaw === 'string' ? JSON.parse(otpDataRaw) : otpDataRaw;

      // Validate OTP data structure
      if (!otpData.otpHash || !otpData.userId || typeof otpData.attempts !== 'number') {
        throw new Error('Invalid OTP data structure');
      }
    } catch (parseError) {
      logger.error('Failed to parse voice OTP data', {
        userId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      await redis.del(otpKey); // Clean up corrupted data
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP data. Please request a new OTP',
      });
    }

    // Check if OTP has been verified too many times (max 5 attempts per OTP)
    if (otpData.attempts >= 5) {
      logger.warn('Voice OTP verification attempts exceeded', { userId });
      await redis.del(otpKey); // Delete the OTP
      return res.status(400).json({
        success: false,
        message: 'OTP expired due to too many attempts',
      });
    }

    // Verify the OTP using constant-time comparison
    let isValidOtp = false;
    try {
      isValidOtp = await bcrypt.compare(otp.toUpperCase(), otpData.otpHash);
    } catch (bcryptError) {
      logger.error('Bcrypt comparison error for voice OTP', {
        userId,
        error: bcryptError instanceof Error ? bcryptError.message : String(bcryptError),
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to verify OTP. Please try again',
      });
    }

    if (!isValidOtp) {
      // Increment OTP-specific verification attempts
      otpData.attempts = (otpData.attempts || 0) + 1;

      try {
        await redis.setex(otpKey, Math.max(60, 900 - (Date.now() - otpData.createdAt) / 1000), JSON.stringify(otpData));
      } catch (updateError) {
        logger.warn('Failed to update voice OTP attempts', { userId, error: updateError });
      }

      logSecurityEvent('INVALID_VOICE_OTP_ATTEMPT', userId, { endpoint: 'verifyVoiceOtp', attempts: otpData.attempts });
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // OTP is valid - clean up Redis keys and update user
    const phoneNumber = otpData.phoneNumber;

    // Clean up Redis keys
    const keysToDelete = [
      otpKey,
      generateSecureCacheKey(REDIS_KEYS.OTP_STORE, 'phone_lock', phoneNumber || ''), // Release phone lock
      generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'timestamp'),
      generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'count'),
    ];

    try {
      await Promise.all(keysToDelete.map(key => key ? redis.del(key) : Promise.resolve(0)));
    } catch (redisError) {
      logger.warn('Failed to clean up Redis keys after voice OTP verification', { userId, error: redisError });
    }

    // Update user with phone verification if phone number was stored
    if (phoneNumber) {
      try {
        const updatedUser = await prisma.user.update({
          where: { userId },
          data: {
            phoneNumber: phoneNumber as string,
            isPhoneVerified: true,
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        logger.info('User phone number verified and updated in database', { userId, phoneNumber: (phoneNumber as string).substring(0, 3) + '***' });

        // Send email notification for phone number addition
        try {
          const userName = updatedUser.firstName && updatedUser.lastName
            ? `${updatedUser.firstName} ${updatedUser.lastName}`
            : updatedUser.firstName || updatedUser.lastName || 'User';

          await sendPhoneNumberAddedEmail(updatedUser.email, userName, phoneNumber as string);
          logger.info('Phone number addition email sent', { userId, email: updatedUser.email });
        } catch (emailError) {
          logger.warn('Failed to send phone number addition email', { userId, error: emailError });
          // Don't fail the verification if email fails
        }

        // Send in-app notification for phone verification
        try {
          await inngest.send({
            name: 'notification/send',
            data: {
              userId,
              title: '📱 Phone Number Verified!',
              message: 'Your phone number has been successfully verified.',
              description: 'You can now claim your free credits and use additional security features.',
              actionUrl: '/credits',
              actionLabel: 'Claim Credits',
              metadata: {
                type: 'phone_verification_success',
                phoneNumber: phoneNumber,
              },
            },
          });
          logger.info('In-app notification sent for phone verification', { userId });
        } catch (notificationError) {
          logger.warn('Failed to send in-app notification for phone verification', { userId, error: notificationError });
          // Don't fail the verification if notification fails
        }
      } catch (dbError) {
        logger.error('Failed to update user phone verification in database', { userId, error: dbError });

        // Store in Redis as backup for 24 hours
        const backupKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'verified-phone-backup');
        try {
          await redis.setex(backupKey, 86400, phoneNumber as string); // 24 hours
        } catch (redisError) {
          logger.error('Failed to store phone verification backup in Redis', { userId, error: redisError });
        }

        return res.status(207).json({
          success: true,
          message: 'Phone verified successfully. Database update pending.',
          data: {
            phoneVerified: true,
            verificationExpiresAt: new Date(Date.now() + CACHE_TTL.OTP_VERIFICATION * 1000).toISOString(),
            warning: 'Please proceed to claim credits. Phone number will be saved shortly.',
          },
        });
      }
    } else {
      logger.error('Phone number not found in Redis after voice OTP verification', { userId });
      return res.status(500).json({
        success: false,
        message: 'Verification data missing. Please try again.',
      });
    }

    // Mark phone as verified for credits claim with enhanced caching
    const verificationKey = generateSecureCacheKey(REDIS_KEYS.OTP_STORE, userId, 'voice-credits', 'verified');
    try {
      await redis.setex(verificationKey, CACHE_TTL.OTP_VERIFICATION, 'true');
    } catch (redisError) {
      logger.warn('Failed to store verification status in Redis', { userId, error: redisError });
    }

    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    logger.info('Voice OTP verified for credits claim', {
      userId,
      phoneVerified: !!phoneNumber,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: {
        phoneVerified: true,
        verificationExpiresAt: new Date(Date.now() + CACHE_TTL.OTP_VERIFICATION * 1000).toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to verify voice OTP', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });

    // Security: Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Unable to verify OTP. Please try again later.',
    });
  }
};
