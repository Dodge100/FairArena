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

import { prisma } from '../../config/database.js';
import { inngest } from './client.js';

export const recordProfileView = inngest.createFunction(
  {
    id: 'record-profile-view',
    name: 'Record Profile View',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'profile/view.record' },
  async ({ event, step }) => {
    const { profileId, viewerUserId, viewerEmail, viewerName } = event.data;

    await step.run('record-profile-view', async () => {
      try {
        // Upsert to handle duplicate views
        await prisma.profileView.upsert({
          where: {
            profileId_viewerUserId: {
              profileId,
              viewerUserId,
            },
          },
          update: {
            // Update timestamp if viewing again
            createdAt: new Date(),
          },
          create: {
            profileId,
            viewerUserId,
            viewerEmail,
            viewerName,
          },
        });

        console.log(`Profile view recorded: ${viewerEmail} viewed profile ${profileId}`);
      } catch (error) {
        console.error('Error recording profile view:', error);
        throw error;
      }
    });

    return { success: true };
  },
);
