-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'REFUND', 'BONUS', 'DEDUCTION', 'ADJUSTMENT', 'INITIAL_ALLOCATION', 'EXPIRY', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'QUERY', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "level" AS ENUM ('INFO', 'WARN', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReportState" AS ENUM ('QUEUED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'MENTION', 'INVITATION', 'ACHIEVEMENT', 'UPDATE', 'REMINDER', 'ALERT', 'MESSAGE', 'FOLLOW', 'STAR', 'COMMENT', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT,
    "lastName" TEXT,
    "profileImageUrl" TEXT,
    "username" TEXT,
    "phoneNumber" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "hasClaimedFreeCredits" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "credits" INTEGER NOT NULL,
    "description" TEXT,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "credits" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentContact" TEXT,
    "receipt" TEXT,
    "notes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "idempotencyKey" TEXT,
    "webhookProcessed" BOOLEAN NOT NULL DEFAULT false,
    "webhookProcessedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "refundId" TEXT,
    "refundAmount" INTEGER,
    "refundReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "razorpayInvoiceId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "razorpayEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "company" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "education" TEXT[],
    "gender" "gender",
    "githubUsername" TEXT,
    "interests" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "languages" TEXT[],
    "linkedInProfile" TEXT,
    "location" TEXT,
    "phoneNumber" TEXT,
    "portfolioUrl" TEXT,
    "requireAuth" BOOLEAN NOT NULL DEFAULT false,
    "resumeUrl" TEXT,
    "skills" TEXT[],
    "trackViews" BOOLEAN NOT NULL DEFAULT false,
    "twitterHandle" TEXT,
    "yearsOfExperience" INTEGER,
    "awards" TEXT[],
    "certifications" TEXT[],
    "experiences" TEXT[],
    "firstName" TEXT,
    "lastName" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "level" "level" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "joinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "OrganizationRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInviteCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrganizationInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "joinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRole" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRole" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTeam_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateTable
CREATE TABLE "ProjectUserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProject" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProject_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "joinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

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
    "state" "ReportState" NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileStars" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileStars_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "description" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "feedbackCode" TEXT NOT NULL,
    "message" TEXT,
    "rating" INTEGER,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Support" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailId" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ReportState" NOT NULL DEFAULT 'QUEUED',
    "severity" "ReportSeverity" NOT NULL DEFAULT 'LOW',
    "type" "ReportType" NOT NULL DEFAULT 'BUG',
    "shortDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Support_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentVariable" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentVariable_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_userId_idx" ON "User"("userId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_isPhoneVerified_idx" ON "User"("isPhoneVerified");

-- CreateIndex
CREATE INDEX "User_hasClaimedFreeCredits_idx" ON "User"("hasClaimedFreeCredits");

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE INDEX "User_userId_isPhoneVerified_idx" ON "User"("userId", "isPhoneVerified");

-- CreateIndex
CREATE INDEX "User_userId_hasClaimedFreeCredits_idx" ON "User"("userId", "hasClaimedFreeCredits");

-- CreateIndex
CREATE INDEX "User_phoneNumber_isPhoneVerified_idx" ON "User"("phoneNumber", "isPhoneVerified");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_planId_key" ON "Plan"("planId");

-- CreateIndex
CREATE INDEX "Plan_planId_idx" ON "Plan"("planId");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "Plan_name_idx" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_refundId_key" ON "Payment"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayInvoiceId_key" ON "Payment"("razorpayInvoiceId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_razorpayInvoiceId_idx" ON "Payment"("razorpayInvoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_webhookProcessed_idx" ON "Payment"("webhookProcessed");

-- CreateIndex
CREATE INDEX "Payment_refundId_idx" ON "Payment"("refundId");

-- CreateIndex
CREATE INDEX "Payment_planId_idx" ON "Payment"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_paymentId_key" ON "CreditTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_paymentId_idx" ON "CreditTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_type_idx" ON "CreditTransaction"("userId", "type");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_type_createdAt_idx" ON "CreditTransaction"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_razorpayEventId_key" ON "PaymentWebhookEvent"("razorpayEventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_razorpayEventId_idx" ON "PaymentWebhookEvent"("razorpayEventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_processed_idx" ON "PaymentWebhookEvent"("processed");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_createdAt_idx" ON "PaymentWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_processed_idx" ON "PaymentWebhookEvent"("eventType", "processed");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_isPublic_idx" ON "Profile"("isPublic");

-- CreateIndex
CREATE INDEX "Profile_requireAuth_idx" ON "Profile"("requireAuth");

-- CreateIndex
CREATE INDEX "Profile_trackViews_idx" ON "Profile"("trackViews");

-- CreateIndex
CREATE INDEX "Logs_userId_idx" ON "Logs"("userId");

-- CreateIndex
CREATE INDEX "Logs_action_idx" ON "Logs"("action");

-- CreateIndex
CREATE INDEX "Logs_level_idx" ON "Logs"("level");

-- CreateIndex
CREATE INDEX "Logs_createdAt_idx" ON "Logs"("createdAt");

-- CreateIndex
CREATE INDEX "Logs_userId_createdAt_idx" ON "Logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Logs_action_createdAt_idx" ON "Logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileView_profileId_idx" ON "ProfileView"("profileId");

-- CreateIndex
CREATE INDEX "ProfileView_viewerUserId_idx" ON "ProfileView"("viewerUserId");

-- CreateIndex
CREATE INDEX "ProfileView_viewerEmail_idx" ON "ProfileView"("viewerEmail");

-- CreateIndex
CREATE INDEX "ProfileView_createdAt_idx" ON "ProfileView"("createdAt");

-- CreateIndex
CREATE INDEX "ProfileView_profileId_createdAt_idx" ON "ProfileView"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileView_profileId_viewerUserId_key" ON "ProfileView"("profileId", "viewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_isPublic_idx" ON "Organization"("isPublic");

-- CreateIndex
CREATE INDEX "Organization_joinEnabled_idx" ON "Organization"("joinEnabled");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationUserRole_userId_idx" ON "OrganizationUserRole"("userId");

-- CreateIndex
CREATE INDEX "OrganizationUserRole_organizationId_idx" ON "OrganizationUserRole"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationUserRole_roleId_idx" ON "OrganizationUserRole"("roleId");

-- CreateIndex
CREATE INDEX "OrganizationUserRole_organizationId_userId_idx" ON "OrganizationUserRole"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUserRole_userId_organizationId_roleId_key" ON "OrganizationUserRole"("userId", "organizationId", "roleId");

-- CreateIndex
CREATE INDEX "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");

-- CreateIndex
CREATE INDEX "UserOrganization_createdAt_idx" ON "UserOrganization"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationRole_organizationId_idx" ON "OrganizationRole"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationRole_roleName_idx" ON "OrganizationRole"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRole_organizationId_roleName_key" ON "OrganizationRole"("organizationId", "roleName");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInviteCode_code_key" ON "OrganizationInviteCode"("code");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_organizationId_idx" ON "OrganizationInviteCode"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_code_idx" ON "OrganizationInviteCode"("code");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_expiresAt_idx" ON "OrganizationInviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_email_idx" ON "OrganizationInviteCode"("email");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_used_idx" ON "OrganizationInviteCode"("used");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_roleId_idx" ON "OrganizationInviteCode"("roleId");

-- CreateIndex
CREATE INDEX "OrganizationInviteCode_organizationId_used_expiresAt_idx" ON "OrganizationInviteCode"("organizationId", "used", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_organizationId_key" ON "OrganizationProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationProfile_organizationId_idx" ON "OrganizationProfile"("organizationId");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_slug_idx" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Team_visibility_idx" ON "Team"("visibility");

-- CreateIndex
CREATE INDEX "Team_joinEnabled_idx" ON "Team"("joinEnabled");

-- CreateIndex
CREATE INDEX "Team_createdAt_idx" ON "Team"("createdAt");

-- CreateIndex
CREATE INDEX "Team_organizationId_visibility_idx" ON "Team"("organizationId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_slug_key" ON "Team"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProfile_teamId_key" ON "TeamProfile"("teamId");

-- CreateIndex
CREATE INDEX "TeamProfile_teamId_idx" ON "TeamProfile"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_teamId_idx" ON "InviteCode"("teamId");

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "InviteCode_email_idx" ON "InviteCode"("email");

-- CreateIndex
CREATE INDEX "InviteCode_used_idx" ON "InviteCode"("used");

-- CreateIndex
CREATE INDEX "InviteCode_roleId_idx" ON "InviteCode"("roleId");

-- CreateIndex
CREATE INDEX "InviteCode_teamId_used_expiresAt_idx" ON "InviteCode"("teamId", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "TeamRole_teamId_idx" ON "TeamRole"("teamId");

-- CreateIndex
CREATE INDEX "TeamRole_roleName_idx" ON "TeamRole"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRole_teamId_roleName_key" ON "TeamRole"("teamId", "roleName");

-- CreateIndex
CREATE INDEX "ProjectRole_projectId_idx" ON "ProjectRole"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRole_roleName_idx" ON "ProjectRole"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRole_projectId_roleName_key" ON "ProjectRole"("projectId", "roleName");

-- CreateIndex
CREATE INDEX "TeamUserRole_userId_idx" ON "TeamUserRole"("userId");

-- CreateIndex
CREATE INDEX "TeamUserRole_teamId_idx" ON "TeamUserRole"("teamId");

-- CreateIndex
CREATE INDEX "TeamUserRole_roleId_idx" ON "TeamUserRole"("roleId");

-- CreateIndex
CREATE INDEX "TeamUserRole_teamId_userId_idx" ON "TeamUserRole"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamUserRole_userId_teamId_roleId_key" ON "TeamUserRole"("userId", "teamId", "roleId");

-- CreateIndex
CREATE INDEX "UserTeam_teamId_idx" ON "UserTeam"("teamId");

-- CreateIndex
CREATE INDEX "UserTeam_createdAt_idx" ON "UserTeam"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectUserRole_userId_idx" ON "ProjectUserRole"("userId");

-- CreateIndex
CREATE INDEX "ProjectUserRole_projectId_idx" ON "ProjectUserRole"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUserRole_roleId_idx" ON "ProjectUserRole"("roleId");

-- CreateIndex
CREATE INDEX "ProjectUserRole_projectId_userId_idx" ON "ProjectUserRole"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUserRole_userId_projectId_roleId_key" ON "ProjectUserRole"("userId", "projectId", "roleId");

-- CreateIndex
CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");

-- CreateIndex
CREATE INDEX "UserProject_createdAt_idx" ON "UserProject"("createdAt");

-- CreateIndex
CREATE INDEX "Project_teamId_idx" ON "Project"("teamId");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_slug_idx" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_visibility_idx" ON "Project"("visibility");

-- CreateIndex
CREATE INDEX "Project_joinEnabled_idx" ON "Project"("joinEnabled");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_teamId_visibility_idx" ON "Project"("teamId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Project_teamId_name_key" ON "Project"("teamId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_teamId_slug_key" ON "Project"("teamId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "projectProfile_projectId_key" ON "projectProfile"("projectId");

-- CreateIndex
CREATE INDEX "projectProfile_projectId_idx" ON "projectProfile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInviteCode_code_key" ON "ProjectInviteCode"("code");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_projectId_idx" ON "ProjectInviteCode"("projectId");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_code_idx" ON "ProjectInviteCode"("code");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_expiresAt_idx" ON "ProjectInviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_email_idx" ON "ProjectInviteCode"("email");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_used_idx" ON "ProjectInviteCode"("used");

-- CreateIndex
CREATE INDEX "ProjectInviteCode_projectId_used_expiresAt_idx" ON "ProjectInviteCode"("projectId", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_idx" ON "OrganizationAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_userId_idx" ON "OrganizationAuditLog"("userId");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_action_idx" ON "OrganizationAuditLog"("action");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_level_idx" ON "OrganizationAuditLog"("level");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_createdAt_idx" ON "OrganizationAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_userId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamAuditLog_teamId_idx" ON "TeamAuditLog"("teamId");

-- CreateIndex
CREATE INDEX "TeamAuditLog_userId_idx" ON "TeamAuditLog"("userId");

-- CreateIndex
CREATE INDEX "TeamAuditLog_action_idx" ON "TeamAuditLog"("action");

-- CreateIndex
CREATE INDEX "TeamAuditLog_level_idx" ON "TeamAuditLog"("level");

-- CreateIndex
CREATE INDEX "TeamAuditLog_createdAt_idx" ON "TeamAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TeamAuditLog_teamId_createdAt_idx" ON "TeamAuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamAuditLog_teamId_userId_createdAt_idx" ON "TeamAuditLog"("teamId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_idx" ON "ProjectAuditLog"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_userId_idx" ON "ProjectAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_action_idx" ON "ProjectAuditLog"("action");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_level_idx" ON "ProjectAuditLog"("level");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_createdAt_idx" ON "ProjectAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_createdAt_idx" ON "ProjectAuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_userId_createdAt_idx" ON "ProjectAuditLog"("projectId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedEntityId_entityType_idx" ON "Report"("reportedEntityId", "entityType");

-- CreateIndex
CREATE INDEX "Report_state_idx" ON "Report"("state");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "Report_entityType_state_idx" ON "Report"("entityType", "state");

-- CreateIndex
CREATE INDEX "ProfileStars_profileId_idx" ON "ProfileStars"("profileId");

-- CreateIndex
CREATE INDEX "ProfileStars_userId_idx" ON "ProfileStars"("userId");

-- CreateIndex
CREATE INDEX "ProfileStars_createdAt_idx" ON "ProfileStars"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileStars_profileId_userId_key" ON "ProfileStars"("profileId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationFollowers_organizationId_idx" ON "OrganizationFollowers"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationFollowers_userId_idx" ON "OrganizationFollowers"("userId");

-- CreateIndex
CREATE INDEX "OrganizationFollowers_createdAt_idx" ON "OrganizationFollowers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationFollowers_organizationId_userId_key" ON "OrganizationFollowers"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationStars_organizationId_idx" ON "OrganizationStars"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationStars_userId_idx" ON "OrganizationStars"("userId");

-- CreateIndex
CREATE INDEX "OrganizationStars_createdAt_idx" ON "OrganizationStars"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationStars_organizationId_userId_key" ON "OrganizationStars"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_feedbackCode_key" ON "Feedback"("feedbackCode");

-- CreateIndex
CREATE INDEX "Feedback_isUsed_idx" ON "Feedback"("isUsed");

-- CreateIndex
CREATE INDEX "Feedback_feedbackCode_isUsed_idx" ON "Feedback"("feedbackCode", "isUsed");

-- CreateIndex
CREATE INDEX "Support_userId_idx" ON "Support"("userId");

-- CreateIndex
CREATE INDEX "Support_status_idx" ON "Support"("status");

-- CreateIndex
CREATE INDEX "Support_severity_idx" ON "Support"("severity");

-- CreateIndex
CREATE INDEX "Support_type_idx" ON "Support"("type");

-- CreateIndex
CREATE INDEX "Support_createdAt_idx" ON "Support"("createdAt");

-- CreateIndex
CREATE INDEX "Support_userId_status_idx" ON "Support"("userId", "status");

-- CreateIndex
CREATE INDEX "Support_status_severity_idx" ON "Support"("status", "severity");

-- CreateIndex
CREATE INDEX "Support_type_severity_idx" ON "Support"("type", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");

-- CreateIndex
CREATE INDEX "Settings_userId_idx" ON "Settings"("userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("planId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUserRole" ADD CONSTRAINT "OrganizationUserRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUserRole" ADD CONSTRAINT "OrganizationUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrganizationRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUserRole" ADD CONSTRAINT "OrganizationUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRole" ADD CONSTRAINT "OrganizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInviteCode" ADD CONSTRAINT "OrganizationInviteCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInviteCode" ADD CONSTRAINT "OrganizationInviteCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrganizationRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProfile" ADD CONSTRAINT "TeamProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRole" ADD CONSTRAINT "TeamRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRole" ADD CONSTRAINT "ProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUserRole" ADD CONSTRAINT "TeamUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUserRole" ADD CONSTRAINT "TeamUserRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUserRole" ADD CONSTRAINT "TeamUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUserRole" ADD CONSTRAINT "ProjectUserRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUserRole" ADD CONSTRAINT "ProjectUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUserRole" ADD CONSTRAINT "ProjectUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectProfile" ADD CONSTRAINT "projectProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInviteCode" ADD CONSTRAINT "ProjectInviteCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInviteCode" ADD CONSTRAINT "ProjectInviteCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProjectRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAuditLog" ADD CONSTRAINT "OrganizationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAuditLog" ADD CONSTRAINT "TeamAuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAuditLog" ADD CONSTRAINT "ProjectAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileStars" ADD CONSTRAINT "ProfileStars_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileStars" ADD CONSTRAINT "ProfileStars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollowers" ADD CONSTRAINT "OrganizationFollowers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollowers" ADD CONSTRAINT "OrganizationFollowers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStars" ADD CONSTRAINT "OrganizationStars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStars" ADD CONSTRAINT "OrganizationStars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Support" ADD CONSTRAINT "Support_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
