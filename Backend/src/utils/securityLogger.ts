import winston from 'winston';
import { ENV } from '../config/env.js';

/**
 * Security-specific logger for tracking security events
 * Separate from the main application logger for better monitoring
 */

const securityLogger = winston.createLogger({
    level: ENV.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'security',
        environment: ENV.NODE_ENV,
    },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                    return `${timestamp} [SECURITY] ${level}: ${message} ${metaStr}`;
                })
            ),
        }),
    ],
});

// Add file transport for production
if (ENV.NODE_ENV === 'production') {
    securityLogger.add(
        new winston.transports.File({
            filename: 'logs/security-error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 10,
        })
    );

    securityLogger.add(
        new winston.transports.File({
            filename: 'logs/security.log',
            maxsize: 10485760, // 10MB
            maxFiles: 10,
        })
    );
}

/**
 * Security event types
 */
export enum SecurityEventType {
    // Authentication events
    LOGIN_SUCCESS = 'LOGIN_SUCCESS',
    LOGIN_FAILURE = 'LOGIN_FAILURE',
    LOGOUT = 'LOGOUT',
    TOKEN_REFRESH = 'TOKEN_REFRESH',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    SESSION_INVALID = 'SESSION_INVALID',

    // Authorization events
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    FORBIDDEN_ACCESS = 'FORBIDDEN_ACCESS',
    PERMISSION_DENIED = 'PERMISSION_DENIED',

    // MFA events
    MFA_CHALLENGE = 'MFA_CHALLENGE',
    MFA_SUCCESS = 'MFA_SUCCESS',
    MFA_FAILURE = 'MFA_FAILURE',

    // Rate limiting events
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    RATE_LIMIT_WARNING = 'RATE_LIMIT_WARNING',

    // CSRF events
    CSRF_TOKEN_MISSING = 'CSRF_TOKEN_MISSING',
    CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
    CSRF_TOKEN_VALIDATED = 'CSRF_TOKEN_VALIDATED',

    // Injection attack attempts
    SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
    XSS_ATTEMPT = 'XSS_ATTEMPT',
    PATH_TRAVERSAL_ATTEMPT = 'PATH_TRAVERSAL_ATTEMPT',
    COMMAND_INJECTION_ATTEMPT = 'COMMAND_INJECTION_ATTEMPT',
    NOSQL_INJECTION_ATTEMPT = 'NOSQL_INJECTION_ATTEMPT',

    // Session events
    SESSION_CREATED = 'SESSION_CREATED',
    SESSION_DESTROYED = 'SESSION_DESTROYED',
    SESSION_ANOMALY = 'SESSION_ANOMALY',
    CONCURRENT_SESSION_LIMIT = 'CONCURRENT_SESSION_LIMIT',

    // API security events
    API_KEY_INVALID = 'API_KEY_INVALID',
    API_KEY_EXPIRED = 'API_KEY_EXPIRED',
    REQUEST_SIGNATURE_INVALID = 'REQUEST_SIGNATURE_INVALID',
    REPLAY_ATTACK_DETECTED = 'REPLAY_ATTACK_DETECTED',

    // Intrusion detection
    SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
    IP_BLOCKED = 'IP_BLOCKED',
    HONEYPOT_TRIGGERED = 'HONEYPOT_TRIGGERED',

    // Account security
    PASSWORD_CHANGED = 'PASSWORD_CHANGED',
    EMAIL_CHANGED = 'EMAIL_CHANGED',
    ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
    ACCOUNT_DELETED = 'ACCOUNT_DELETED',

    // General security
    SECURITY_SCAN = 'SECURITY_SCAN',
    CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',
}

/**
 * Security event metadata interface
 */
export interface SecurityEventMeta {
    userId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    error?: string;
    details?: Record<string, any>;
}

/**
 * Log a security event
 */
export function logSecurityEvent(
    eventType: SecurityEventType,
    message: string,
    meta?: SecurityEventMeta
) {
    const level = getLogLevel(eventType);

    securityLogger.log(level, message, {
        eventType,
        timestamp: new Date().toISOString(),
        ...meta,
    });
}

/**
 * Get log level based on event type
 */
function getLogLevel(eventType: SecurityEventType): string {
    const errorEvents = [
        SecurityEventType.SQL_INJECTION_ATTEMPT,
        SecurityEventType.XSS_ATTEMPT,
        SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
        SecurityEventType.COMMAND_INJECTION_ATTEMPT,
        SecurityEventType.NOSQL_INJECTION_ATTEMPT,
        SecurityEventType.REPLAY_ATTACK_DETECTED,
        SecurityEventType.HONEYPOT_TRIGGERED,
        SecurityEventType.IP_BLOCKED,
    ];

    const warnEvents = [
        SecurityEventType.LOGIN_FAILURE,
        SecurityEventType.UNAUTHORIZED_ACCESS,
        SecurityEventType.FORBIDDEN_ACCESS,
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecurityEventType.CSRF_TOKEN_INVALID,
        SecurityEventType.SESSION_ANOMALY,
        SecurityEventType.API_KEY_INVALID,
        SecurityEventType.REQUEST_SIGNATURE_INVALID,
        SecurityEventType.SUSPICIOUS_PATTERN,
    ];

    if (errorEvents.includes(eventType)) {
        return 'error';
    } else if (warnEvents.includes(eventType)) {
        return 'warn';
    } else {
        return 'info';
    }
}

/**
 * Helper functions for common security events
 */

export function logLoginAttempt(success: boolean, meta: SecurityEventMeta) {
    logSecurityEvent(
        success ? SecurityEventType.LOGIN_SUCCESS : SecurityEventType.LOGIN_FAILURE,
        success ? 'User logged in successfully' : 'Login attempt failed',
        meta
    );
}

export function logRateLimitViolation(meta: SecurityEventMeta) {
    logSecurityEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded',
        meta
    );
}

export function logCsrfViolation(meta: SecurityEventMeta) {
    logSecurityEvent(
        SecurityEventType.CSRF_TOKEN_INVALID,
        'CSRF token validation failed',
        meta
    );
}

export function logInjectionAttempt(type: string, meta: SecurityEventMeta) {
    const eventTypeMap: Record<string, SecurityEventType> = {
        sql: SecurityEventType.SQL_INJECTION_ATTEMPT,
        xss: SecurityEventType.XSS_ATTEMPT,
        path: SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
        command: SecurityEventType.COMMAND_INJECTION_ATTEMPT,
        nosql: SecurityEventType.NOSQL_INJECTION_ATTEMPT,
    };

    logSecurityEvent(
        eventTypeMap[type] || SecurityEventType.SUSPICIOUS_PATTERN,
        `${type.toUpperCase()} injection attempt detected`,
        meta
    );
}

export function logSessionAnomaly(reason: string, meta: SecurityEventMeta) {
    logSecurityEvent(
        SecurityEventType.SESSION_ANOMALY,
        `Session anomaly detected: ${reason}`,
        meta
    );
}

export function logUnauthorizedAccess(meta: SecurityEventMeta) {
    logSecurityEvent(
        SecurityEventType.UNAUTHORIZED_ACCESS,
        'Unauthorized access attempt',
        meta
    );
}

export default securityLogger;
