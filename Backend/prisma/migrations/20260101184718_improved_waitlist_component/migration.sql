-- AlterTable
ALTER TABLE "Waitlist" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userAgent" TEXT;
