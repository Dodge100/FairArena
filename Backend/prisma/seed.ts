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
