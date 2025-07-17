// backend/src/routes/users.js
import prisma from '../db/prisma.js';
import bcrypt from 'bcryptjs';

export default async function (fastify, opts) {
  
  // 使用 onRequest 钩子，确保在处理逻辑前，用户已通过认证
  // 这里的 fastify.authenticate 是我们在 server.js 中定义的装饰器
  const routeOptions = {
    onRequest: [fastify.authenticate],
  };

  // --- 修改当前登录用户的密码 ---
  fastify.patch('/password', routeOptions, async (request, reply) => {
    // 经过 onRequest 钩子后，可以100%确定 request.user 是存在的
    const { id: userId } = request.user; 
    const { oldPassword, newPassword } = request.body;

    if (!oldPassword || !newPassword) {
      return reply.code(400).send({ message: '旧密码和新密码均不能为空' });
    }

    if (newPassword.length < 6) {
        return reply.code(400).send({ message: '新密码长度不能少于6位' });
    }

    try {
      const user = await prisma.user.findUnique({ 
        where: { id: userId } 
      });

      // 理论上不会发生，但作为安全兜底
      if (!user) {
        return reply.code(404).send({ message: '用户不存在' });
      }

      // --- 核心：校验旧密码 ---
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        // 如果旧密码不正确，返回 400 错误，并给出明确提示
        return reply.code(400).send({ message: '旧密码不正确' });
      }

      // --- 只有在旧密码正确后，才更新密码 ---
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      return { message: '密码修改成功，请重新登录' };

    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ message: '服务器内部错误，修改密码失败' });
    }
  });
}