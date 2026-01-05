import type { sheets_v4 } from 'googleapis';
import { google } from 'googleapis';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

// Initialize Google Sheets API
let sheetsClient: sheets_v4.Sheets | null = null;

function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const { GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_CLIENT_EMAIL } = ENV;

  if (!GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_CLIENT_EMAIL) {
    throw new Error('Google Sheets credentials not configured');
  }

  // Replace escaped newlines in private key
  const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export const subscribeToNewsletter = inngest.createFunction(
  {
    id: 'newsletter-subscribe',
    concurrency: {
      limit: 5,
    },
    retries: 1,
  },
  { event: 'newsletter.subscribe' },
  async ({ event, step }) => {
    const { email } = event.data;

    if (!email) {
      logger.error('Missing email in newsletter.subscribe event', { email });
      throw new Error('Email is required');
    }

    logger.info('Starting newsletter subscription process', { email });

    const { GOOGLE_SHEETS_NEWSLETTER_ID } = ENV;

    if (!GOOGLE_SHEETS_NEWSLETTER_ID) {
      logger.error('Google Sheets Newsletter ID not configured');
      throw new Error('Newsletter service not configured');
    }

    await step.run('check-disposable-email', async () => {
      try {
        logger.info('Checking if email is disposable', { email });

        const disposableCheckUrl = `${ENV.CREDENTIAL_VALIDATOR_URL}/check?email=${encodeURIComponent(email)}`;
        const response = await fetch(disposableCheckUrl, {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          const isDisposable = data.tempmail;

          if (isDisposable) {
            logger.warn('Disposable email detected, rejecting subscription', { email });
            throw new Error('Disposable emails are not allowed');
          } else {
            logger.info('Email is not disposable', { email });
          }
        } else if (response.status === 400) {
          // Check if it's an invalid email format or domain issue
          try {
            const errorData = await response.json();
            if (
              errorData.error &&
              (errorData.error.includes('Invalid email format') ||
                errorData.error.includes('Email domain has no mail server'))
            ) {
              logger.warn('Invalid email format or domain detected, rejecting subscription', {
                email,
                error: errorData.error,
              });
              throw new Error('Invalid email address');
            }
          } catch {
            logger.warn('Could not parse 400 error response, treating as invalid', { email });
            throw new Error('Invalid email address');
          }
        } else {
          logger.warn(
            'Disposable email check API returned non-200/400 status, allowing subscription',
            {
              email,
              status: response.status,
              statusText: response.statusText,
            },
          );
          // Don't block - allow subscription to continue
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'Disposable emails are not allowed' ||
            error.message === 'Invalid email address')
        ) {
          throw error;
        }
        logger.warn(
          'Disposable email check failed (API down/timeout), allowing subscription to continue',
          {
            email,
            error: error instanceof Error ? error.message : String(error),
          },
        );
        // Allow subscription to continue if API is down
      }
    });

    await step.run('check-duplicate-email', async () => {
      try {
        const sheets = getGoogleSheetsClient();

        // Check if email already exists
        const existingData = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEETS_NEWSLETTER_ID,
          range: 'NewsLetter!A:A',
        });

        const emails = existingData.data.values || [];
        const emailExists = emails.some(
          (row: string[]) => row[0]?.toLowerCase() === email.toLowerCase(),
        );

        if (emailExists) {
          logger.warn('Duplicate newsletter subscription attempt', { email });
          throw new Error('Email already subscribed');
        }

        logger.info('Email not found in existing subscribers', { email });
      } catch (error) {
        if (error instanceof Error && error.message === 'Email already subscribed') {
          throw error;
        }
        logger.error('Error checking for duplicate email', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    await step.run('add-to-google-sheets', async () => {
      try {
        const sheets = getGoogleSheetsClient();

        // Append new row to Google Sheets
        const timestamp = new Date().toISOString();
        await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEETS_NEWSLETTER_ID,
          range: 'NewsLetter!A:C',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[email, timestamp]],
          },
        });

        logger.info('Newsletter subscription added to Google Sheets', { email, timestamp });
      } catch (error) {
        logger.error('Error adding subscription to Google Sheets', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    logger.info('Newsletter subscription process completed successfully', { email });
  },
);

export const unsubscribeFromNewsletter = inngest.createFunction(
  {
    id: 'newsletter-unsubscribe',
    concurrency: {
      limit: 5,
    },
    retries: 1,
  },
  { event: 'newsletter.unsubscribe' },
  async ({ event, step }) => {
    const { email } = event.data;

    if (!email) {
      logger.error('Missing email in newsletter.unsubscribe event', { email });
      throw new Error('Email is required');
    }

    logger.info('Starting newsletter unsubscribe process', { email });

    await step.run('remove-from-google-sheets', async () => {
      try {
        const sheets = getGoogleSheetsClient();

        // Get existing data
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: ENV.GOOGLE_SHEETS_NEWSLETTER_ID,
          range: 'NewsLetter!A:A',
        });

        const existingData = response.data;
        const emails = existingData.values || [];
        const emailIndex = emails.findIndex(
          (row: string[]) => row[0]?.toLowerCase() === email.toLowerCase(),
        );

        if (emailIndex === -1) {
          logger.warn('Email not found in newsletter list', { email });
          // Not an error, just log
          return;
        }

        // Get the sheet ID for 'NewsLetter'
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: ENV.GOOGLE_SHEETS_NEWSLETTER_ID,
          includeGridData: false,
        });

        const newsletterSheet = spreadsheet.data.sheets?.find(
          (sheet) => sheet.properties?.title === 'NewsLetter',
        );
        if (!newsletterSheet || !newsletterSheet.properties?.sheetId) {
          logger.error('NewsLetter sheet not found in spreadsheet', {
            spreadsheetId: ENV.GOOGLE_SHEETS_NEWSLETTER_ID,
          });
          throw new Error('NewsLetter sheet not found');
        }

        const sheetId = newsletterSheet.properties.sheetId;

        // Remove the row
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: ENV.GOOGLE_SHEETS_NEWSLETTER_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: emailIndex,
                    endIndex: emailIndex + 1,
                  },
                },
              },
            ],
          },
        });

        logger.info('Email removed from newsletter list', { email });
      } catch (error) {
        logger.error('Error removing email from Google Sheets', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    logger.info('Newsletter unsubscribe process completed successfully', { email });
  },
);
