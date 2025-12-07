import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  browserName?: string;
  browserVersion?: string;
}

export interface DeviceFingerprint {
  userAgent: string;
  ip: string;
  acceptLanguage?: string;
  screenResolution?: string;
  timezone?: string;
  platform?: string;
}

/**
 * Generate a unique device ID based on device characteristics
 */
export function generateDeviceId(fingerprint: DeviceFingerprint): string {
  const components = [
    fingerprint.userAgent,
    fingerprint.ip,
    fingerprint.acceptLanguage || '',
    fingerprint.screenResolution || '',
    fingerprint.timezone || '',
    fingerprint.platform || '',
  ];

  // Create a hash-like string from components
  const fingerprintString = components.join('|');
  const hash = Buffer.from(fingerprintString).toString('base64').substring(0, 32);

  return `device_${hash}`;
}

/**
 * Extract device information from request headers and user agent
 */
export function extractDeviceInfo(req: Request, clientDeviceId?: string): DeviceInfo {
  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Generate or use provided device ID
  const deviceId =
    clientDeviceId ||
    generateDeviceId({
      userAgent,
      ip: req.ip || req.socket.remoteAddress || '',
      acceptLanguage: req.headers['accept-language'],
      platform: result.os.name,
      timezone: req.headers['x-timezone'] as string,
    });

  // Determine device name
  let deviceName = 'Unknown Device';
  if (result.device.vendor && result.device.model) {
    deviceName = `${result.device.vendor} ${result.device.model}`;
  } else if (result.browser.name && result.os.name) {
    deviceName = `${result.browser.name} on ${result.os.name}`;
  }

  return {
    deviceId,
    deviceName,
    deviceType: result.device.type || 'desktop',
    platform: result.os.name,
    osVersion: result.os.version,
    browserName: result.browser.name,
    browserVersion: result.browser.version,
  };
}

/**
 * Check if a device is mobile
 */
export function isMobileDevice(deviceInfo: DeviceInfo): boolean {
  return deviceInfo.deviceType === 'mobile' || deviceInfo.deviceType === 'tablet';
}

/**
 * Get device priority for notification routing
 * Higher priority = send notifications here first
 */
export function getDevicePriority(deviceInfo: DeviceInfo, lastUsedAt: Date): number {
  let priority = 0;

  // Recently used devices get higher priority
  const hoursSinceLastUse = (Date.now() - lastUsedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastUse < 1)
    priority += 10; // Used in last hour
  else if (hoursSinceLastUse < 24)
    priority += 5; // Used in last day
  else if (hoursSinceLastUse < 168) priority += 2; // Used in last week

  // Mobile devices get higher priority
  if (isMobileDevice(deviceInfo)) priority += 3;

  return priority;
}
