import { ENV } from './env.js';

/**
 * Centralized security configuration for the application
 */

// CSRF Protection Configuration
export const CSRF_CONFIG = {
    tokenLength: 32, // bytes
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
    cookieOptions: {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        ...(ENV.NODE_ENV === 'production' && ENV.COOKIE_DOMAIN ? {
            domain: ENV.COOKIE_DOMAIN,
        } : {}),
    },
    // Routes that don't require CSRF protection
    exemptPaths: [
        '/api/v1/payments/webhook',
        '/api/inngest',
        '/healthz',
        '/api/v1/auth/refresh',
        '/metrics',
        '/.well-known',
    ],
    // Safe HTTP methods that don't require CSRF protection
    safeMethods: ['GET', 'HEAD', 'OPTIONS'],
};

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
    // Global rate limits
    global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests per window per IP
    },
    // Authentication endpoints
    auth: {
        register: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5,
        },
        login: {
            windowMs: 60 * 1000, // 1 minute
            max: 10,
        },
        passwordReset: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3,
        },
        refresh: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 60,
        },
        mfaVerify: {
            windowMs: 60 * 1000, // 1 minute
            max: 5,
        },
    },
    // API endpoints
    api: {
        default: {
            windowMs: 60 * 1000, // 1 minute
            max: 60,
        },
        search: {
            windowMs: 60 * 1000, // 1 minute
            max: 30,
        },
        upload: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 20,
        },
    },
};

// Session Security Configuration
export const SESSION_CONFIG = {
    absoluteTimeout: 24 * 60 * 60 * 1000, // 24 hours
    idleTimeout: 30 * 60 * 1000, // 30 minutes
    maxConcurrentSessions: 5,
    fingerprintSecret: ENV.SESSION_FINGERPRINT_SECRET || ENV.JWT_SECRET,
    // Session anomaly detection thresholds
    anomalyDetection: {
        maxLocationChanges: 3, // per day
        maxDeviceChanges: 2, // per day
        suspiciousActivityThreshold: 5, // failed attempts
    },
};

// Request Validation Configuration
export const REQUEST_VALIDATION_CONFIG = {
    maxJsonSize: '100kb',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
    allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain',
    ],
    // File upload restrictions
    allowedFileTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/csv',
    ],
    maxFileNameLength: 255,
};

// Security Headers Configuration
export const SECURITY_HEADERS_CONFIG = {
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
    csp: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline for Swagger UI
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            fontSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
        },
    },
    permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
    },
};

// Input Sanitization Configuration
export const SANITIZATION_CONFIG = {
    // Dangerous patterns to detect
    sqlInjectionPatterns: [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
        /(--|\;|\/\*|\*\/)/g,
        /(\bOR\b.*=.*)/gi,
        /(\bAND\b.*=.*)/gi,
        /(\bUNION\b.*\bSELECT\b)/gi,
    ],
    xssPatterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<embed\b[^>]*>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    ],
    pathTraversalPatterns: [
        /\.\.\//g,
        /\.\.\\/g,
        /%2e%2e%2f/gi,
        /%2e%2e\\/gi,
    ],
    commandInjectionPatterns: [
        /[;&|`$()]/g,
        /\n/g,
        /\r/g,
    ],
    // Allowed characters for different input types
    allowedPatterns: {
        alphanumeric: /^[a-zA-Z0-9]+$/,
        alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        slug: /^[a-z0-9-]+$/,
        uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    },
};

// API Security Configuration
export const API_SECURITY_CONFIG = {
    requestSigning: {
        algorithm: 'sha256',
        timestampWindow: 5 * 60 * 1000, // 5 minutes
        nonceExpiry: 10 * 60 * 1000, // 10 minutes
    },
    apiKey: {
        prefix: 'fa_',
        length: 32,
        rotationPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    },
};

// Intrusion Detection Configuration
export const INTRUSION_DETECTION_CONFIG = {
    // Thresholds for automatic blocking
    thresholds: {
        sqlInjectionAttempts: 3,
        xssAttempts: 3,
        pathTraversalAttempts: 3,
        bruteForceAttempts: 10,
        rateLimitViolations: 5,
    },
    // Block duration in milliseconds
    blockDuration: {
        temporary: 15 * 60 * 1000, // 15 minutes
        extended: 24 * 60 * 60 * 1000, // 24 hours
        permanent: 365 * 24 * 60 * 60 * 1000, // 1 year
    },
    // Honeypot endpoints
    honeypotPaths: [
        '/admin',
        '/wp-admin',
        '/phpmyadmin',
        '/.env',
        '/.git',
    ],
    // Paths excluded from intrusion detection (e.g. system endpoints, AI streams)
    excludedPaths: [
        '/api/inngest',
        '/api/v1/ai/stream',
        '/api/v1/webhooks',
    ],
};


// Export all configurations
export const SECURITY_CONFIG = {
    csrf: CSRF_CONFIG,
    rateLimit: RATE_LIMIT_CONFIG,
    session: SESSION_CONFIG,
    requestValidation: REQUEST_VALIDATION_CONFIG,
    securityHeaders: SECURITY_HEADERS_CONFIG,
    sanitization: SANITIZATION_CONFIG,
    apiSecurity: API_SECURITY_CONFIG,
    intrusionDetection: INTRUSION_DETECTION_CONFIG,
};
