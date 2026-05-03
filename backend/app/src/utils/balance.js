// backend/app/src/utils/balance.js
// 余额快照相关工具函数

import Decimal from 'decimal.js';

// 四舍五入到两位小数
export const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

// 原子扣减卡余额。
// 注意：Prisma 7 + adapter-mariadb 的 `update` 在并发下若初始 SELECT 看到旧 snapshot 余额>=amount，
// 即使 UPDATE 阶段实际 0 affected rows 也不会抛 P2025（隔离级别 RR + snapshot read）。
// 因此必须改用 updateMany + 检查 count（updateMany 直接用 ROW_COUNT 判定）。
export async function atomicDecrementBalance(tx, cardId, amount) {
  const result = await tx.card.updateMany({
    where: { id: cardId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (result.count !== 1) {
    const err = new Error('INSUFFICIENT_BALANCE');
    err.cardId = cardId;
    err.amount = amount;
    throw err;
  }
}

// 获取会员所有卡的余额快照（用于交易记录）
// cardDeductions: { cardId: deductionAmount } 用于计算交易前余额
export async function getMemberBalanceSnapshot(tx, memberId, usedCardIds = [], cardDeductions = {}) {
  if (!memberId) return null;

  // 获取会员所有有效卡（包括余额为0但刚扣完的卡）
  const allCards = await tx.card.findMany({
    where: {
      memberId: memberId,
      status: 'ACTIVE',
      OR: [
        { balance: { gt: 0 } },
        { id: { in: usedCardIds } }  // 确保使用过的卡也被包含
      ]
    },
    include: { cardType: true },
    orderBy: { balance: 'desc' }
  });

  if (allCards.length === 0) return null;

  // 构建各卡余额详情（包含交易前后余额）
  const cards = allCards.map(card => {
    const cardName = card.isCustomCard
      ? `自定义卡(¥${new Decimal(card.customAmount).toFixed(0)})`
      : card.cardType.name;

    const balanceAfter = new Decimal(card.balance).toNumber();
    const deduction = cardDeductions[card.id] || 0;
    const balanceBefore = new Decimal(card.balance).plus(deduction).toNumber();

    return {
      cardId: card.id,
      cardName: cardName,
      balanceBefore: balanceBefore,  // 交易前余额
      balanceAfter: balanceAfter,    // 交易后余额
      isUsed: usedCardIds.includes(card.id)
    };
  });

  // 计算总余额（交易前后）
  const totalBalanceAfter = cards.reduce((sum, c) => sum + c.balanceAfter, 0);
  const totalBalanceBefore = cards.reduce((sum, c) => sum + c.balanceBefore, 0);

  return {
    totalBalanceBefore: roundToTwoDecimals(totalBalanceBefore),
    totalBalanceAfter: roundToTwoDecimals(totalBalanceAfter),
    cards: cards
  };
}
