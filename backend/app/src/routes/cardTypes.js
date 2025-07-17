import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  
  fastify.post('/', async (request, reply) => {
      let { name, initialPrice, discountRate, status } = request.body;

      // --- 核心修正：在创建前强制转换类型 ---
      initialPrice = parseFloat(initialPrice);
      discountRate = parseFloat(discountRate);

      if (isNaN(initialPrice) || isNaN(discountRate)) {
          return reply.code(400).send({ message: '金额或折扣率格式不正确' });
      }

      const newCardType = await prisma.cardType.create({
        data: {
          id: generateId(),
          name,
          initialPrice,
          discountRate,
          status,
        },
      });
      return newCardType;

  });
  
  fastify.get('/', async (request, reply) => {
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

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    let { name, initialPrice, discountRate, status } = request.body;

    // --- 核心修正：在更新前强制转换类型 ---
    initialPrice = parseFloat(initialPrice);
    discountRate = parseFloat(discountRate);

    if (isNaN(initialPrice) || isNaN(discountRate)) {
        return reply.code(400).send({ message: '金额或折扣率格式不正确' });
    }
    
      const updatedCardType = await prisma.cardType.update({
        where: { id },
        data: {
          name,
          initialPrice,
          discountRate,
          status,
        },
      });
      return updatedCardType;

  });
}