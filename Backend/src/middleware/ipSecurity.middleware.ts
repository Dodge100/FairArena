import { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env.js';
import { redis } from '../config/redis.js';
import { IP_SECURITY_CONFIG } from '../config/security.config.js';
import logger from '../utils/logger.js';
import { logSecurityEvent, SecurityEventType } from '../utils/securityLogger.js';

/**
 * IPRegistry API Response Interface
 */
interface IPRegistryResponse {
  ip: string;
  security?: {
    is_proxy?: boolean;
    is_tor?: boolean;
    is_vpn?: boolean;
    is_crawler?: boolean;
    is_threat?: boolean;
    is_relay?: boolean;
    is_bogon?: boolean;
    is_datacenter?: boolean;
    threat_types?: string[];
  };
  company?: {
    type?: string;
    name?: string;
    domain?: string;
  };
  location?: {
    country?: {
      name?: string;
      code?: string;
    };
    city?: string;
  };
}

/**
 * Cached IP Security Result
 */
interface CachedIPResult {
  ip: string;
  isBlocked: boolean;
  reasons: string[];
  timestamp: number;
  location?: string;
}

/**
 * Configuration for IP security
 */
// Local config removed in favor of shared config

/**
 * Fetch IP security data from IPRegistry with error handling
 */
async function fetchIPSecurityData(ip: string): Promise<IPRegistryResponse | null> {
  const apiKey = ENV.IPREGISTRY_API_KEY;

  if (!apiKey) {
    logger.warn('IPREGISTRY_API_KEY not configured - IP security checks disabled');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `https://api.ipregistry.co/${ip}?key=${apiKey}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error('IPRegistry API error', {
        status: response.status,
        statusText: response.statusText,
        ip,
      });
      return null;
    }

    const data = await response.json() as IPRegistryResponse;
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.error('IPRegistry API timeout', { ip });
      } else {
        logger.error('IPRegistry API request failed', {
          error: error.message,
          ip,
        });
      }
    }
    return null;
  }
}

/**
 * Analyze IP security data and determine if it should be blocked
 */
function analyzeIPSecurity(data: IPRegistryResponse): CachedIPResult {
  const reasons: string[] = [];
  const { security, company } = data;

  // Perform security checks
  if (IP_SECURITY_CONFIG.checks.proxy && security?.is_proxy) {
    reasons.push('Proxy detected');
  }

  if (IP_SECURITY_CONFIG.checks.tor && security?.is_tor) {
    reasons.push('Tor network detected');
  }

  if (IP_SECURITY_CONFIG.checks.vpn && security?.is_vpn) {
    reasons.push('VPN detected');
  }

  if (IP_SECURITY_CONFIG.checks.crawler && security?.is_crawler) {
    reasons.push('Bot or crawler detected');
  }

  if (IP_SECURITY_CONFIG.checks.threat && security?.is_threat) {
    reasons.push('Known threat actor IP');
  }

  if (IP_SECURITY_CONFIG.checks.relay && security?.is_relay) {
    reasons.push('Relay/Anonymizer network detected');
  }

  if (IP_SECURITY_CONFIG.checks.bogon && security?.is_bogon) {
    reasons.push('Bogon IP (non-routable)');
  }

  if (IP_SECURITY_CONFIG.checks.datacenter && security?.is_datacenter) {
    reasons.push('Cloud provider or VM environment');
  }

  if (IP_SECURITY_CONFIG.checks.automation && security?.threat_types?.includes('automation')) {
    reasons.push('Automation tools detected');
  }

  if (IP_SECURITY_CONFIG.checks.hosting && company?.type === 'hosting') {
    reasons.push('Hosting provider IP');
  }

  // Check for specific cloud providers
  if (company?.name?.toLowerCase().includes('aws')) {
    reasons.push('AWS server');
  }

  if (company?.domain?.includes('digitalocean')) {
    reasons.push('DigitalOcean server');
  }

  // Build location string
  const location = data.location?.city
    ? `${data.location.city}, ${data.location.country?.name || 'Unknown'}`
    : data.location?.country?.name || 'Unknown';

  return {
    ip: data.ip,
    isBlocked: reasons.length > 0,
    reasons,
    timestamp: Date.now(),
    location,
  };
}

/**
 * Get IP security result from cache or fetch from API
 */
async function getIPSecurityResult(ip: string): Promise<CachedIPResult | null> {
  const cacheKey = `${IP_SECURITY_CONFIG.cacheKeyPrefix}${ip}`;

  try {
    // Try to get from cache first
    const cached = await redis.get(cacheKey);

    if (cached) {
      const result = JSON.parse(cached as string) as CachedIPResult;
      logger.debug('IP security result from cache', { ip, isBlocked: result.isBlocked });
      return result;
    }

    // Not in cache - fetch from API
    logger.debug('Fetching IP security data from IPRegistry', { ip });
    const data = await fetchIPSecurityData(ip);

    if (!data) {
      // API failed - allow request but don't cache
      return null;
    }

    // Analyze the data
    const result = analyzeIPSecurity(data);

    // Cache the result for 24 hours
    await redis.setex(
      cacheKey,
      IP_SECURITY_CONFIG.cacheTTL,
      JSON.stringify(result)
    );

    logger.info('IP security result cached', {
      ip,
      isBlocked: result.isBlocked,
      reasons: result.reasons,
      location: result.location,
    });

    return result;
  } catch (error) {
    logger.error('Error getting IP security result', {
      error: error instanceof Error ? error.message : String(error),
      ip,
    });
    return null;
  }
}

/**
 * Create HTML blocked overlay response
 */
function createBlockedOverlay(title: string, messages: string[]): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Blocked - FairArena</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      color: white;
    }
    h1 {
      font-size: 28px;
      color: #1a202c;
      margin-bottom: 16px;
      font-weight: 700;
    }
    .message {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .reasons {
      background: #f7fafc;
      border-left: 4px solid #f5576c;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    }
    .reasons h2 {
      font-size: 14px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .reasons ul {
      list-style: none;
      padding: 0;
    }
    .reasons li {
      color: #4a5568;
      font-size: 14px;
      padding: 6px 0;
      padding-left: 24px;
      position: relative;
    }
    .reasons li:before {
      content: "•";
      color: #f5576c;
      font-weight: bold;
      position: absolute;
      left: 8px;
    }
    .suggestions {
      background: #edf2f7;
      border-left: 4px solid #4299e1;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    }
    .suggestions h2 {
      font-size: 14px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .suggestions ul {
      list-style: none;
      padding: 0;
    }
    .suggestions li {
      color: #4a5568;
      font-size: 14px;
      padding: 6px 0;
      padding-left: 24px;
      position: relative;
    }
    .suggestions li:before {
      content: "→";
      color: #4299e1;
      font-weight: bold;
      position: absolute;
      left: 8px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      color: #718096;
      font-size: 13px;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🛡️</div>
    <h1>${title}</h1>
    <p class="message">
      Our security system has detected unusual activity from your connection.
      Access has been temporarily restricted to protect our platform.
    </p>

    <div class="reasons">
      <h2>Security Flags Detected</h2>
      <ul>
        ${messages.filter(m => !m.startsWith('•') && m !== 'Suggestions:').map(m => `<li>${m}</li>`).join('')}
      </ul>
    </div>

    <div class="suggestions">
      <h2>How to Resolve This</h2>
      <ul>
        <li>Disable VPN or proxy if active</li>
        <li>Avoid using Tor or anonymous browsers</li>
        <li>Ensure your browser is not flagged as an automation tool</li>
        <li>Try using a standard, residential network</li>
        <li>Clear your browser cache and cookies</li>
      </ul>
    </div>

    <div class="footer">
      If you believe this is an error, please contact our support team at
      <a href="mailto:support@fairarena.app">support@fairarena.app</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export const ipSecurityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if IP security is enabled
  if (!IP_SECURITY_CONFIG.enabled) {
    return next();
  }

  try {
    // Extract IP address
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || 'unknown';

    // Skip check for unknown IPs
    if (ip === 'unknown') {
      return next();
    }

    // Whitelist localhost in development
    if (ENV.NODE_ENV === 'development' && IP_SECURITY_CONFIG.devWhitelist.includes(ip)) {
      return next();
    }

    // Get security result (from cache or API)
    const result = await getIPSecurityResult(ip);

    // If API failed or no result, allow request (fail open)
    if (!result) {
      return next();
    }

    // If IP is blocked, return blocked overlay
    if (result.isBlocked) {
      logSecurityEvent(
        SecurityEventType.IP_BLOCKED,
        'IP blocked by security middleware',
        {
          ip,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          details: {
            reasons: result.reasons,
            location: result.location,
          },
        }
      );

      res.status(403).send(
        createBlockedOverlay(
          'Your request has been blocked due to security policy violations.',
          result.reasons
        )
      );
      return;
    }

    // IP is clean - allow request
    next();
  } catch (error) {
    logger.error('Error in IP security middleware', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
    });

    // Fail open - allow request on error
    next();
  }
};

/**
 * Utility function to manually check an IP (for testing/admin purposes)
 */
export async function checkIP(ip: string): Promise<CachedIPResult | null> {
  return getIPSecurityResult(ip);
}

/**
 * Utility function to clear IP cache (for testing/admin purposes)
 */
export async function clearIPCache(ip: string): Promise<void> {
  const cacheKey = `${IP_SECURITY_CONFIG.cacheKeyPrefix}${ip}`;
  await redis.del(cacheKey);
  logger.info('IP cache cleared', { ip });
}
