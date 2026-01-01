/*
  Warnings:

  - You are about to drop the column `localPath` on the `SupportAttachment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `emailId` on table `Support` required. This step will fail if there are existing NULL values in that column.
  - Made the column `supportRequestId` on table `SupportAttachment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "SupportAttachment" DROP CONSTRAINT "SupportAttachment_supportRequestId_fkey";

-- AlterTable
ALTER TABLE "Support" ALTER COLUMN "emailId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SupportAttachment" DROP COLUMN "localPath",
ADD COLUMN     "fileData" BYTEA,
ALTER COLUMN "supportRequestId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginIp" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_emailVerified_idx" ON "User"("emailVerified");

-- AddForeignKey
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "Support"("id") ON DELETE CASCADE ON UPDATE CASCADE;
