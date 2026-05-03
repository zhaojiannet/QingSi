// backend/app/src/routes/users.js

import prisma from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import { passwordChangeSchema } from '../schemas/auth.js';

export default async function (fastify, opts) {

  const routeOptions = {
    onRequest: [fastify.authenticate],
    schema: passwordChangeSchema,
  };

  // --- 优化：修改密码后使其所有设备下线 ---
  fastify.patch('/password', routeOptions, async (request, reply) => {
    const { id: userId } = request.user;
    const { oldPassword, newPassword } = request.body;

    const user = await prisma.user.findUnique({
      where: { id: userId } 
    });

    if (!user) {
      return reply.code(404).send({ message: '用户不存在' });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return reply.code(400).send({ message: '旧密码不正确' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 使用 Prisma 事务，确保密码更新和令牌删除的原子性
    await prisma.$transaction(async (tx) => {
      // 1. 更新密码
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      // 2. 删除该用户所有的 Refresh Token，强制所有设备重新登录
      await tx.refreshToken.deleteMany({
        where: { userId: userId },
      });
    });

    return { message: '密码修改成功，为确保安全，您需要重新登录。' };
  });
}