/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';

// Configure authenticator with wider window for real-world clock drift
authenticator.options = {
  digits: 6,
  step: 30,
  window: 3, // ±90 seconds tolerance - fixes most sync issues without hacks [web:19][web:24]
  crypto, // Use Node's crypto for consistency
};

// Encryption key - MUST be 32-byte env var in production (no fallback!)
function getEncryptionKey(): Buffer {
  const envKey = ENV.MFA_ENCRYPTION_KEY;
  if (!envKey || envKey.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be set (32+ bytes) in production');
  }
  return Buffer.from(envKey.slice(0, 32), 'utf8');
}

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 12; // GCM recommends 12 bytes [web:21]

/** Encrypt a string using AES-256-GCM */
export function encryptSecret(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/** Decrypt a string using AES-256-GCM */
export function decryptSecret(encryptedData: string): string {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', { error });
    throw new Error('Invalid or tampered secret');
  }
}

/** Generate a new TOTP secret */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/** Generate encrypted TOTP secret for storage */
export function generateEncryptedTOTPSecret(): { secret: string; encryptedSecret: string } {
  const secret = generateTOTPSecret();
  const encryptedSecret = encryptSecret(secret);
  return { secret, encryptedSecret };
}

/** Generate QR code URI for authenticator apps */
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = 'FairArena',
): string {
  return authenticator.keyuri(email, issuer, secret);
}

/** Generate QR code as data URL */
export async function generateQRCode(secret: string, email: string): Promise<string> {
  const uri = generateTOTPUri(secret, email);
  try {
    return await QRCode.toDataURL(uri, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch (error) {
    logger.error('QR code generation failed', { error });
    throw new Error('Failed to generate QR code');
  }
}

/** Verify a TOTP code - simplified, no epoch hacks needed with window:3 */
export function verifyTOTPCode(token: string, encryptedSecret: string): boolean {
  try {
    const secret = decryptSecret(encryptedSecret);
    const isValid = authenticator.verify({ token, secret });
    if (!isValid) {
      logger.warn('TOTP verification failed', {
        token: token.slice(-2), // Partial for logs
        serverTime: new Date().toISOString(),
        window: authenticator.options.window,
      });
    }
    return isValid;
  } catch (error) {
    logger.error('TOTP verification error', { error });
    return false;
  }
}

/** Generate stronger backup codes (10 chars, alphanumeric) */
export function generateBackupCodes(count: number = 10): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Diceware-style, no I/O/0/1
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = '';
    for (let j = 0; j < 10; j++) {
      // 10 chars ~60 bits entropy
      code += chars[crypto.randomInt(0, chars.length)];
    }
    codes.push(code);
  }
  return codes;
}

/** Hash backup codes for storage (SHA-256) */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map((code) => crypto.createHash('sha256').update(code).digest('hex'));
}

/** Verify a backup code against stored hashes */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
  return hashedCodes.findIndex((hash) => hash === hashedInput);
}

/** Format backup codes for display */
export function formatBackupCode(code: string): string {
  return code.replace(/(.{4})/g, '$1 ').trim();
}

/** Generate complete MFA setup data */
export async function generateMFASetup(email: string): Promise<{
  secret: string;
  encryptedSecret: string;
  qrCode: string;
  backupCodes: string[];
  hashedBackupCodes: string[];
}> {
  const { secret, encryptedSecret } = generateEncryptedTOTPSecret();
  const qrCode = await generateQRCode(secret, email);
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = hashBackupCodes(backupCodes);
  return {
    secret,
    encryptedSecret,
    qrCode,
    backupCodes: backupCodes.map(formatBackupCode),
    hashedBackupCodes,
  };
}
