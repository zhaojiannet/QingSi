// backend/app/src/routes/cards.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  fastify.post('/issue-with-transaction', async (request, reply) => {
      const { memberId, cardTypeId, staffId, paymentMethod } = request.body;

      if (!memberId || !cardTypeId) {
        return reply.code(400).send({ message: '会员和卡类型均为必填项。' });
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

        // --- 核心修改：填充 summary 字段 ---
        await tx.transaction.create({
          data: {
            id: generateId(),
            member: { connect: { id: memberId } },
            ...(staffId && { staff: { connect: { id: staffId } } }), 
            summary: `办理【${cardType.name}】`, // 设置交易摘要
            totalAmount: cardType.initialPrice,
            actualPaidAmount: cardType.initialPrice,
            discountAmount: 0,
            paymentMethod: paymentMethod || 'CASH',
            transactionTime: new Date(),
            // notes 字段可以保留用于操作员的额外备注
          },
        });
        
        await tx.member.update({
          where: { id: memberId },
          data: { lastVisitDate: new Date() },
        });

        return { newCard };
      });

      return result;
  });

}