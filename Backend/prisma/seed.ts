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

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const SubscriptionTier = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  TEAM: 'TEAM',
  ENTERPRISE: 'ENTERPRISE',
} as const;

const BillingCycle = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const;

async function main() {
  console.log('🌱 Seeding payment plans...');

  // Seed payment plans
  // First deactivate all existing plans to ensure only new ones are shown
  await prisma.plan.updateMany({ where: {}, data: { isActive: false } });

  // Note: We use upsert to avoid foreign key errors if payments exist linked to plans
  const plans = [
    {
      planId: 'tiny_10',
      name: 'Tiny',
      amount: 19900,
      currency: 'INR',
      credits: 10,
      description: 'Quick top-up for small tasks',
      features: ['10 AI Credits', 'Basic features'],
      isActive: true,
    },
    {
      planId: 'starter_50',
      name: 'Starter',
      amount: 49900,
      currency: 'INR',
      credits: 50,
      description: 'Perfect for trying out the platform',
      features: ['50 AI Credits', 'Basic features', 'Email support'],
      isActive: true,
    },
    {
      planId: 'basic_100',
      name: 'Basic',
      amount: 89900,
      currency: 'INR',
      credits: 100,
      description: 'Great for small projects',
      features: ['100 AI Credits', 'All basic features', 'Email support'],
      isActive: true,
    },
    {
      planId: 'growth_250',
      name: 'Growth',
      amount: 199900,
      currency: 'INR',
      credits: 250,
      description: 'For growing teams',
      features: ['250 AI Credits', 'Priority support', 'Advanced analytics'],
      isActive: true,
    },
    {
      planId: 'pro_500',
      name: 'Pro',
      amount: 349900,
      currency: 'INR',
      credits: 500,
      description: 'For power users',
      features: ['500 AI Credits', 'Priority support', 'Advanced analytics', 'API access'],
      isActive: true,
    },
    {
      planId: 'business_1000',
      name: 'Business',
      amount: 599900,
      currency: 'INR',
      credits: 1000,
      description: 'For serious businesses',
      features: ['1000 AI Credits', 'Dedicated support', 'Full analytics', 'API access'],
      isActive: true,
    },
    {
      planId: 'scale_2500',
      name: 'Scale',
      amount: 1299900,
      currency: 'INR',
      credits: 2500,
      description: 'Maximum value for high-volume usage',
      features: ['2500 AI Credits', 'Dedicated account manager', 'Full analytics', 'API access'],
      isActive: true,
    },
    {
      planId: 'enterprise_5000',
      name: 'Enterprise',
      amount: 2499900,
      currency: 'INR',
      credits: 5000,
      description: 'Enterprise-grade capacity',
      features: [
        '5000 AI Credits',
        'Dedicated account manager',
        'SLA support',
        'Custom integrations',
      ],
      isActive: true,
    },
    {
      planId: 'whale_10000',
      name: 'Whale',
      amount: 4499900,
      currency: 'INR',
      credits: 10000,
      description: 'Massive scale for industry leaders',
      features: ['10000 AI Credits', 'White-glove service', 'On-premise options', 'API access'],
      isActive: true,
    },
    {
      planId: 'titan_25000',
      name: 'Titan',
      amount: 9999900,
      currency: 'INR',
      credits: 25000,
      description: 'The ultimate credit pack',
      features: [
        '25000 AI Credits',
        'Everything included',
        '24/7 Priority support',
        'Strategic partnership',
      ],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    const upserted = await prisma.plan.upsert({
      where: { planId: plan.planId },
      update: plan,
      create: plan,
    });
    console.log(`✅ Upserted plan: ${upserted.name} (${upserted.planId})`);
  }

  // ============================================
  // SUBSCRIPTION PLANS SEEDING
  // ============================================

  console.log('🌱 Seeding subscription plans...');

  let subPlans: any[] = [
    // Monthly Plans
    {
      planId: 'starter_monthly',
      name: 'Starter',
      tier: SubscriptionTier.STARTER,
      billingCycle: BillingCycle.MONTHLY,
      amount: 99900,
      currency: 'INR',
      razorpayPlanId:
        process.env.NODE_ENV === 'production' ? 'plan_SHfIOVqrfSl6x1' : 'plan_SHXEWzzgr4Q2wP',
      description: 'Perfect for individuals and small projects',
      features: [
        '3 hackathons/month',
        '100 participants per hackathon',
        '10 judges',
        '100 AI credits/month',
        'Email support',
        'Basic analytics',
      ],
      limits: {
        maxHackathons: 3,
        maxParticipantsPerHackathon: 100,
        maxJudgesPerHackathon: 10,
        aiCreditsPerMonth: 100,
      },
      isPopular: false,
    },
    {
      planId: 'pro_monthly',
      name: 'Pro',
      tier: SubscriptionTier.PRO,
      billingCycle: BillingCycle.MONTHLY,
      amount: 299900,
      currency: 'INR',
      razorpayPlanId:
        process.env.NODE_ENV === 'production' ? 'plan_SHfJtTaU6T7ELy' : 'plan_SHXFUT2TC3ATk6',
      description: 'For growing teams with advanced needs',
      features: [
        '10 hackathons/month',
        '500 participants per hackathon',
        '30 judges',
        '500 AI credits/month',
        'Priority support',
        'Advanced analytics',
        'AI scoring',
        'Custom branding',
        'API access',
      ],
      limits: {
        maxHackathons: 10,
        maxParticipantsPerHackathon: 500,
        maxJudgesPerHackathon: 30,
        aiCreditsPerMonth: 500,
      },
      isPopular: true,
    },
    {
      planId: 'team_monthly',
      name: 'Team',
      tier: SubscriptionTier.TEAM,
      billingCycle: BillingCycle.MONTHLY,
      amount: 799900,
      currency: 'INR',
      razorpayPlanId:
        process.env.NODE_ENV === 'production' ? 'plan_SHfLFRpX8fpa6X' : 'plan_SHXGkVBeoIitKn',
      description: 'For large organizations running multiple events',
      features: [
        '25 hackathons/month',
        '2000 participants per hackathon',
        '100 judges',
        '2000 AI credits/month',
        'Dedicated support',
        'Full analytics',
        'AI scoring',
        'Plagiarism detection',
        'Custom branding',
        'API access',
      ],
      limits: {
        maxHackathons: 25,
        maxParticipantsPerHackathon: 2000,
        maxJudgesPerHackathon: 100,
        aiCreditsPerMonth: 2000,
      },
      isPopular: false,
    },

    // Yearly Plans
    {
      planId: 'starter_yearly',
      name: 'Starter Yearly',
      tier: SubscriptionTier.STARTER,
      billingCycle: BillingCycle.YEARLY,
      amount: 959000,
      currency: 'INR',
      razorpayPlanId:
        process.env.NODE_ENV === 'production' ? 'plan_SHfMcY8BaybsXR' : 'plan_SHXgHvEz1kZ4Rj',
      description: 'Perfect for individuals and small projects (Yearly)',
      features: [
        '3 hackathons/month',
        '100 participants per hackathon',
        '10 judges',
        '100 AI credits/month',
        'Email support',
        'Basic analytics',
      ],
      limits: {
        maxHackathons: 3,
        maxParticipantsPerHackathon: 100,
        maxJudgesPerHackathon: 10,
        aiCreditsPerMonth: 100,
      },
      isPopular: false,
    },
    {
      planId: 'pro_yearly',
      name: 'Pro Yearly',
      tier: SubscriptionTier.PRO,
      billingCycle: BillingCycle.YEARLY,
      amount: 2879000,
      currency: 'INR',
      razorpayPlanId:
        process.env.NODE_ENV === 'production' ? 'plan_SHfNftfT0wvVqM' : 'plan_SHXiI32DVtw0O4',
      description: 'For growing teams with advanced needs (Yearly)',
      features: [
        '10 hackathons/month',
        '500 participants per hackathon',
        '30 judges',
        '500 AI credits/month',
        'Priority support',
        'Advanced analytics',
        'AI scoring',
        'Custom branding',
        'API access',
      ],
      limits: {
        maxHackathons: 10,
        maxParticipantsPerHackathon: 500,
        maxJudgesPerHackathon: 30,
        aiCreditsPerMonth: 500,
      },
      isPopular: true,
    },
    {
      planId: 'team_yearly',
      name: 'Team Yearly',
      tier: SubscriptionTier.TEAM,
      billingCycle: BillingCycle.YEARLY,
      amount: 7679000,
      currency: 'INR',
      razorpayPlanId:
        process.env.NODE_ENV === 'production' ? 'plan_SHfOiUyNBXsbvP' : 'plan_SHXkyfNtH5DUnD',
      description: 'For large organizations running multiple events (Yearly)',
      features: [
        '25 hackathons/month',
        '2000 participants per hackathon',
        '100 judges',
        '2000 AI credits/month',
        'Dedicated support',
        'Full analytics',
        'AI scoring',
        'Plagiarism detection',
        'Custom branding',
        'API access',
      ],
      limits: {
        maxHackathons: 25,
        maxParticipantsPerHackathon: 2000,
        maxJudgesPerHackathon: 100,
        aiCreditsPerMonth: 2000,
      },
      isPopular: false,
    },

    // Enterprise
    {
      planId: 'enterprise_entity',
      name: 'Enterprise',
      tier: SubscriptionTier.ENTERPRISE,
      billingCycle: BillingCycle.MONTHLY,
      amount: 0,
      currency: 'INR',
      razorpayPlanId: null,
      description: 'Unlimited scale with dedicated support and SLA',
      features: [
        'Unlimited hackathons',
        'Unlimited participants',
        'Unlimited judges',
        'Unlimited AI credits',
        'Dedicated account manager',
        'SLA-backed support',
        'AI scoring & analytics',
        'Plagiarism detection',
        'White-label solution',
        'Custom integrations',
        'On-premise option',
      ],
      limits: {
        maxHackathons: -1,
        maxParticipantsPerHackathon: -1,
        maxJudgesPerHackathon: -1,
        aiCreditsPerMonth: -1,
      },
      isPopular: false,
    },
  ];

  for (const plan of subPlans) {
    const upserted = await prisma.subscriptionPlan.upsert({
      where: { planId: plan.planId },
      update: plan,
      create: plan,
    });
    console.log(`✅ Upserted subscription plan: ${upserted.name} (${upserted.planId})`);
  }

  // ============================================
  // OAUTH 2.0 / OPENID CONNECT SEEDING
  // ============================================

  console.log('🌱 Seeding OAuth scopes...');

  // Clear and recreate OAuth scopes
  await prisma.oAuthScope.deleteMany({});

  const oauthScopes = [
    {
      name: 'openid',
      displayName: 'OpenID',
      description: 'Verify your identity and get a unique user identifier',
      isOidc: true,
      isDefault: true,
      isDangerous: false,
      requiresVerification: false,
      isPublic: true,
    },
    {
      name: 'profile',
      displayName: 'Profile Information',
      description: 'Access your basic profile information (name, picture)',
      isOidc: true,
      isDefault: false,
      isDangerous: false,
      requiresVerification: false,
      isPublic: true,
    },
    {
      name: 'email',
      displayName: 'Email Address',
      description: 'Access your email address and verification status',
      isOidc: true,
      isDefault: false,
      isDangerous: false,
      requiresVerification: false,
      isPublic: true,
    },
    {
      name: 'offline_access',
      displayName: 'Offline Access',
      description: 'Access your data when you are not actively using the application',
      isOidc: true,
      isDefault: false,
      isDangerous: false,
      requiresVerification: false,
      isPublic: true,
    },
  ];

  for (const scope of oauthScopes) {
    await prisma.oAuthScope.create({ data: scope });
    console.log(`✅ Created OAuth scope: ${scope.name}`);
  }

  // Seed initial signing key if none exists
  console.log('🌱 Checking OAuth signing keys...');

  const existingKeys = await prisma.oAuthSigningKey.count();
  if (existingKeys === 0) {
    console.log('🔑 Generating initial RSA signing key...');

    // Generate RSA key pair
    const crypto = await import('crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const kid = `fa-key-${Date.now()}`;

    await prisma.oAuthSigningKey.create({
      data: {
        kid,
        algorithm: 'RS256',
        publicKeyPem: publicKey,
        privateKeyPem: privateKey,
        isActive: true,
        isPrimary: true,
      },
    });

    console.log(`✅ Created initial signing key: ${kid}`);
  } else {
    console.log(`✅ Found ${existingKeys} existing signing key(s), skipping generation`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
