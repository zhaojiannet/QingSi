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
              pendingPayments: true
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
                  pendingPayments: true // 挂账记录数
                }
              },
              cards: {
                select: {
                  id: true,
                  balance: true,
                  status: true
                }
              },
              pendingPayments: {
                select: {
                  amount: true
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
        
        // 计算总挂账
        const totalPending = member.pendingPayments
          .reduce((sum, payment) => sum.plus(new Decimal(payment.amount)), new Decimal(0));
        
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
      // 1. 解除消费记录的关联
      await tx.transaction.updateMany({
        where: { memberId: id },
        data: { memberId: null }
      });
      // 2. 解除预约记录的关联
      await tx.appointment.updateMany({
        where: { memberId: id },
        data: { memberId: null }
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

  // 获取会员挂账列表
  fastify.get('/:id/pending', async (request, reply) => {
    const { id } = request.params;
    
    const pendingPayments = await prisma.pendingPayment.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' }
    });

    return pendingPayments;
  });

  // 添加会员挂账
  fastify.post('/:id/pending', async (request, reply) => {
    const { id } = request.params;
    const { amount, description, createdAt } = request.body;
    
    if (!amount || amount <= 0) {
      return reply.code(400).send({ message: '挂账金额必须大于0' });
    }

    const pendingPayment = await prisma.pendingPayment.create({
      data: {
        id: generateId(),
        memberId: id,
        amount: amount,
        description: description || null,
        createdAt: createdAt ? new Date(createdAt) : new Date()
      }
    });

    return { message: '挂账添加成功', pendingPayment };
  });

  // 删除单个挂账记录
  fastify.delete('/:id/pending/:pendingId', async (request, reply) => {
    const { pendingId } = request.params;

    await prisma.pendingPayment.delete({
      where: { id: pendingId }
    });

    return { message: '挂账记录已删除' };
  });

  // 清除会员所有挂账
  fastify.delete('/:id/pending', async (request, reply) => {
    const { id } = request.params;

    await prisma.pendingPayment.deleteMany({
      where: { memberId: id }
    });

    return { message: '所有挂账已清除' };
  });

  
}