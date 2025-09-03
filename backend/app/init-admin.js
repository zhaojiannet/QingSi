import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 从环境变量读取，如果没有则使用默认值
  const username = process.env.ADMIN_USERNAME || 'username';
  const plainPassword = process.env.ADMIN_PASSWORD || 'password';
  
  if (!process.env.ADMIN_PASSWORD) {
    process.stdout.write('Warning: Using default admin password. Please set ADMIN_PASSWORD environment variable in production!\n');
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) {
    process.stdout.write('Admin user already exists.\n');
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  process.stdout.write('Admin user created successfully!\n');
  process.stdout.write(`Username: ${username}\n`);
  process.stdout.write(`Password: ${plainPassword} (This is your password, keep it safe)\n`);
}

main()
  .catch((e) => {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });