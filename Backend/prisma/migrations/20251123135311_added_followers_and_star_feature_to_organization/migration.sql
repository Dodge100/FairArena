/*
  Warnings:

  - You are about to drop the column `starrerId` on the `ProfileStars` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[profileId,userId]` on the table `ProfileStars` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProfileStars_profileId_starrerId_userId_key";

-- DropIndex
DROP INDEX "ProfileStars_starrerId_idx";

-- AlterTable
ALTER TABLE "ProfileStars" DROP COLUMN "starrerId";

-- CreateTable
CREATE TABLE "OrganizationFollowers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationFollowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationStars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationStars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationFollowers_userId_organizationId_idx" ON "OrganizationFollowers"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationFollowers_organizationId_userId_key" ON "OrganizationFollowers"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationStars_userId_organizationId_idx" ON "OrganizationStars"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationStars_organizationId_userId_key" ON "OrganizationStars"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileStars_profileId_userId_key" ON "ProfileStars"("profileId", "userId");

-- AddForeignKey
ALTER TABLE "OrganizationFollowers" ADD CONSTRAINT "OrganizationFollowers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollowers" ADD CONSTRAINT "OrganizationFollowers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStars" ADD CONSTRAINT "OrganizationStars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStars" ADD CONSTRAINT "OrganizationStars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
