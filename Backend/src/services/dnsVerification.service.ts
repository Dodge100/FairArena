import { createId } from '@paralleldrive/cuid2';
import dns from 'dns/promises';
import logger from '../utils/logger.js';

/**
 * Generate a unique verification token
 */
export const generateVerificationToken = (): string => {
  return createId();
};

/**
 * Create DNS TXT record value from token
 */
export const createVerificationRecord = (token: string): string => {
  return `fairarena-verify=${token}`;
};

export const verifyDomainOwnership = async (
  domain: string,
  expectedToken: string,
): Promise<{ verified: boolean; record?: string; error?: string }> => {
  try {
    // Lookup TXT records for _fairarena-verify.domain.com
    const lookupDomain = `_fairarena-verify.${domain}`;

    logger.info('Performing DNS verification', { domain, lookupDomain });

    const records = await dns.resolveTxt(lookupDomain);

    // Flatten array of arrays to single array
    const flatRecords = records.flat();

    logger.info('DNS TXT records found', { domain, records: flatRecords });

    // Check if any record matches our token
    const expectedRecord = `fairarena-verify=${expectedToken}`;
    const verified = flatRecords.some((record) => record === expectedRecord);

    return {
      verified,
      record: verified ? expectedRecord : undefined,
    };
  } catch (error: any) {
    logger.warn('DNS verification failed', {
      domain,
      error: error.code || error.message,
    });

    // Provide user-friendly error messages
    let errorMessage: string;

    switch (error.code) {
      case 'ENOTFOUND':
      case 'ENODATA':
        errorMessage =
          'DNS record not found. Please ensure the TXT record has been added and DNS has propagated (may take 5-10 minutes).';
        break;
      case 'ETIMEOUT':
        errorMessage = 'DNS lookup timed out. Please try again later.';
        break;
      default:
        errorMessage = 'DNS lookup failed. Please check your domain configuration and try again.';
    }

    return {
      verified: false,
      error: errorMessage,
    };
  }
};
