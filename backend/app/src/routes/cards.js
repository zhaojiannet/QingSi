// backend/src/routes/cards.js
import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  fastify.post('/issue-with-transaction', async (request, reply) => {
    try {
      // 这里的 request.user 只是用来验证操作员有权限，但我们不直接用它的ID
      if (!request.user || !request.user.id) {
        return reply.code(401).send({ message: '用户未认证或Token无效' });
      }

      // --- 核心修改1：从前端接收 staffId ---
      const { memberId, cardTypeId, staffId, paymentMethod } = request.body;

      if (!memberId || !cardTypeId || !staffId) {
        return reply.code(400).send({ message: '会员、卡类型和操作员工均为必填项' });
      }

      const cardType = await prisma.cardType.findUnique({ where: { id: cardTypeId } });
      if (!cardType) {
        return reply.code(404).send({ message: '卡类型不存在' });
      }
      
      const result = await prisma.$transaction(async (tx) => {
        const newCard = await tx.card.create({
          data: {
            id: generateId(),
            member: { connect: { id: memberId } },
            cardType: { connect: { id: cardTypeId } },
            balance: cardType.initialPrice,
            status: 'ACTIVE',
          },
        });

        const transactionNotes = `办理【${cardType.name}】`;
        await tx.transaction.create({
          data: {
            id: generateId(),
            member: { connect: { id: memberId } },
            // --- 核心修改2：使用前端传递过来的 staffId ---
            staff: { connect: { id: staffId } }, 
            totalAmount: cardType.initialPrice,
            actualPaidAmount: cardType.initialPrice,
            discountAmount: 0,
            paymentMethod: paymentMethod || 'CASH',
            transactionTime: new Date(),
            notes: transactionNotes,
          },
        });

        await tx.member.update({
          where: { id: memberId },
          data: { lastVisitDate: new Date() },
        });

        return { newCard };
      });

      return result;

    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'P2025') {
        return reply.code(404).send({ message: '关联的会员、卡类型或操作员工不存在' });
      }
      return reply.code(500).send({ message: '办卡失败，服务器内部错误' });
    }
  });
}