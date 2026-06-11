// backend/app/src/routes/cards.js

import prisma from '../db/prisma.js';
import { generateId, generateUniqueId } from '../utils/id.js';
import Decimal from 'decimal.js';
import { issueWithTransactionSchema } from '../schemas/cards.js';
import { idParam } from '../schemas/common.js';
import { applyAuth } from '../utils/applyAuth.js';

export default async function (fastify, opts) {
  applyAuth(fastify, opts);

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
            id: await generateUniqueId(tx.card),
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
            id: await generateUniqueId(tx.transaction),
            member: { connect: { id: memberId } },
            ...(staffId && { staff: { connect: { id: staffId } } }),
            summary: `办理【${cardName} ${discountDisplay}】`,
            // 结构化记录所办卡片 ID，撤销办卡交易时据此精确删卡（不靠卡名+时间窗猜测）
            notes: `ISSUE_CARD:${newCard.id}`,
            totalAmount: cardBalance,
            actualPaidAmount: cardBalance,
            discountAmount: 0,
            paymentMethod: paymentMethod || 'CASH',
            transactionType: 'CARD_PURCHASE',
            transactionTime: new Date(),
          },
        });


        return { newCard };
      });

      return result;
  });

  // 会员卡不提供物理删除：有余额或有交易历史的卡删除会破坏资金与历史记录完整性，
  // 且会撞上 TransactionCardLink 外键约束。误办的卡通过撤销对应的办卡交易处理
  // （撤销办卡交易时会一并删除该卡）；停用卡片请改卡状态而非删除。

}
