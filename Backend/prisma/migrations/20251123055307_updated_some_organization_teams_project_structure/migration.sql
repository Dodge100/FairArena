/*
  Warnings:

  - You are about to drop the column `description` on the `Project` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[teamId,slug]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,slug]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdBy` to the `InviteCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `InviteCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `InviteCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `OrganizationInviteCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `OrganizationInviteCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `OrganizationInviteCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Team_name_key";

-- DropIndex
DROP INDEX "Team_slug_key";

-- AlterTable
ALTER TABLE "InviteCode" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "roleId" TEXT NOT NULL,
ADD COLUMN     "used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrganizationInviteCode" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "roleId" TEXT NOT NULL,
ADD COLUMN     "used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "description",
ADD COLUMN     "joinEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "projectProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projectProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInviteCode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT,
    "code" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ProjectInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projectProfile_projectId_key" ON "projectProfile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInviteCode_code_key" ON "ProjectInviteCode"("code");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_projectId_idx" ON "ProjectInviteCode"("projectId");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_expiresAt_idx" ON "ProjectInviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_email_idx" ON "ProjectInviteCode"("email");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_used_idx" ON "ProjectInviteCode"("used");

-- CreateIndex
CREATE INDEX "InviteCode_email_idx" ON "InviteCode"("email");

-- CreateIndex
CREATE INDEX "InviteCode_used_idx" ON "InviteCode"("used");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_email_idx" ON "OrganizationInviteCode"("email");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_used_idx" ON "OrganizationInviteCode"("used");

-- CreateIndex
CREATE INDEX "Project_joinEnabled_idx" ON "Project"("joinEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Project_teamId_slug_key" ON "Project"("teamId", "slug");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_slug_key" ON "Team"("organizationId", "slug");

-- AddForeignKey
ALTER TABLE "OrganizationInviteCode" ADD CONSTRAINT "OrganizationInviteCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrganizationRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectProfile" ADD CONSTRAINT "projectProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInviteCode" ADD CONSTRAINT "ProjectInviteCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInviteCode" ADD CONSTRAINT "ProjectInviteCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
