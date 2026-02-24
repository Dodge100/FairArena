/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { prisma } from '../config/database';

async function clearDatabase() {
  try {
    console.log('Starting database clear...');

    // Delete in order to avoid foreign key constraints
    // Start with junction tables and dependent entities

    await prisma.$transaction([
      // Delete junction and many-to-many relations first
      prisma.userProject.deleteMany(),
      prisma.projectUserRole.deleteMany(),
      prisma.userTeam.deleteMany(),
      prisma.teamUserRole.deleteMany(),
      prisma.organizationUserRole.deleteMany(),
      prisma.userOrganization.deleteMany(),
      prisma.profileStars.deleteMany(),
      prisma.organizationFollowers.deleteMany(),
      prisma.organizationStars.deleteMany(),
      prisma.notification.deleteMany(),

      // Delete audit logs
      prisma.projectAuditLog.deleteMany(),
      prisma.teamAuditLog.deleteMany(),
      prisma.organizationAuditLog.deleteMany(),

      // Delete invite codes
      prisma.projectInviteCode.deleteMany(),
      prisma.organizationInviteCode.deleteMany(),
      prisma.inviteCode.deleteMany(),

      // Delete profiles and views
      prisma.profileView.deleteMany(),
      prisma.projectProfile.deleteMany(),
      prisma.teamProfile.deleteMany(),
      prisma.organizationProfile.deleteMany(),

      // Delete logs and reports
      prisma.logs.deleteMany(),
      prisma.report.deleteMany(),
      prisma.support.deleteMany(),

      // Delete payment related
      prisma.paymentWebhookEvent.deleteMany(),
      prisma.creditTransaction.deleteMany(),
      prisma.payment.deleteMany(),

      // Delete main entities
      prisma.profile.deleteMany(),
      prisma.project.deleteMany(),
      prisma.team.deleteMany(),
      prisma.organization.deleteMany(),
      prisma.settings.deleteMany(),
      prisma.feedback.deleteMany(),

      // Delete plans and users last
      prisma.plan.deleteMany(),
      prisma.user.deleteMany(),

      // Environment variables (if needed)
      prisma.environmentVariable.deleteMany(),
    ]);

    console.log('Database cleared successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearDatabase()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
