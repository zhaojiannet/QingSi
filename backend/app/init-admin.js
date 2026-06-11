// backend/app/init-admin.js
// 复用 src/db/prisma.js 已配置的客户端（Prisma 7 prisma-client generator + adapter）。
// 用 tsx 运行：容器内 `npx tsx init-admin.js`。
import prisma from './src/db/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const plainPassword = process.env.ADMIN_PASSWORD;

  if (!username || !plainPassword) {
    process.stderr.write('错误: 必须先设置 ADMIN_USERNAME 和 ADMIN_PASSWORD 环境变量再创建管理员账户\n');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    process.stdout.write('管理员账户已存在，跳过创建。\n');
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

  process.stdout.write(`管理员账户创建成功：${username}\n`);
}

main()
  .catch((e) => {
    process.stderr.write(`创建管理员账户失败: ${e.message}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
