-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "onboardingVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "User_onboardingStatus_idx" ON "User"("onboardingStatus");

-- CreateIndex
CREATE INDEX "User_userId_onboardingStatus_idx" ON "User"("userId", "onboardingStatus");
