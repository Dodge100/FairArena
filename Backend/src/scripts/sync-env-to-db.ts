import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../config/database';

async function syncEnvToDB() {
  try {
    console.log('Starting environment variables sync to database...');

    // Path to .env file
    const envPath = path.join(process.cwd(), '.env');

    // Check if .env file exists
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found at: ' + envPath);
    }

    // Read .env file
    const envContent = fs.readFileSync(envPath, 'utf-8');

    // Parse .env file (simple parsing)
    const envVars: { key: string; value: string }[] = [];
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Split by first = only
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        continue; // Skip lines without =
      }

      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');

      if (key) {
        envVars.push({ key, value: cleanValue });
      }
    }

    console.log(`Found ${envVars.length} environment variables in .env file`);

    // Clear existing environment variables
    await prisma.environmentVariable.deleteMany();
    console.log('Cleared existing environment variables from database');

    // Insert new environment variables
    if (envVars.length > 0) {
      await prisma.environmentVariable.createMany({
        data: envVars.map(({ key, value }) => ({
          key,
          value,
        })),
      });
      console.log(`Successfully synced ${envVars.length} environment variables to database`);
    }

    console.log('Environment variables sync completed successfully!');
  } catch (error) {
    console.error('Error syncing environment variables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
syncEnvToDB()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
