import prisma from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import svgCaptcha from 'svg-captcha'; // 引入 svg-captcha

export default async function (fastify, opts) {

  // --- 新增：生成验证码图片的接口 ---
  fastify.get('/captcha', async (request, reply) => {
    const captcha = svgCaptcha.create({
      size: 4, // 4个字符
      ignoreChars: '0o1i', // 忽略易混淆的字符
      noise: 2, // 2条干扰线
      color: true,
      background: '#f4f4f4'
    });

    // 将验证码的正确答案（小写）存储在 session 中
    request.session.captcha = captcha.text.toLowerCase();

    reply.type('image/svg+xml');
    reply.send(captcha.data);
  });
  
  // --- 修改：登录接口增加验证码校验 ---
  fastify.post('/login', async (request, reply) => {
    const { username, password, captchaText } = request.body;

    // --- 核心修改：先获取系统配置 ---
    const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });

    // 如果开启了验证码，则执行校验
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

// 生成JWT Token，有效期为7天
const token = fastify.jwt.sign(
  { 
    id: user.id, 
    username: user.username, 
    role: user.role 
  },
  { expiresIn: '7d' } 
);

// 返回Token
return { token };
});
}