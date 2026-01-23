-- AlterTable
ALTER TABLE "OrganizationSSOConfig" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scimToken" TEXT;

-- CreateIndex
CREATE INDEX "OrganizationSSOConfig_isActive_idx" ON "OrganizationSSOConfig"("isActive");
