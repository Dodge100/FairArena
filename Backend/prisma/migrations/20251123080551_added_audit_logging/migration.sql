/*
  Warnings:

  - A unique constraint covering the columns `[roleName]` on the table `OrganizationRole` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roleName]` on the table `ProjectRole` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roleName]` on the table `TeamRole` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "OrganizationAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "level" "level" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAuditLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "level" "level" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "level" "level" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedEntityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_idx" ON "OrganizationAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_userId_idx" ON "OrganizationAuditLog"("userId");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_action_idx" ON "OrganizationAuditLog"("action");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_createdAt_idx" ON "OrganizationAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TeamAuditLog_teamId_idx" ON "TeamAuditLog"("teamId");

-- CreateIndex
CREATE INDEX "TeamAuditLog_userId_idx" ON "TeamAuditLog"("userId");

-- CreateIndex
CREATE INDEX "TeamAuditLog_action_idx" ON "TeamAuditLog"("action");

-- CreateIndex
CREATE INDEX "TeamAuditLog_createdAt_idx" ON "TeamAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_idx" ON "ProjectAuditLog"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_userId_idx" ON "ProjectAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_action_idx" ON "ProjectAuditLog"("action");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_createdAt_idx" ON "ProjectAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedEntityId_entityType_idx" ON "Report"("reportedEntityId", "entityType");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRole_roleName_key" ON "OrganizationRole"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRole_roleName_key" ON "ProjectRole"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRole_roleName_key" ON "TeamRole"("roleName");

-- AddForeignKey
ALTER TABLE "OrganizationAuditLog" ADD CONSTRAINT "OrganizationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAuditLog" ADD CONSTRAINT "TeamAuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAuditLog" ADD CONSTRAINT "ProjectAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
