//backend/app/src/routes/configs.js

import prisma from '../db/prisma.js';
import bcrypt from 'bcryptjs';

// 简单的内存缓存用于密码尝试次数限制
const passwordAttempts = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5分钟锁定

function checkPasswordAttempts(userId) {
  const now = Date.now();
  const record = passwordAttempts.get(userId);

  if (!record) return { allowed: true };

  // 检查是否在锁定期内
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  // 锁定期过了，重置计数
  if (record.lockedUntil && now >= record.lockedUntil) {
    passwordAttempts.delete(userId);
    return { allowed: true };
  }

  return { allowed: true, attempts: record.attempts || 0 };
}

function recordFailedAttempt(userId) {
  const now = Date.now();
  const record = passwordAttempts.get(userId) || { attempts: 0 };
  record.attempts++;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_TIME;
  }

  passwordAttempts.set(userId, record);
}

function clearAttempts(userId) {
  passwordAttempts.delete(userId);
}

// 一个辅助函数，用于获取配置，如果不存在则创建默认值
async function getOrCreateConfig() {
  let config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });
  if (!config) {
    config = await prisma.systemConfig.create({
      data: { id: 1, enableLoginCaptcha: true, enableTransactionVoid: false },
    });
  }
  return config;
}

// 检查撤销功能是否过期（10分钟）
function isVoidFeatureExpired(voidEnabledAt) {
  if (!voidEnabledAt) return true;
  const enabledTime = new Date(voidEnabledAt).getTime();
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  return now - enabledTime > tenMinutes;
}

export default async function (fastify, opts) {
  // 获取所有系统配置 - 公开访问（登录页需要）
  fastify.get('/', async (request, reply) => {
    const config = await getOrCreateConfig();

    // 检查撤销功能是否过期
    if (config.enableTransactionVoid && isVoidFeatureExpired(config.voidEnabledAt)) {
      // 自动关闭已过期的撤销功能
      await prisma.systemConfig.update({
        where: { id: 1 },
        data: { enableTransactionVoid: false, voidEnabledAt: null },
      });
      config.enableTransactionVoid = false;
      config.voidEnabledAt = null;
    }

    return config;
  });

  // 更新配置 - 需要管理员权限
  fastify.patch('/', {
    onRequest: [fastify.authenticate, fastify.hasRole('ADMIN')]
  }, async (request, reply) => {
    const { enableLoginCaptcha, enableTransactionVoid, password } = request.body;
    const userId = request.user.id;

    const updateData = {};
    if (enableLoginCaptcha !== undefined) {
      updateData.enableLoginCaptcha = enableLoginCaptcha;
    }

    // 开启撤销功能需要特殊密码验证
    if (enableTransactionVoid === true) {
      if (!password) {
        return reply.code(400).send({ message: '开启交易撤销功能需要输入验证密码' });
      }

      // 检查密码尝试次数
      const attemptCheck = checkPasswordAttempts(userId);
      if (!attemptCheck.allowed) {
        return reply.code(429).send({
          message: `密码错误次数过多，请${attemptCheck.remainingSeconds}秒后重试`
        });
      }

      // 获取当前用户信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.code(401).send({ message: '用户不存在' });
      }

      // 验证密码
      const expectedPassword = password.endsWith('!!!') ? password.slice(0, -3) : null;
      if (!expectedPassword) {
        // 记录失败尝试，统一错误信息不暴露验证规则
        recordFailedAttempt(userId);
        return reply.code(400).send({ message: '验证密码错误' });
      }

      const isPasswordValid = await bcrypt.compare(expectedPassword, user.password);
      if (!isPasswordValid) {
        recordFailedAttempt(userId);
        return reply.code(400).send({ message: '验证密码错误' });
      }

      // 密码验证成功，清除失败记录
      clearAttempts(userId);

      updateData.enableTransactionVoid = true;
      updateData.voidEnabledAt = new Date();
    } else if (enableTransactionVoid === false) {
      updateData.enableTransactionVoid = false;
      updateData.voidEnabledAt = null;
    }

    const updatedConfig = await prisma.systemConfig.update({
      where: { id: 1 },
      data: updateData,
    });
    return updatedConfig;
  });
}
