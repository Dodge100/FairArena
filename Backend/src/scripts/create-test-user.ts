import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import readline from 'readline';
import { prisma } from '../config/database.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  const email = 'test@test.com';

  console.log(`\n👤 Creating/Updating Test User: ${email}`);
  console.log('-------------------------------------------');
  console.log('NOTE: using this email ensures the login security bypass works.\n');

  const password = await askQuestion('🔑 Enter password for test user: ');
  rl.close();

  if (!password) {
    console.error('❌ Password cannot be empty');
    process.exit(1);
  }

  console.log('\n⏳ Hashing password...');
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hashedPassword,
        emailVerified: true,
        isDeleted: false,
        onboardingStatus: 'COMPLETED',
      },
      create: {
        userId: createId(),
        email,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        onboardingStatus: 'COMPLETED',
      },
    });

    console.log('\n✅ Test user created/updated successfully!');
    console.log(`User ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: [HIDDEN]`);
    console.log('\nYou can now login with these credentials.');
  } catch (error) {
    console.error('❌ Failed to create/update test user:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
