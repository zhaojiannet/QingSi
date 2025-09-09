//backend/app/src/routes/members.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import Decimal from 'decimal.js';
import { schemas, createValidationHook, isValidId } from '../utils/validation.js';
import cache, { cacheKeys, invalidateCache } from '../utils/cache.js';

export default async function (fastify, opts) {
  // 创建新会员 - 添加输入验证
  fastify.post('/', {
    preValidation: createValidationHook(schemas.member.create)
  }, async (request, reply) => {
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
          id: generateId(),
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
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // 尝试从缓存获取
    const cacheKey = cacheKeys.memberList(pageNum, limitNum, search);
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
        page: pageNum,
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
  fastify.put('/:id', async (request, reply) => {
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




  // --- 逻辑删除 (常规操作) ---
  fastify.delete('/:id', async (request, reply) => {
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
  fastify.post('/:memberId/cards', async (request, reply) => {
    const { memberId } = request.params;
    const { cardTypeId, expiryDate } = request.body;

    if (!cardTypeId) {
      return reply.code(400).send({ message: '必须提供卡类型ID (cardTypeId)' });
    }

      const cardType = await prisma.cardType.findUnique({
        where: { id: cardTypeId },
      });

      if (!cardType) {
        return reply.code(404).send({ message: '卡类型不存在' });
      }

      const newCard = await prisma.card.create({
        data: {
          id: generateId(),
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
  fastify.post('/:id/pending', async (request, reply) => {
    const { id } = request.params;
    const { amount, description, createdAt } = request.body;
    
    if (!amount || amount <= 0) {
      return reply.code(400).send({ message: '挂账金额必须大于0' });
    }

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
        id: generateId(),
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
  fastify.delete('/:id/pending/:pendingId', async (request, reply) => {
    const { id, pendingId } = request.params;

    await prisma.$transaction(async (tx) => {
      // 1. 获取原挂账记录
      const pendingTransaction = await tx.transaction.findUnique({
        where: { id: pendingId }
      });

      if (!pendingTransaction || !pendingTransaction.isPending) {
        throw new Error('挂账记录不存在或已结清');
      }

      // 2. 设置原记录为已结清
      await tx.transaction.update({
        where: { id: pendingId },
        data: { isPending: false }
      });

      // 3. 创建清账记录
      await tx.transaction.create({
        data: {
          id: generateId(),
          memberId: id,
          totalAmount: Math.abs(pendingTransaction.totalAmount), // 正金额表示收回
          actualPaidAmount: Math.abs(pendingTransaction.totalAmount),
          discountAmount: 0,
          paymentMethod: 'OTHER',
          transactionType: 'PENDING_CLEAR',
          isPending: false,
          summary: `清账：${pendingTransaction.summary?.replace('挂账：', '') || ''}`,
          notes: `CLEAR_PENDING:${pendingId}`,
          transactionTime: new Date()
        }
      });
    });

    return { message: '挂账记录已删除' };
  });

  // 清除会员所有挂账（批量结清）
  fastify.delete('/:id/pending', async (request, reply) => {
    const { id } = request.params;

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

      // 2. 设置所有挂账为已结清
      await tx.transaction.updateMany({
        where: { 
          memberId: id,
          transactionType: 'PENDING',
          isPending: true
        },
        data: { isPending: false }
      });

      // 3. 计算总挂账金额并创建批量清账记录
      const totalAmount = pendingTransactions.reduce((sum, tx) => sum + Math.abs(tx.totalAmount), 0);
      
      await tx.transaction.create({
        data: {
          id: generateId(),
          memberId: id,
          totalAmount: totalAmount,
          actualPaidAmount: totalAmount,
          discountAmount: 0,
          paymentMethod: 'OTHER',
          transactionType: 'PENDING_CLEAR',
          isPending: false,
          summary: `批量清账（${pendingTransactions.length}笔）`,
          notes: 'CLEAR_ALL_PENDING',
          transactionTime: new Date()
        }
      });
    });

    return { message: '所有挂账已清除' };
  });

  
}