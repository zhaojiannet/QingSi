// backend/app/src/server.js

import dotenv from 'dotenv';
dotenv.config();

import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';

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

const fastify = Fastify({ logger: true });

// 插件注册
fastify.register(fastifyCors, { origin: true, credentials: true });
fastify.register(fastifyHelmet);
fastify.register(fastifyCookie);

fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'PLACEHOLDER_SESSION_SECRET',
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  } 
});

fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET });
fastify.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });

// --- 认证装饰器 ---
fastify.decorate("authenticate", async function(request, reply) {
  try {
    request.user = await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ message: '认证失败：令牌无效或已过期，请重新登录。' });
  }
});

// --- RBAC 角色权限校验装饰器 ---
fastify.decorate("hasRole", (requiredRoles) => {
  return async function(request, reply) {
    const rolesToCheck = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    if (!request.user || !rolesToCheck.includes(request.user.role)) {
      reply.code(403).send({ message: '权限不足，禁止访问此资源。' });
    }
  }
});

// --- 全局错误处理器 ---
fastify.setErrorHandler(function (error, request, reply) {
  request.log.error(error);
  if (error.code && error.code.startsWith('P')) {
    switch (error.code) {
      case 'P2002': {
        if (error.meta && Array.isArray(error.meta.target)) {
          const fields = error.meta.target.join(', ');
          return reply.status(409).send({ message: `操作失败：字段 [${fields}] 的值已存在，不能重复。` });
        }
        return reply.status(409).send({ message: '操作失败：您提交的数据与现有记录冲突。' });
      }
      case 'P2025': {
        const message = error.meta?.cause || '操作失败：一个或多个必需的关联记录不存在。';
        return reply.status(404).send({ message });
      }
      default: {
        return reply.status(500).send({ message: `数据库操作失败，错误码: ${error.code}。请联系管理员。` });
      }
    }
  }
  if (error.validation) {
    return reply.status(400).send({ message: '请求参数无效', errors: error.validation });
  }
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return reply.code(401).send({ message: '认证失败或已过期，请重新登录。' });
  }
  const errorMessage = error.message || '服务器内部发生未知错误';
  return reply.status(500).send({ message: errorMessage });
});

// --- 权限配置 ---
const generalAccess = { onRequest: [fastify.authenticate] };
const managerAndAdminAccess = { onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])] };
const adminOnlyAccess = { onRequest: [fastify.authenticate, fastify.hasRole('ADMIN')] };

// --- 路由注册 (最终版RBAC权限) ---
fastify.register(authRoutes, { 
  prefix: '/api/auth',
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
});

// 基础访问权限
fastify.register(memberRoutes, { prefix: '/api/members', ...generalAccess });
fastify.register(transactionRoutes, { prefix: '/api/transactions', ...generalAccess });
fastify.register(appointmentRoutes, { prefix: '/api/appointments', ...generalAccess });
fastify.register(cardRoutes, { prefix: '/api/cards', ...generalAccess });
fastify.register(userRoutes, { prefix: '/api/users', ...generalAccess });

// 具有内部精细化权限的路由
fastify.register(staffRoutes, { prefix: '/api/staff' });
fastify.register(cardTypeRoutes, { prefix: '/api/card-types' });

// 高级权限
fastify.register(reportRoutes, { prefix: '/api/reports', ...managerAndAdminAccess });
fastify.register(serviceRoutes, { prefix: '/api/services', ...adminOnlyAccess });
fastify.register(configRoutes, { prefix: '/api/configs', ...adminOnlyAccess });

// 启动服务
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      fastify.log.error('致命错误: 环境变量 JWT_SECRET 未定义!');
      process.exit(1);
    }
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();