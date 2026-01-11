import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Seeding payment plans...');

  // Clear existing plans
  await prisma.plan.deleteMany({});
  console.log('✅ Cleared existing plans');

  // Seed payment plans
  const plans = [
    {
      planId: 'basic_plan',
      name: 'Basic Plan',
      amount: 89900, // ₹899 in paisa
      currency: 'INR',
      credits: 50,
      description: 'Perfect for small hackathons & student-led events',
      features: [
        '50 Participants',
        '5 Judges',
        'Manual Scoring System',
        'Basic Real-time Leaderboard',
        'Submission Management',
        'Email Support',
      ],
      isActive: true,
    },
    {
      planId: 'business_plan',
      name: 'Business Plan',
      amount: 299900, // ₹2999 in paisa
      currency: 'INR',
      credits: 300,
      description: 'Our most popular plan with AI-powered scoring',
      features: [
        '300 Participants',
        '20 Judges',
        'AI Website Analysis',
        'Advanced Leaderboard',
        'Judge Collaboration Tools',
        'AI Scoring Assistance',
        'Priority Support',
      ],
      isActive: true,
    },
    {
      planId: 'enterprise_plan',
      name: 'Enterprise Plan',
      amount: 0, // Custom pricing
      currency: 'INR',
      credits: 0,
      description: 'For large-scale, enterprise-grade hackathons',
      features: [
        'Unlimited Participants',
        'Unlimited Judges',
        'Deep AI Analytics',
        'Plagiarism Detection',
        'Custom Rubrics & Permissions',
        'Dedicated Account Manager',
        'SLA-backed Support',
      ],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    const created = await prisma.plan.create({
      data: plan,
    });
    console.log(`✅ Created plan: ${created.name} (${created.planId})`);
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
