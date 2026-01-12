import { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env.js';
import { redis } from '../config/redis.js';
import { INTRUSION_DETECTION_CONFIG } from '../config/security.config.js';
import logger from '../utils/logger.js';
import {
    detectCommandInjection,
    detectPathTraversal,
    detectSqlInjection,
    detectXss,
} from '../utils/sanitization.utils.js';
import { logInjectionAttempt, logSecurityEvent, SecurityEventType } from '../utils/securityLogger.js';

/**
 * Track violations for an IP address
 */
async function trackViolation(
    ip: string,
    violationType: string,
    threshold: number,
    blockDuration: number
): Promise<boolean> {
    const key = `intrusion:${violationType}:${ip}`;
    const blockKey = `blocked:${ip}`;

    // Whitelist localhost in development
    if (ENV.NODE_ENV === 'development' && (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost')) {
        return false;
    }

    try {
        // Check if IP is already blocked
        const isBlocked = await redis.get(blockKey);
        if (isBlocked) {
            return true;
        }

        // Increment violation count
        const count = await redis.incr(key);

        // Set expiry on first violation (1 hour window)
        if (count === 1) {
            await redis.expire(key, 3600);
        }

        // Check if threshold exceeded
        if (count >= threshold) {
            // Block the IP
            await redis.setex(blockKey, Math.floor(blockDuration / 1000), '1');

            logSecurityEvent(
                SecurityEventType.IP_BLOCKED,
                `IP blocked due to ${violationType} violations`,
                {
                    ip,
                    details: {
                        violationType,
                        count,
                        blockDuration: blockDuration / 1000,
                    }
                }
            );

            return true;
        }

        return false;
    } catch (error) {
        logger.error('Error tracking violation', {
            error: error instanceof Error ? error.message : String(error),
            ip,
            violationType,
        });
        return false;
    }
}

/**
 * Middleware to detect and block intrusion attempts
 */
export const intrusionDetection = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

        // Whitelist localhost in development to prevent self-blocking
        if (ENV.NODE_ENV === 'development' && (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost')) {
            return next();
        }

        // Check if IP is blocked
        const blockKey = `blocked:${ip}`;
        const isBlocked = await redis.get(blockKey);

        if (isBlocked) {
            logSecurityEvent(
                SecurityEventType.IP_BLOCKED,
                'Blocked IP attempted access',
                {
                    ip,
                    path: req.path,
                    method: req.method,
                }
            );

            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'Your IP has been temporarily blocked due to suspicious activity',
                code: 'IP_BLOCKED',
            });
        }

        // Check for honeypot paths
        if (INTRUSION_DETECTION_CONFIG.honeypotPaths.some((path) => req.path.startsWith(path))) {
            logSecurityEvent(
                SecurityEventType.HONEYPOT_TRIGGERED,
                'Honeypot endpoint accessed',
                {
                    ip,
                    path: req.path,
                    method: req.method,
                    userAgent: req.headers['user-agent'],
                }
            );

            // Block IP immediately for honeypot access
            await redis.setex(
                blockKey,
                Math.floor(INTRUSION_DETECTION_CONFIG.blockDuration.extended / 1000),
                '1'
            );

            return res.status(404).json({
                success: false,
                error: 'Not found',
                message: 'The requested resource was not found',
            });
        }

        // Scan request for injection attempts
        const scanValue = (value: any, type: string): boolean => {
            if (typeof value === 'string') {
                let detected = false;
                let detectionType = '';

                if (detectSqlInjection(value)) {
                    detected = true;
                    detectionType = 'sql';
                } else if (detectXss(value)) {
                    detected = true;
                    detectionType = 'xss';
                } else if (detectPathTraversal(value)) {
                    detected = true;
                    detectionType = 'path';
                } else if (detectCommandInjection(value)) {
                    detected = true;
                    detectionType = 'command';
                }

                if (detected) {
                    logInjectionAttempt(detectionType, {
                        ip,
                        path: req.path,
                        method: req.method,
                        details: { value: value.substring(0, 100) },
                    });

                    // Track violation
                    const threshold = INTRUSION_DETECTION_CONFIG.thresholds[
                        `${detectionType}InjectionAttempts` as keyof typeof INTRUSION_DETECTION_CONFIG.thresholds
                    ] || INTRUSION_DETECTION_CONFIG.thresholds.sqlInjectionAttempts;

                    trackViolation(
                        ip,
                        `${detectionType}_injection`,
                        threshold,
                        INTRUSION_DETECTION_CONFIG.blockDuration.temporary
                    ).catch(() => { });

                    return true;
                }
            } else if (typeof value === 'object' && value !== null) {
                for (const key in value) {
                    if (scanValue(value[key], type)) {
                        return true;
                    }
                }
            }

            return false;
        };

        // Check if path is excluded from scan
        const isExcluded = INTRUSION_DETECTION_CONFIG.excludedPaths.some((path) =>
            req.path.startsWith(path)
        );

        // Scan query, params, and body if not excluded
        if (
            !isExcluded &&
            (scanValue(req.query, 'query') ||
                scanValue(req.params, 'params') ||
                scanValue(req.body, 'body'))
        ) {
            logSecurityEvent(
                SecurityEventType.SUSPICIOUS_PATTERN,
                'Suspicious pattern detected in request',
                {
                    ip,
                    path: req.path,
                    method: req.method,
                }
            );

            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'Potentially malicious input detected',
                code: 'SUSPICIOUS_PATTERN',
            });
        }

        next();
    } catch (error) {
        logger.error('Error in intrusion detection middleware', {
            error: error instanceof Error ? error.message : String(error),
        });
        // Fail open - allow request to proceed
        next();
    }
};

/**
 * Middleware to track failed authentication attempts
 */
export const trackAuthFailures = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

    // Store original send function
    const originalSend = res.send;

    // Override send to check response
    res.send = function (body: any): Response {
        // Check if this is an auth failure (401 status)
        if (res.statusCode === 401) {
            trackViolation(
                ip,
                'auth_failure',
                INTRUSION_DETECTION_CONFIG.thresholds.bruteForceAttempts,
                INTRUSION_DETECTION_CONFIG.blockDuration.temporary
            ).catch(() => { });
        }

        // Call original send
        return originalSend.call(this, body);
    };

    next();
};
