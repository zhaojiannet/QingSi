// backend/app/src/routes/services.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  const adminOnlyAccess = { onRequest: [fastify.authenticate, fastify.hasRole('ADMIN')] };

  // 创建新服务项目
  fastify.post('/', adminOnlyAccess, async (request, reply) => {
    const { name, standardPrice, status, sortOrder, noDiscount } = request.body;
    const newService = await prisma.service.create({
      data: {
        id: generateId(),
        name,
        standardPrice,
        status,
        sortOrder: sortOrder || 99,
        noDiscount: noDiscount || false,
      },
    });
    return newService;
  });

  // 获取所有服务项目列表
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.query;
    const where = {};
    if (status) {
      where.status = status;
    }
    const services = await prisma.service.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
    });
    return services;
  });

  // 更新服务项目信息
  fastify.put('/:id', adminOnlyAccess, async (request, reply) => {
    const { id } = request.params;
    const { name, standardPrice, status, sortOrder, noDiscount } = request.body;
    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        name,
        standardPrice,
        status,
        sortOrder: sortOrder !== undefined ? sortOrder : 99,
        noDiscount: noDiscount !== undefined ? noDiscount : false,
      },
    });
    return updatedService;
  });

  // --- 新增：物理删除服务项目 ---
  fastify.delete('/:id', adminOnlyAccess, async (request, reply) => {
    const { id } = request.params;
    
    // 安全检查：确保服务项目存在且已下架
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) {
      return reply.code(404).send({ message: '服务项目不存在' });
    }
    if (service.status !== 'UNAVAILABLE') {
      return reply.code(400).send({ message: '删除失败：必须先将服务项目下架。' });
    }

    // 检查是否有关联的交易记录，如果有则阻止删除
    const relatedTransactions = await prisma.transactionItem.count({
        where: { serviceId: id }
    });
    if (relatedTransactions > 0) {
        return reply.code(400).send({ message: '删除失败：该服务项目已产生消费记录，无法删除。' });
    }

    // 在此处，您还可以检查是否有关联的预约记录，并决定如何处理
    // ...

    await prisma.service.delete({ where: { id } });
    
    return { message: '服务项目已删除' };
  });
}