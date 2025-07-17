import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  // 请务必在生产环境中使用更复杂的密码，或从环境变量读取
  const plainPassword = 'password'; 

  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) {
    console.log('Admin user "admin" already exists.');
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('Admin user created successfully!');
  console.log(`Username: ${username}`);
  console.log(`Password: ${plainPassword} (This is your password, keep it safe)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });