import { z } from 'zod';
import logger from './logger.js';

// Maximum allowed file size (1MB)
const MAX_CSV_SIZE = 1024 * 1024;
// Maximum allowed rows
const MAX_CSV_ROWS = 1000;

export interface TeamInviteCSVRow {
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}

// Zod schema for CSV row validation with strict rules
const teamInviteRowSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .regex(
      /^[^+=.#]+@/,
      'Email subaddresses and special characters (+, =, ., #) are not allowed in the local part',
    )
    .transform((val) => val.toLowerCase().trim()),
  roleId: z
    .string()
    .min(1, 'Role ID is required')
    .max(100, 'Role ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Role ID contains invalid characters'),
  firstName: z
    .string()
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s'-]*$/, 'First name contains invalid characters')
    .optional()
    .transform((val) => val?.trim()),
  lastName: z
    .string()
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s'-]*$/, 'Last name contains invalid characters')
    .optional()
    .transform((val) => val?.trim()),
});

export interface CSVParseResult {
  valid: TeamInviteCSVRow[];
  invalid: Array<{
    row: number;
    data: Record<string, string>;
    errors: string[];
  }>;
  totalRows: number;
}

/**
 * Parse CSV content for team invitations with enhanced security
 * Expected format: email,roleId,firstName,lastName
 */
export function parseTeamInviteCSV(csvContent: string): CSVParseResult {
  const result: CSVParseResult = {
    valid: [],
    invalid: [],
    totalRows: 0,
  };

  try {
    // Security check: file size
    if (csvContent.length > MAX_CSV_SIZE) {
      throw new Error(`CSV file too large. Maximum size is ${MAX_CSV_SIZE / 1024 / 1024}MB`);
    }

    // Sanitize input - remove potential script injection
    const sanitizedContent = csvContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    // Split by newlines and filter empty lines
    const lines = sanitizedContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return result;
    }

    // Security check: row count
    if (lines.length > MAX_CSV_ROWS + 1) {
      // +1 for header
      throw new Error(`CSV has too many rows. Maximum allowed is ${MAX_CSV_ROWS}`);
    }

    // Parse header with case-insensitive matching
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const emailIndex = header.indexOf('email');
    const roleIdIndex = header.findIndex((h) => h === 'roleid' || h === 'role_id' || h === 'role');
    const firstNameIndex = header.findIndex((h) => h === 'firstname' || h === 'first_name');
    const lastNameIndex = header.findIndex((h) => h === 'lastname' || h === 'last_name');

    if (emailIndex === -1) {
      throw new Error('CSV must contain "email" column');
    }

    if (roleIdIndex === -1) {
      throw new Error('CSV must contain "roleId" or "role" column');
    }

    // Track unique emails to prevent duplicates
    const seenEmails = new Set<string>();

    // Process data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      result.totalRows++;

      // Enhanced CSV parsing that handles quoted fields
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map((v) => v.replace(/^"|"$/g, '').trim());

      const rowData: Record<string, string> = {};
      rowData.email = cleanValues[emailIndex] || '';
      rowData.roleId = cleanValues[roleIdIndex] || '';

      // Check for duplicate emails in this CSV
      const normalizedEmail = rowData.email.toLowerCase();
      if (seenEmails.has(normalizedEmail)) {
        result.invalid.push({
          row: i + 1,
          data: rowData,
          errors: ['Duplicate email in CSV'],
        });
        continue;
      }
      seenEmails.add(normalizedEmail);

      if (firstNameIndex !== -1 && cleanValues[firstNameIndex]) {
        rowData.firstName = cleanValues[firstNameIndex];
      }

      if (lastNameIndex !== -1 && cleanValues[lastNameIndex]) {
        rowData.lastName = cleanValues[lastNameIndex];
      }

      // Validate row with strict schema
      const validationResult = teamInviteRowSchema.safeParse(rowData);

      if (validationResult.success) {
        result.valid.push(validationResult.data);
      } else {
        result.invalid.push({
          row: i + 1, // +1 for human-readable row number
          data: rowData,
          errors: validationResult.error.issues.map((err) => err.message),
        });
      }
    }

    logger.info('CSV parsing completed', {
      totalRows: result.totalRows,
      validRows: result.valid.length,
      invalidRows: result.invalid.length,
    });

    return result;
  } catch (error) {
    logger.error('CSV parsing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Validate CSV content before processing
 */
export function validateCSVFormat(csvContent: string): {
  valid: boolean;
  error?: string;
} {
  if (!csvContent || csvContent.trim().length === 0) {
    return { valid: false, error: 'CSV content is empty' };
  }

  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      valid: false,
      error: 'CSV must contain at least a header row and one data row',
    };
  }

  const header = lines[0].toLowerCase();
  if (!header.includes('email')) {
    return { valid: false, error: 'CSV must contain "email" column' };
  }

  if (!header.includes('role')) {
    return { valid: false, error: 'CSV must contain "role" or "roleId" column' };
  }

  return { valid: true };
}

/**
 * Generate sample CSV for team invitations
 */
export function generateSampleCSV(): string {
  return `email,roleId,firstName,lastName
john.doe@example.com,role_123abc,John,Doe
jane.smith@example.com,role_456def,Jane,Smith
bob.wilson@example.com,role_123abc,Bob,Wilson`;
}
