// src/routes/services.js
import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  // 创建新服务项目
  fastify.post('/', async (request, reply) => {

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

  });

  // 获取所有服务项目列表
  fastify.get('/', async (request, reply) => {
    
    const { status } = request.query; // 获取查询参数 status

    const where = {};
    if (status) {
      where.status = status;
    }

      const services = await prisma.service.findMany({
        where, // 应用过滤条件
        orderBy: { name: 'asc' },
      });
      return services;

  });

  // 更新服务项目信息
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
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

  });
}