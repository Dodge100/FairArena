-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disableOTPReverification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "superSecureAccountEnabled" BOOLEAN NOT NULL DEFAULT false;
