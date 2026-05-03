// backend/app/src/routes/cards.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import Decimal from 'decimal.js';
import { isValidId } from '../utils/validation.js';
import { issueWithTransactionSchema } from '../schemas/cards.js';

export default async function (fastify, opts) {
  // 管理员和经理权限
  const managerAndAdminAccess = { onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])] };

  fastify.post('/issue-with-transaction', { schema: issueWithTransactionSchema }, async (request, reply) => {
      const {
        memberId,
        cardTypeId,
        staffId,
        paymentMethod,
        isCustomCard = false,
        customAmount,
        discountSource = 'card_type',
        customDiscountRate
      } = request.body;

      const cardType = await prisma.cardType.findUnique({ where: { id: cardTypeId } });
      if (!cardType) {
        return reply.code(404).send({ message: '卡类型不存在' });
      }
      
      const result = await prisma.$transaction(async (tx) => {
        // 计算卡片初始金额和名称
        const cardBalance = isCustomCard ? customAmount : cardType.initialPrice;
        const cardName = isCustomCard ? `自定义面值卡(¥${new Decimal(customAmount).toFixed(2)})` : cardType.name;
        
        // 计算折扣率显示
        let discountDisplay = '';
        if (discountSource === 'custom' && customDiscountRate) {
          discountDisplay = `${Math.round(customDiscountRate * 10)}折`;
        } else {
          discountDisplay = `${Math.round(cardType.discountRate * 10)}折`;
        }
        
        const newCard = await tx.card.create({
          data: {
            id: generateId(),
            member: { connect: { id: memberId } },
            cardType: { connect: { id: cardTypeId } },
            balance: cardBalance,
            status: 'ACTIVE',
            // 自定义面值卡相关字段
            isCustomCard,
            ...(isCustomCard && { customAmount }),
            discountSource,
            ...(discountSource === 'custom' && { customDiscountRate }),
          },
        });

        // 创建交易记录
        await tx.transaction.create({
          data: {
            id: generateId(),
            member: { connect: { id: memberId } },
            ...(staffId && { staff: { connect: { id: staffId } } }), 
            summary: `办理【${cardName} ${discountDisplay}】`,
            totalAmount: cardBalance,
            actualPaidAmount: cardBalance,
            discountAmount: 0,
            paymentMethod: paymentMethod || 'CASH',
            transactionTime: new Date(),
          },
        });
        

        return { newCard };
      });

      return result;
  });

  // 删除会员卡接口 - 需要管理员或经理权限
  fastify.delete('/:cardId', managerAndAdminAccess, async (request, reply) => {
    const { cardId } = request.params;

    // 验证 ID 格式
    if (!isValidId(cardId)) {
      return reply.code(400).send({ message: '无效的会员卡ID格式' });
    }

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