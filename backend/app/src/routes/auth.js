// backend/app/src/routes/auth.js

import prisma from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import svgCaptcha from 'svg-captcha';
import { randomBytes, createHash } from 'crypto';
import { loginSchema, refreshSchema, logoutSchema } from '../schemas/auth.js';

// 高熵 refresh token 用 SHA256 hash 存储；数据库不保留可被直接复用的明文。
const hashRefreshToken = (token) => createHash('sha256').update(token).digest('hex');

// refresh token 的 cookie 选项：httpOnly 让 JS 读不到（防 XSS 窃取），路径限定到 /api/auth
const refreshCookieOptions = (maxAgeSeconds) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureCookie = process.env.SECURE_COOKIE === 'true' || isProduction;
  return {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/api/auth',
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {}),
  };
};

export default async function (fastify, opts) {

  // 每分钟限流配置：防爆破必须挂在 per-route 的 config.rateLimit 上，
  // 挂在 register 选项里不会下沉到 plugin 内的路由（@fastify/rate-limit 只读 per-route config）
  const loginRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  const captchaRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  fastify.get('/captcha', captchaRateLimit, async (request, reply) => {
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1i',
      noise: 2,
      color: true,
      background: '#f4f4f4'
    });
    request.session.captcha = captcha.text.toLowerCase();
    reply.type('image/svg+xml');
    reply.send(captcha.data);
  });
  
  fastify.post('/login', { schema: loginSchema, ...loginRateLimit }, async (request, reply) => {
    const { username, password, captchaText, trustDevice } = request.body;

    const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (config?.enableLoginCaptcha) {
      if (!captchaText || !request.session.captcha || captchaText.toLowerCase() !== request.session.captcha) {
        request.session.captcha = null;
        return reply.code(400).send({ message: '验证码不正确' });
      }
      request.session.captcha = null;
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return reply.code(401).send({ message: '用户名或密码错误' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.code(401).send({ message: '用户名或密码错误' });
    }

    const accessToken = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '1h' }
    );
    
    const refreshTokenValue = randomBytes(64).toString('hex');
    const refreshTokenValidityDays = trustDevice ? 7 : 1; 
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenValidityDays * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        token: hashRefreshToken(refreshTokenValue),
        expiresAt: refreshTokenExpiresAt,
        userId: user.id,
      },
    });

    // refresh token 通过 httpOnly cookie 下发，不放进响应体（JS 读不到，避免 XSS 窃取长期凭证）
    reply.setCookie('refreshToken', refreshTokenValue, refreshCookieOptions(refreshTokenValidityDays * 24 * 60 * 60));

    return { accessToken };
  });
  
  fastify.post('/refresh', { schema: refreshSchema, ...loginRateLimit }, async (request, reply) => {
    // 优先从 httpOnly cookie 读取，body 仅兼容旧客户端
    const refreshToken = request.cookies?.refreshToken || request.body?.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({ message: '刷新令牌缺失，请重新登录' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: hashRefreshToken(refreshToken) },
      include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id }});
      }
      reply.clearCookie('refreshToken', refreshCookieOptions());
      return reply.code(401).send({ message: '刷新令牌无效或已过期' });
    }

    const user = storedToken.user;
    const newAccessToken = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '1h' }
    );

    return { accessToken: newAccessToken };
  });

  fastify.post('/logout', { schema: logoutSchema }, async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken || request.body?.refreshToken;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: hashRefreshToken(refreshToken) }
      });
    }
    reply.clearCookie('refreshToken', refreshCookieOptions());
    return { message: '登出成功' };
  });
}