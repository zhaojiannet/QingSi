//backend/app/src/routes/configs.js


import prisma from '../db/prisma.js';

// 一个辅助函数，用于获取配置，如果不存在则创建默认值
async function getOrCreateConfig() {
  let config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });
  if (!config) {
    config = await prisma.systemConfig.create({
      data: { id: 1, enableLoginCaptcha: true },
    });
  }
  return config;
}

export default async function (fastify, opts) {
  // 获取所有系统配置
  fastify.get('/', async (request, reply) => {
    const config = await getOrCreateConfig();
    return config;
  });

  // 更新配置
  fastify.patch('/', async (request, reply) => {
    const { enableLoginCaptcha } = request.body;
    
    const updatedConfig = await prisma.systemConfig.update({
      where: { id: 1 },
      data: {
        enableLoginCaptcha,
      },
    });
    return updatedConfig;
  });
}