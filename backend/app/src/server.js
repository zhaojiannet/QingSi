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

// CORS配置 - 基于环境变量
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

fastify.register(fastifyCors, { 
  origin: (origin, cb) => {
    // 开发环境允许无origin的请求（如Postman）
    if (process.env.NODE_ENV === 'development' && !origin) {
      cb(null, true);
      return;
    }
    
    // 检查origin是否在白名单中
    if (!origin || corsOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// 安全头配置
fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // 根据需要调整
});
fastify.register(fastifyCookie);

// Session配置 - 基于环境的安全设置
const isProduction = process.env.NODE_ENV === 'production';
const secureCookie = process.env.SECURE_COOKIE === 'true' || isProduction;

fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET,
  cookieName: 'sessionId',
  cookie: { 
    secure: secureCookie, // 生产环境必须为true
    httpOnly: true, // 防止XSS攻击
    sameSite: isProduction ? 'strict' : 'lax', // CSRF防护
    maxAge: 1000 * 60 * 60 * 24, // 24小时
    domain: process.env.COOKIE_DOMAIN || undefined, // 可选：设置cookie域
    path: '/'
  },
  saveUninitialized: false,
  rolling: true // 活动时自动续期
});

fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET });

// 全局速率限制 - 更保守的设置
fastify.register(fastifyRateLimit, { 
  global: true,
  max: 50, // 降低到50次/分钟
  timeWindow: '1 minute',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true
  }
});

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
// 认证路由 - 更严格的速率限制
fastify.register(authRoutes, { 
  prefix: '/api/auth',
  config: { 
    rateLimit: { 
      max: 5, // 降低到5次/分钟
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        return request.ip; // 基于IP的限制
      }
    } 
  }
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

// 配置路由 - GET 公开访问（登录页需要），PATCH 需要管理员权限（在路由内部控制）
fastify.register(configRoutes, { prefix: '/api/configs' });

// 启动服务
const start = async () => {
  try {
    // 环境变量检查
    console.log('=== 环境变量检查 ===');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
    console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? '已设置' : '未设置');
    
    if (!process.env.JWT_SECRET) {
      fastify.log.error('致命错误: 环境变量 JWT_SECRET 未定义!');
      process.exit(1);
    }
    if (!process.env.SESSION_SECRET) {
      fastify.log.error('致命错误: 环境变量 SESSION_SECRET 未定义!');
      process.exit(1);
    }
    if (!process.env.DATABASE_URL) {
      fastify.log.error('致命错误: 环境变量 DATABASE_URL 未定义!');
      process.exit(1);
    }
    
    console.log('=== 启动 Fastify 服务器 ===');
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('✅ 服务器启动成功: http://0.0.0.0:3000');
  } catch (err) {
    console.error('❌ 服务器启动失败:');
    console.error(err);
    fastify.log.error(err);
    process.exit(1);
  }
};
start();