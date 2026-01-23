
import crypto from 'crypto';
import { ENV } from '../config/env.js';

// Use a distinct key or derive one if not dedicated
const ENCRYPTION_KEY = ENV.MFA_ENCRYPTION_KEY || ENV.JWT_SECRET;
const IV_LENGTH = 16; // AES block size

const getKey = () => {
    // Ensure key is 32 bytes for aes-256-gcm
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypt a secret string using AES-256-GCM
 */
export const encryptSecret = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt a secret string using AES-256-GCM
 */
export const decryptSecret = (text: string): string => {
    const parts = text.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
