/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `Profile` table. All the data in the column will be lost.
  - You are about to alter the column `bio` on the `Profile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - Made the column `bio` on table `Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "avatarUrl",
ADD COLUMN     "company" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "education" TEXT[],
ADD COLUMN     "gender" "gender",
ADD COLUMN     "githubUsername" TEXT,
ADD COLUMN     "interests" TEXT[],
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "languages" TEXT[],
ADD COLUMN     "linkedInProfile" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "requireAuth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "trackViews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twitterHandle" TEXT,
ADD COLUMN     "yearsOfExperience" INTEGER,
ALTER COLUMN "bio" SET NOT NULL,
ALTER COLUMN "bio" SET DATA TYPE VARCHAR(500);

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "viewerEmail" TEXT NOT NULL,
    "viewerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileView_profileId_idx" ON "ProfileView"("profileId");

-- CreateIndex
CREATE INDEX "ProfileView_viewerUserId_idx" ON "ProfileView"("viewerUserId");

-- CreateIndex
CREATE INDEX "ProfileView_viewerEmail_idx" ON "ProfileView"("viewerEmail");

-- CreateIndex
CREATE INDEX "ProfileView_createdAt_idx" ON "ProfileView"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileView_profileId_viewerUserId_key" ON "ProfileView"("profileId", "viewerUserId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_isPublic_idx" ON "Profile"("isPublic");

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
