//backend/app/src/routes/members.js

import prisma from '../db/prisma.js';
import { generateId, generateUniqueId } from '../utils/id.js';
import Decimal from 'decimal.js';
import cache, { cacheKeys, invalidateCache } from '../utils/cache.js';
import { getMemberBalanceSnapshot, atomicDecrementBalance } from '../utils/balance.js';
import { idParam } from '../schemas/common.js';
import { applyAuth } from '../utils/applyAuth.js';
import {
  createMemberSchema,
  updateMemberSchema,
  issueCardSchema,
  addPendingSchema,
  clearPendingSchema
} from '../schemas/members.js';

export default async function (fastify, opts) {
  applyAuth(fastify, opts);
  // 管理员和经理权限
  const managerAndAdminAccess = { onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])] };

  // 创建新会员 - JSON Schema 验证
  fastify.post('/', { schema: createMemberSchema }, async (request, reply) => {
      const { name, phone, gender, birthday, notes } = request.body;
      
      // 手机号唯一性校验（除了占位符 00000000000）
      if (phone && phone !== '00000000000') {
        const existingMember = await prisma.member.findFirst({
          where: { 
            phone: phone
          }
        });
        if (existingMember) {
          return reply.code(400).send({ message: '该手机号已被使用' });
        }
      }
      
      const newMember = await prisma.member.create({
        data: {
          id: await generateUniqueId(prisma.member),
          name,
          phone,
          gender,
          birthday: birthday ? new Date(birthday) : null,
          notes,
        },
      });
      
      // 清除会员列表缓存
      invalidateCache('members:list');
      
      return newMember;

  });


  // 获取会员列表 - 添加缓存
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 10, search = '', includeCards = 'false' } = request.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const validPageNum = Math.max(pageNum, 1);
    const skip = (validPageNum - 1) * limitNum;
    
    // 尝试从缓存获取
    const cacheKey = cacheKeys.memberList(validPageNum, limitNum, search);
    const cached = cache.get(cacheKey);
    if (cached && includeCards === 'false') {
      return cached;
    }


      const where = search ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        } : {};

      const shouldIncludeCards = includeCards === 'true';

      let membersData, total;
      
      if (shouldIncludeCards) {
        // 当需要完整卡片信息时，一次性查询所有数据
        [membersData, total] = await prisma.$transaction([
          prisma.member.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { registrationDate: 'desc' },
            include: {
              cards: {
                where: { status: 'ACTIVE' },
                select: {
                  id: true,
                  balance: true,
                  status: true,
                  // 自定义面值卡相关字段
                  isCustomCard: true,
                  customAmount: true,
                  discountSource: true,
                  customDiscountRate: true,
                  cardType: {
                    select: {
                      id: true,
                      name: true,
                      discountRate: true
                    }
                  }
                }
              },
              transactions: {
                where: {
                  transactionType: 'PENDING',
                  isPending: true
                },
                select: {
                  totalAmount: true
                }
              }
            }
          }),
          prisma.member.count({ where }),
        ]);
      } else {
        // 当只需要卡片数量时，使用更高效的查询
        [membersData, total] = await prisma.$transaction([
          prisma.member.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { registrationDate: 'desc' },
            include: {
              _count: {
                select: { 
                  cards: true, // 总卡数
                  transactions: {
                    where: {
                      transactionType: 'PENDING',
                      isPending: true
                    }
                  } // 挂账记录数
                }
              },
              cards: {
                select: {
                  id: true,
                  balance: true,
                  status: true
                }
              },
              transactions: {
                where: {
                  transactionType: 'PENDING',
                  isPending: true
                },
                select: {
                  totalAmount: true
                }
              }
            }
          }),
          prisma.member.count({ where }),
        ]);
      }
      
      // --- 优化：处理返回数据 ---
      const members = membersData.map(member => {
        // 计算总余额
        const totalBalance = member.cards
          .filter(card => card.status === 'ACTIVE')
          .reduce((sum, card) => sum.plus(new Decimal(card.balance)), new Decimal(0));
        
        // 计算总挂账（从Transaction表中的负金额计算）
        const totalPending = member.transactions
          ? member.transactions.reduce((sum, tx) => sum.plus(new Decimal(Math.abs(tx.totalAmount))), new Decimal(0))
          : new Decimal(0);
        
        if (shouldIncludeCards) {
          return { 
            ...member, 
            totalBalance: totalBalance.toNumber(),
            totalPending: totalPending.toNumber()
          };
        } else {
          // 保留原有格式，但添加余额和挂账信息
          return { 
            ...member, 
            totalBalance: totalBalance.toNumber(),
            totalPending: totalPending.toNumber()
          };
        }
      });


      reply.send({
        data: members,
        total,
        page: validPageNum,
        limit: limitNum,
      });

  });


  // 根据ID获取单个会员信息
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
      const member = await prisma.member.findUnique({
        where: { id },
        include: {
          cards: {
            include: {
              cardType: true,
            },
          },
        },
      });

      if (!member) {
        return reply.code(404).send({ message: '会员不存在' });
      }
      return member;

  });





   // --- 新增：更新会员信息 ---
  fastify.put('/:id', { schema: updateMemberSchema }, async (request, reply) => {
    const { id } = request.params;
    const { name, phone, gender, birthday, status, notes } = request.body;

    // 手机号唯一性校验（除了占位符 00000000000）
    if (phone && phone !== '00000000000') {
      const existingMember = await prisma.member.findFirst({
        where: { 
          phone: phone,
          id: { not: id }  // 排除当前更新的会员
        }
      });
      if (existingMember) {
        return reply.code(400).send({ message: '该手机号已被使用' });
      }
    }

    const updatedMember = await prisma.member.update({
        where: { id },
        data: {
          name,
          phone,
          gender,
          birthday: birthday ? new Date(birthday) : null,
          status,
          notes,
        },
      });
      return updatedMember;

  });




  // --- 逻辑删除 (常规操作) - 需要管理员或经理权限 ---
  fastify.delete('/:id', { ...managerAndAdminAccess, schema: { params: idParam } }, async (request, reply) => {
    const { id } = request.params;

    const activeCards = await prisma.card.findMany({
      where: { memberId: id, status: 'ACTIVE', balance: { gt: 0 } }
    });
    if (activeCards.length > 0) {
      return reply.code(400).send({ message: '注销失败：该会员名下仍有带余额的有效卡。' });
    }

    const updatedMember = await prisma.member.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    await prisma.card.updateMany({
      where: { memberId: id },
      data: { status: 'FROZEN' }
    });
    
    return { message: '会员已注销' };
  });

  // --- 物理删除 (高风险，仅ADMIN可用) ---
  fastify.delete('/:id/purge', { onRequest: [fastify.authenticate, fastify.hasRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params;
    
    const member = await prisma.member.findUnique({ where: { id } });
    
    if (!member) {
      return reply.code(404).send({ message: '会员不存在' });
    }
    
    // 安全校验：只允许删除状态为 DELETED 的会员
    if (member.status !== 'DELETED') {
      return reply.code(400).send({ message: '彻底删除失败：必须先将该会员注销。' });
    }

    // Prisma 会自动处理级联删除（如果 schema 中设置了 onDelete: Cascade）
    // 或者需要手动处理关联，以防止外键约束失败。
    // 为了数据完整性，我们选择解除关联，而不是删除历史记录。
    await prisma.$transaction(async (tx) => {
      // 1. 保存会员姓名到交易记录，然后解除关联
      await tx.transaction.updateMany({
        where: { memberId: id },
        data: { 
          memberId: null,
          customerName: member.name  // 保存会员姓名
        }
      });
      // 2. 保存会员姓名到预约记录，然后解除关联
      await tx.appointment.updateMany({
        where: { memberId: id },
        data: { 
          memberId: null,
          customerName: member.name  // 保存会员姓名到现有字段
        }
      });
      // 3. 删除所有卡片
      await tx.card.deleteMany({
        where: { memberId: id }
      });
      // 4. 最后，物理删除会员
      await tx.member.delete({
        where: { id: id }
      });
    });

    return { message: '会员数据已彻底清除。' };
  });


  // 为指定会员办理新卡
  fastify.post('/:memberId/cards', { schema: issueCardSchema }, async (request, reply) => {
    const { memberId } = request.params;
    const { cardTypeId, expiryDate } = request.body;

      const cardType = await prisma.cardType.findUnique({
        where: { id: cardTypeId },
      });

      if (!cardType) {
        return reply.code(404).send({ message: '卡类型不存在' });
      }

      const newCard = await prisma.card.create({
        data: {
          id: await generateUniqueId(prisma.card),
          member: {
            connect: { id: memberId },
          },
          cardType: {
            connect: { id: cardTypeId },
          },
          balance: cardType.initialPrice,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          status: 'ACTIVE',
        },
        include: {
          cardType: true,
        },
      });

      return newCard;

  });

  // 获取会员挂账列表（从Transaction表查询）
  fastify.get('/:id/pending', async (request, reply) => {
    const { id } = request.params;
    
    const pendingTransactions = await prisma.transaction.findMany({
      where: { 
        memberId: id,
        transactionType: 'PENDING',
        isPending: true
      },
      orderBy: { transactionTime: 'desc' },
      select: {
        id: true,
        totalAmount: true,
        summary: true,
        transactionTime: true
      }
    });

    // 转换格式以兼容前端（将负金额转为正数，transactionTime作为createdAt）
    const pendingPayments = pendingTransactions.map(tx => ({
      id: tx.id,
      memberId: id,
      amount: Math.abs(tx.totalAmount), // 转为正数
      description: tx.summary?.replace('挂账：', '') || null,
      createdAt: tx.transactionTime
    }));

    return pendingPayments;
  });

  // 添加会员挂账（创建Transaction记录）
  fastify.post('/:id/pending', { schema: addPendingSchema }, async (request, reply) => {
    const { id } = request.params;
    const { amount, description, createdAt } = request.body;

    // 幂等性检查：防止重复提交
    // 检查最近5秒内是否有相同的挂账记录
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const summary = description ? `挂账：${description}` : '挂账';
    
    const existingPending = await prisma.transaction.findFirst({
      where: {
        memberId: id,
        totalAmount: -amount,
        summary: summary,
        transactionType: 'PENDING',
        isPending: true,
        transactionTime: { gte: fiveSecondsAgo }
      }
    });

    if (existingPending) {
      // 返回已存在的记录，避免重复创建
      const pendingPayment = {
        id: existingPending.id,
        memberId: id,
        amount: amount,
        description: description || null,
        createdAt: existingPending.transactionTime
      };
      return { message: '挂账添加成功', pendingPayment };
    }

    const transaction = await prisma.transaction.create({
      data: {
        id: await generateUniqueId(prisma.transaction),
        memberId: id,
        totalAmount: -amount, // 负金额表示欠款
        actualPaidAmount: -amount,
        discountAmount: 0,
        paymentMethod: 'OTHER',
        transactionType: 'PENDING',
        isPending: true,
        summary: summary,
        transactionTime: createdAt ? new Date(createdAt) : new Date()
      }
    });

    // 返回兼容格式
    const pendingPayment = {
      id: transaction.id,
      memberId: id,
      amount: amount,
      description: description || null,
      createdAt: transaction.transactionTime
    };

    return { message: '挂账添加成功', pendingPayment };
  });

  // 删除单个挂账记录（结清挂账）
  fastify.delete('/:id/pending/:pendingId', { schema: clearPendingSchema }, async (request, reply) => {
    const { id, pendingId } = request.params;
    const { paymentMethod = 'OTHER', cardId } = request.body || {};

    await prisma.$transaction(async (tx) => {
      // 1. 获取原挂账记录
      const pendingTransaction = await tx.transaction.findUnique({
        where: { id: pendingId }
      });

      if (!pendingTransaction || !pendingTransaction.isPending) {
        throw new Error('挂账记录不存在或已结清');
      }

      const pendingAmount = Math.abs(pendingTransaction.totalAmount);
      let cardUsed = null;
      let paymentMethodToUse = paymentMethod;
      let clearSummary = `清账：${pendingTransaction.summary?.replace('挂账：', '') || ''}`;
      let clearNotes = `CLEAR_PENDING:${pendingId}`;
      let balanceSnapshot = null;

      // 2. 如果选择会员卡支付，验证卡片和余额
      if (paymentMethod === 'MEMBER_CARD') {
        if (!cardId) {
          throw new Error('使用会员卡支付时必须指定会员卡');
        }

        // 获取并验证会员卡
        cardUsed = await tx.card.findUnique({
          where: { id: cardId },
          include: { cardType: true }
        });

        if (!cardUsed || cardUsed.memberId !== id) {
          throw new Error('会员卡不存在或不属于该会员');
        }

        if (cardUsed.status !== 'ACTIVE') {
          throw new Error('会员卡已停用，无法使用');
        }

        // 验证余额充足（应用层预检查 + 下一步原子扣减保护并发超扣）
        if (new Decimal(cardUsed.balance).lessThan(new Decimal(pendingAmount))) {
          throw new Error(`会员卡余额不足，当前余额：¥${cardUsed.balance}，需要支付：¥${pendingAmount}`);
        }

        // 3. 原子扣减会员卡余额
        await atomicDecrementBalance(tx, cardId, Number(pendingAmount));

        // 生成卡片显示名称
        const cardDisplayName = cardUsed.isCustomCard
          ? `自定义面值卡(¥${new Decimal(cardUsed.customAmount).toFixed(2)})`
          : cardUsed.cardType.name;

        clearSummary = `清账（${cardDisplayName}支付）：${pendingTransaction.summary?.replace('挂账：', '') || ''}`;
        clearNotes = `CARD_CLEAR_PENDING:${pendingId}|CARD:${cardId}`;
        // 记录会员所有卡的余额快照（包含交易前后余额）
        const cardDeductions = { [cardId]: Number(pendingAmount) };
        balanceSnapshot = await getMemberBalanceSnapshot(tx, id, [cardId], cardDeductions);
      }

      // 4. 设置原记录为已结清
      await tx.transaction.update({
        where: { id: pendingId },
        data: { isPending: false }
      });

      // 5. 创建清账记录
      await tx.transaction.create({
        data: {
          id: await generateUniqueId(tx.transaction),
          memberId: id,
          totalAmount: pendingAmount, // 正金额表示收回
          actualPaidAmount: pendingAmount,
          discountAmount: 0,
          paymentMethod: paymentMethodToUse,
          cardId: cardUsed ? cardId : null,
          transactionType: 'PENDING_CLEAR',
          isPending: false,
          summary: clearSummary,
          notes: clearNotes,
          balanceSnapshot: balanceSnapshot,
          transactionTime: new Date()
        }
      });
    });

    const successMessage = paymentMethod === 'MEMBER_CARD' 
      ? '挂账已清除，会员卡余额已扣减'
      : '挂账记录已删除';

    return { message: successMessage };
  });

  // 清除会员所有挂账（批量结清）
  fastify.delete('/:id/pending', { schema: clearPendingSchema }, async (request, reply) => {
    const { id } = request.params;
    const { paymentMethod = 'OTHER', cardId } = request.body || {};

    await prisma.$transaction(async (tx) => {
      // 1. 获取所有未结清挂账
      const pendingTransactions = await tx.transaction.findMany({
        where: { 
          memberId: id,
          transactionType: 'PENDING',
          isPending: true
        }
      });

      if (pendingTransactions.length === 0) {
        return;
      }

      // 计算总挂账金额
      const totalAmount = pendingTransactions.reduce((sum, tx) => sum + Math.abs(tx.totalAmount), 0);

      let cardUsed = null;
      let paymentMethodToUse = paymentMethod;
      let clearNotesPrefix = 'CLEAR_ALL_PENDING';
      let balanceSnapshot = null;

      // 2. 如果选择会员卡支付，验证卡片和余额
      if (paymentMethod === 'MEMBER_CARD') {
        if (!cardId) {
          throw new Error('使用会员卡支付时必须指定会员卡');
        }

        // 获取并验证会员卡
        cardUsed = await tx.card.findUnique({
          where: { id: cardId },
          include: { cardType: true }
        });

        if (!cardUsed || cardUsed.memberId !== id) {
          throw new Error('会员卡不存在或不属于该会员');
        }

        if (cardUsed.status !== 'ACTIVE') {
          throw new Error('会员卡已停用，无法使用');
        }

        // 验证余额充足（应用层预检查 + 下一步原子扣减保护并发超扣）
        if (new Decimal(cardUsed.balance).lessThan(new Decimal(totalAmount))) {
          throw new Error(`会员卡余额不足，当前余额：¥${cardUsed.balance}，需要支付：¥${totalAmount}`);
        }

        // 3. 原子扣减会员卡余额
        await atomicDecrementBalance(tx, cardId, Number(totalAmount));

        clearNotesPrefix = 'CARD_CLEAR_ALL_PENDING';
        // 记录会员所有卡的余额快照（包含交易前后余额）
        const cardDeductions = { [cardId]: Number(totalAmount) };
        balanceSnapshot = await getMemberBalanceSnapshot(tx, id, [cardId], cardDeductions);
      }

      // 4. 设置所有挂账为已结清
      await tx.transaction.updateMany({
        where: { 
          memberId: id,
          transactionType: 'PENDING',
          isPending: true
        },
        data: { isPending: false }
      });

      // 5. 生成明细信息，只显示前3条，超出显示"等X笔"
      const details = pendingTransactions.map(tx => {
        let description = tx.summary?.replace('挂账：', '') || '未知项目';
        // 简化描述，提取关键信息
        if (description.includes('：')) {
          description = description.split('：')[0]; // 只取冒号前的部分
        }
        // 限制描述长度，避免过长
        if (description.length > 20) {
          description = description.substring(0, 17) + '...';
        }
        const amount = Math.abs(tx.totalAmount).toFixed(2);
        return `${description}(¥${amount})`;
      });
      
      let summaryText;
      const summaryPrefix = paymentMethod === 'MEMBER_CARD' 
        ? `批量清账（${cardUsed.isCustomCard 
            ? `自定义面值卡(¥${new Decimal(cardUsed.customAmount).toFixed(2)})` 
            : cardUsed.cardType.name}支付）：`
        : '批量清账：';
      
      if (details.length <= 3) {
        summaryText = `${summaryPrefix}${details.join('、')}`;
      } else {
        summaryText = `${summaryPrefix}${details.slice(0, 3).join('、')}等${details.length}笔`;
      }
      
      // 生成notes信息
      const pendingIds = pendingTransactions.map(tx => tx.id).join(',');
      const clearNotes = cardUsed 
        ? `${clearNotesPrefix}:${pendingIds}|CARD:${cardId}`
        : `${clearNotesPrefix}:${pendingIds}`;
      
      // 6. 创建批量清账记录
      await tx.transaction.create({
        data: {
          id: await generateUniqueId(tx.transaction),
          memberId: id,
          totalAmount: totalAmount,
          actualPaidAmount: totalAmount,
          discountAmount: 0,
          paymentMethod: paymentMethodToUse,
          cardId: cardUsed ? cardId : null,
          transactionType: 'PENDING_CLEAR',
          isPending: false,
          summary: summaryText,
          notes: clearNotes,
          balanceSnapshot: balanceSnapshot,
          transactionTime: new Date()
        }
      });
    });

    const successMessage = paymentMethod === 'MEMBER_CARD' 
      ? '所有挂账已清除，会员卡余额已扣减'
      : '所有挂账已清除';

    return { message: successMessage };
  });

  
}