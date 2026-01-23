-- AlterTable
ALTER TABLE "OAuthApplication" ADD COLUMN     "verificationRejectionReason" TEXT,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "verificationVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationSSOConfig" ADD COLUMN     "domainVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "domainVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "domainVerificationToken" TEXT,
ADD COLUMN     "domainVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OrganizationSSOConfig_domainVerified_idx" ON "OrganizationSSOConfig"("domainVerified");
