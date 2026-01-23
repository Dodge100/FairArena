-- CreateTable
CREATE TABLE "OrganizationSSOConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT,
    "providerType" TEXT NOT NULL DEFAULT 'oidc',
    "issuerUrl" TEXT,
    "authorizationUrl" TEXT,
    "tokenUrl" TEXT,
    "userInfoUrl" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "scimEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSSOConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSSOConfig_organizationId_key" ON "OrganizationSSOConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSSOConfig_domain_key" ON "OrganizationSSOConfig"("domain");

-- CreateIndex
CREATE INDEX "OrganizationSSOConfig_domain_idx" ON "OrganizationSSOConfig"("domain");

-- AddForeignKey
ALTER TABLE "OrganizationSSOConfig" ADD CONSTRAINT "OrganizationSSOConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
