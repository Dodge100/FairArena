import { google, sheets_v4 } from 'googleapis';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';

export interface HackathonDetail {
  url?: string;
  title?: string;
  description?: string;
  overview?: string;
  aboutOrganizer?: string;
  eligibilityCriteria?: string;
  teamComposition?: string;
  registrationDeadline?: string;
  firstWinner?: string;
  firstRunnerUp?: string;
  secondRunnerUp?: string;
  allPresenters?: string;
  totalPrizePool?: string;
  registrationFee?: string;
  theme?: string;
  hackathonStarts?: string;
  resultsAnnouncements?: string;
  contactEmail?: string;
  contactPhoneNo?: string;
  contactWebsite?: string;
  isProcessed: boolean;
}

let sheetsClient: sheets_v4.Sheets | null = null;

function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const { GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_CLIENT_EMAIL } = ENV;

  if (!GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_CLIENT_EMAIL) {
    throw new Error('Google Sheets credentials not configured');
  }

  const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export class HackathonService {
  static async getAllHackathons(): Promise<HackathonDetail[]> {
    try {
      const sheets = getGoogleSheetsClient();
      const spreadsheetId = ENV.GOOGLE_SHEETS_HACKATHONS_ID;

      if (!spreadsheetId) {
        throw new Error('Google Sheets Hackathons ID not configured');
      }

      // We'll read from a sheet named 'Hackathons'
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A2:U', // Start from row 2 to skip headers
      });

      const rows = response.data.values || [];

      const hackathons: HackathonDetail[] = rows.map((row) => ({
        url: row[0] || '',
        title: row[1] || '',
        description: row[2] || '',
        overview: row[3] || '',
        aboutOrganizer: row[4] || '',
        eligibilityCriteria: row[5] || '',
        teamComposition: row[6] || '',
        registrationDeadline: row[7] || '',
        firstWinner: row[8] || '',
        firstRunnerUp: row[9] || '',
        secondRunnerUp: row[10] || '',
        allPresenters: row[11] || '',
        totalPrizePool: row[12] || '',
        registrationFee: row[13] || '',
        theme: row[14] || '',
        hackathonStarts: row[15] || '',
        resultsAnnouncements: row[16] || '',
        contactEmail: row[17] || '',
        contactPhoneNo: row[18] || '',
        contactWebsite: row[19] || '',
        isProcessed: String(row[20]).toUpperCase() === 'TRUE',
      }));

      // Filter only processed hackathons as per user requirement
      return hackathons.filter((h) => h.isProcessed);
    } catch (error) {
      logger.error('Error fetching hackathons from Google Sheets', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
