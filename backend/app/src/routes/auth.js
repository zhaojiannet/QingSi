// backend/app/src/routes/auth.js

import prisma from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import svgCaptcha from 'svg-captcha';
import { randomBytes } from 'crypto';

export default async function (fastify, opts) {

  fastify.get('/captcha', async (request, reply) => {
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
  
  fastify.post('/login', async (request, reply) => {
    const { username, password, captchaText, trustDevice } = request.body;

    const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (config?.enableLoginCaptcha) {
      if (!captchaText || !request.session.captcha || captchaText.toLowerCase() !== request.session.captcha) {
        request.session.captcha = null; 
        return reply.code(400).send({ message: '验证码不正确' });
      }
      request.session.captcha = null;
    }
    if (!username || !password) {
      return reply.code(400).send({ message: '用户名和密码不能为空' });
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
        token: refreshTokenValue,
        expiresAt: refreshTokenExpiresAt,
        userId: user.id,
      },
    });
    
    return { accessToken, refreshToken: refreshTokenValue };
  });
  
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body;
    if (!refreshToken) {
      return reply.code(400).send({ message: '缺少刷新令牌' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });
    
    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id }});
      }
      return reply.code(401).send({ message: '刷新令牌无效或已过期' });
    }
    
    const user = storedToken.user;
    const newAccessToken = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '1h' }
    );
    
    return { accessToken: newAccessToken };
  });

  fastify.post('/logout', async (request, reply) => {
    const { refreshToken } = request.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }
    return { message: '登出成功' };
  });
}