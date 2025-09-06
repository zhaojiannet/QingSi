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
        

        return { newCard };
      });

      return result;
  });

  // 删除会员卡接口
  fastify.delete('/:cardId', async (request, reply) => {
    const { cardId } = request.params;
    
    try {
      // 检查会员卡是否存在
      const card = await prisma.card.findUnique({
        where: { id: cardId },
        include: { cardType: true }
      });
      
      if (!card) {
        return reply.code(404).send({ message: '会员卡不存在' });
      }
      
      // 删除会员卡
      await prisma.card.delete({
        where: { id: cardId }
      });
      
      return { 
        message: '会员卡删除成功',
        deletedCard: {
          id: card.id,
          cardTypeName: card.cardType.name,
          balance: card.balance
        }
      };
      
    } catch (error) {
      return reply.code(500).send({ message: '删除会员卡失败', error: error.message });
    }
  });

}