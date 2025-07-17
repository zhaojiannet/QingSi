// src/routes/services.js
import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  // 创建新服务项目
  fastify.post('/', async (request, reply) => {
    try {
      const { name, standardPrice, status } = request.body;
      const newService = await prisma.service.create({
        data: {
          id: generateId(),
          name,
          standardPrice,
          status,
        },
      });
      return newService;
    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'P2002') {
        reply.code(409).send({ message: '服务项目名称已存在' });
      } else {
        reply.code(500).send({ message: '创建服务项目失败' });
      }
    }
  });

  // 获取所有服务项目列表
  fastify.get('/', async (request, reply) => {
    
    const { status } = request.query; // 获取查询参数 status

    const where = {};
    if (status) {
      where.status = status;
    }

    try {
      const services = await prisma.service.findMany({
        where, // 应用过滤条件
        orderBy: { name: 'asc' },
      });
      return services;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ message: '查询服务项目失败' });
    }
  });

  // 更新服务项目信息
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const { name, standardPrice, status } = request.body;
      const updatedService = await prisma.service.update({
        where: { id },
        data: {
          name,
          standardPrice,
          status,
        },
      });
      return updatedService;
    } catch (error) {
      fastify.log.error(error);
      // P2025: 记录未找到
      if (error.code === 'P2025') {
        reply.code(404).send({ message: '服务项目不存在' });
      } else if (error.code === 'P2002') {
        reply.code(409).send({ message: '服务项目名称已存在' });
      } else {
        reply.code(500).send({ message: '更新服务项目失败' });
      }
    }
  });
}