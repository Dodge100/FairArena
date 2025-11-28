-- DropIndex
DROP INDEX "OrganizationFollowers_userId_organizationId_idx";

-- DropIndex
DROP INDEX "OrganizationRole_roleName_key";

-- DropIndex
DROP INDEX "OrganizationStars_userId_organizationId_idx";

-- DropIndex
DROP INDEX "ProfileStars_profileId_userId_idx";

-- DropIndex
DROP INDEX "ProjectRole_roleName_key";

-- DropIndex
DROP INDEX "TeamRole_roleName_key";

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_roleId_idx" ON "InviteCode"("roleId");

-- CreateIndex
CREATE INDEX "InviteCode_teamId_used_expiresAt_idx" ON "InviteCode"("teamId", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "Logs_level_idx" ON "Logs"("level");

-- CreateIndex
CREATE INDEX "Logs_userId_createdAt_idx" ON "Logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Logs_action_createdAt_idx" ON "Logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_level_idx" ON "OrganizationAuditLog"("level");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_userId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationFollowers_organizationId_idx" ON "OrganizationFollowers"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationFollowers_userId_idx" ON "OrganizationFollowers"("userId");

-- CreateIndex
CREATE INDEX "OrganizationFollowers_createdAt_idx" ON "OrganizationFollowers"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_code_idx" ON "OrganizationInviteCode"("code");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_roleId_idx" ON "OrganizationInviteCode"("roleId");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_organizationId_used_expiresAt_idx" ON "OrganizationInviteCode"("organizationId", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "OrganizationProfile_organizationId_idx" ON "OrganizationProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationRole_roleName_idx" ON "OrganizationRole"("roleName");

-- CreateIndex
CREATE INDEX "OrganizationStars_organizationId_idx" ON "OrganizationStars"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationStars_userId_idx" ON "OrganizationStars"("userId");

-- CreateIndex
CREATE INDEX "OrganizationStars_createdAt_idx" ON "OrganizationStars"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationUserRole_organizationId_userId_idx" ON "OrganizationUserRole"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Otp_createdAt_idx" ON "Otp"("createdAt");

-- CreateIndex
CREATE INDEX "Otp_verified_idx" ON "Otp"("verified");

-- CreateIndex
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");

-- CreateIndex
CREATE INDEX "Otp_userId_verified_expiresAt_idx" ON "Otp"("userId", "verified", "expiresAt");

-- CreateIndex
CREATE INDEX "Profile_requireAuth_idx" ON "Profile"("requireAuth");

-- CreateIndex
CREATE INDEX "Profile_trackViews_idx" ON "Profile"("trackViews");

-- CreateIndex
CREATE INDEX "ProfileStars_profileId_idx" ON "ProfileStars"("profileId");

-- CreateIndex
CREATE INDEX "ProfileStars_userId_idx" ON "ProfileStars"("userId");

-- CreateIndex
CREATE INDEX "ProfileStars_createdAt_idx" ON "ProfileStars"("createdAt");

-- CreateIndex
CREATE INDEX "ProfileView_profileId_createdAt_idx" ON "ProfileView"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_slug_idx" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_teamId_visibility_idx" ON "Project"("teamId", "visibility");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_level_idx" ON "ProjectAuditLog"("level");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_createdAt_idx" ON "ProjectAuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_userId_createdAt_idx" ON "ProjectAuditLog"("projectId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_code_idx" ON "ProjectInviteCode"("code");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_projectId_used_expiresAt_idx" ON "ProjectInviteCode"("projectId", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "ProjectRole_roleName_idx" ON "ProjectRole"("roleName");

-- CreateIndex
CREATE INDEX "ProjectUserRole_projectId_userId_idx" ON "ProjectUserRole"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Report_state_idx" ON "Report"("state");

-- CreateIndex
CREATE INDEX "Report_entityType_state_idx" ON "Report"("entityType", "state");

-- CreateIndex
CREATE INDEX "Team_createdAt_idx" ON "Team"("createdAt");

-- CreateIndex
CREATE INDEX "Team_organizationId_visibility_idx" ON "Team"("organizationId", "visibility");

-- CreateIndex
CREATE INDEX "TeamAuditLog_level_idx" ON "TeamAuditLog"("level");

-- CreateIndex
CREATE INDEX "TeamAuditLog_teamId_createdAt_idx" ON "TeamAuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamAuditLog_teamId_userId_createdAt_idx" ON "TeamAuditLog"("teamId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamProfile_teamId_idx" ON "TeamProfile"("teamId");

-- CreateIndex
CREATE INDEX "TeamRole_roleName_idx" ON "TeamRole"("roleName");

-- CreateIndex
CREATE INDEX "TeamUserRole_teamId_userId_idx" ON "TeamUserRole"("teamId", "userId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserOrganization_createdAt_idx" ON "UserOrganization"("createdAt");

-- CreateIndex
CREATE INDEX "UserProject_createdAt_idx" ON "UserProject"("createdAt");

-- CreateIndex
CREATE INDEX "UserTeam_createdAt_idx" ON "UserTeam"("createdAt");

-- CreateIndex
CREATE INDEX "projectProfile_projectId_idx" ON "projectProfile"("projectId");
