// backend/app/src/routes/cardTypes.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  const adminOnlyAccess = { onRequest: [fastify.authenticate, fastify.hasRole('ADMIN')] };

  // 创建新卡类型
  fastify.post('/', adminOnlyAccess, async (request, reply) => {
    let { name, initialPrice, discountRate, status } = request.body;
    initialPrice = parseFloat(initialPrice);
    discountRate = parseFloat(discountRate);
    if (isNaN(initialPrice) || isNaN(discountRate)) {
        return reply.code(400).send({ message: '金额或折扣率格式不正确' });
    }
    const newCardType = await prisma.cardType.create({
      data: { id: generateId(), name, initialPrice, discountRate, status },
    });
    return newCardType;
  });
  
  // 获取卡类型列表
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.query;
    const where = {};
    if (status) {
        where.status = status;
    }
    const cardTypes = await prisma.cardType.findMany({
        where,
        orderBy: { initialPrice: 'asc' },
    });
    return cardTypes;
  });

  // 更新卡类型
  fastify.put('/:id', adminOnlyAccess, async (request, reply) => {
    const { id } = request.params;
    let { name, initialPrice, discountRate, status } = request.body;
    initialPrice = parseFloat(initialPrice);
    discountRate = parseFloat(discountRate);
    if (isNaN(initialPrice) || isNaN(discountRate)) {
        return reply.code(400).send({ message: '金额或折扣率格式不正确' });
    }
    const updatedCardType = await prisma.cardType.update({
      where: { id },
      data: { name, initialPrice, discountRate, status },
    });
    return updatedCardType;
  });

  // --- 新增：物理删除会员卡类型 ---
  fastify.delete('/:id', adminOnlyAccess, async (request, reply) => {
    const { id } = request.params;
    
    const cardType = await prisma.cardType.findUnique({ where: { id } });
    if (!cardType) {
      return reply.code(404).send({ message: '卡类型不存在' });
    }
    if (cardType.status !== 'UNAVAILABLE') {
      return reply.code(400).send({ message: '删除失败：必须先将卡类型下架。' });
    }

    const relatedCards = await prisma.card.count({
        where: { cardTypeId: id }
    });
    if (relatedCards > 0) {
        return reply.code(400).send({ message: '删除失败：已有会员办理了该类型的卡，无法删除。' });
    }
    
    await prisma.cardType.delete({ where: { id } });
    
    return { message: '会员卡类型已删除' };
  });
}