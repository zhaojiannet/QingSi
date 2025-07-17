// backend/app/src/server.js (已添加全局错误处理)

import dotenv from 'dotenv';
dotenv.config();

import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';

// 路由文件
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import serviceRoutes from './routes/services.js';
import cardTypeRoutes from './routes/cardTypes.js';
import transactionRoutes from './routes/transactions.js';
import staffRoutes from './routes/staff.js';
import appointmentRoutes from './routes/appointments.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import configRoutes from './routes/configs.js';
import cardRoutes from './routes/cards.js';

import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';

const fastify = Fastify({ logger: true });

// 插件注册
fastify.register(fastifyCors, { origin: true, credentials: true });
fastify.register(fastifyHelmet);
fastify.register(fastifyCookie);
fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'PLACEHOLDER_SESSION_SECRET',
  cookie: { secure: false } 
});

fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET });
fastify.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });

// --- 认证装饰器 ---
fastify.decorate("authenticate", async function(request, reply) {
  try {
    request.user = await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ message: 'Authentication failed: Token is invalid or expired.' });
  }
});

fastify.decorate("adminOnly", async function(request, reply) {
  if (request.user?.role !== 'admin') {
    reply.code(403).send({ message: 'Forbidden: Admin access is required.' });
  }
});

// --- 全局错误处理器 (健壮版) ---
fastify.setErrorHandler(function (error, request, reply) {
  // 始终在后台记录最详细的错误信息，便于排查
  request.log.error(error);

  // --- 优先处理 Prisma 数据库错误 ---
  if (error.code && error.code.startsWith('P')) {
    switch (error.code) {
      case 'P2002': { // 唯一约束冲突
        // 安全地检查 error.meta.target 是否存在且为数组
        if (error.meta && Array.isArray(error.meta.target)) {
          const fields = error.meta.target.join(', ');
          return reply.status(409).send({ message: `操作失败：字段 [${fields}] 的值已存在，不能重复。` });
        }
        // 如果 target 不可用，返回通用提示
        return reply.status(409).send({ message: '操作失败：您提交的数据与现有记录冲突。' });
      }
      case 'P2025': { // 关联记录未找到
        // P2025 的 meta.cause 提供了更友好的信息
        const message = error.meta?.cause || '操作失败：一个或多个必需的关联记录不存在。';
        return reply.status(404).send({ message });
      }
      default: {
        // 对于其他未明确处理的 Prisma 错误，返回通用数据库错误提示
        return reply.status(500).send({ message: `数据库操作失败，错误码: ${error.code}。请联系管理员。` });
      }
    }
  }

  // --- 处理 Fastify 验证错误 (如果未来使用) ---
  if (error.validation) {
    return reply.status(400).send({ message: '请求参数无效', errors: error.validation });
  }

  // --- 处理 JWT 认证错误 (虽然在钩子中已处理，但作为兜底) ---
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return reply.code(401).send({ message: '认证失败或已过期，请重新登录。' });
  }
  
  // --- 对于所有其他未知错误，返回一个通用的500错误 ---
  // 检查是否有 message 属性，以提供稍微多一点的信息
  const errorMessage = error.message || '服务器内部发生未知错误';
  return reply.status(500).send({ message: errorMessage });
});


// --- 权限配置对象 ---
const generalAccess = { onRequest: [fastify.authenticate] };
const adminAccess = { onRequest: [fastify.authenticate, fastify.adminOnly] };

// --- 路由注册 ---
fastify.register(authRoutes, { 
  prefix: '/api/auth',
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
});

// 普通用户即可访问
fastify.register(memberRoutes, { prefix: '/api/members', ...generalAccess });
fastify.register(transactionRoutes, { prefix: '/api/transactions', ...generalAccess });
fastify.register(appointmentRoutes, { prefix: '/api/appointments', ...generalAccess });
fastify.register(cardRoutes, { prefix: '/api/cards', ...generalAccess });
// 修改密码是个人操作，应为通用权限
fastify.register(userRoutes, { prefix: '/api/users', ...generalAccess });

// Admin 权限访问
fastify.register(cardTypeRoutes, { prefix: '/api/card-types', ...adminAccess });
fastify.register(serviceRoutes, { prefix: '/api/services', ...adminAccess });
fastify.register(staffRoutes, { prefix: '/api/staff', ...adminAccess });
fastify.register(reportRoutes, { prefix: '/api/reports', ...adminAccess });
fastify.register(configRoutes, { prefix: '/api/configs', ...adminAccess });

// 启动服务
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      fastify.log.error('FATAL: JWT_SECRET is not defined!');
      process.exit(1);
    }
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();