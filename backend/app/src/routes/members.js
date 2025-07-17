//backend/app/src/routes/members.js


import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import Decimal from 'decimal.js'; // 确保引入 Decimal.js

export default async function (fastify, opts) {
  // 创建新会员
  fastify.post('/', async (request, reply) => {

      const { name, phone, gender, birthday, notes } = request.body;
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
      return newMember;

  });


  // 获取会员列表
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 10, search = '', includeCards = 'false' } = request.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;


      const where = search ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        } : {};

      const shouldIncludeCards = includeCards === 'true';

      const [membersData, total] = await prisma.$transaction([
        prisma.member.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { registrationDate: 'desc' },
          include: {
            // --- 核心修改：统一 include 逻辑 ---
            cards: {
              where: { status: 'ACTIVE' },
              include: {
                // 只有当需要完整卡片信息时，才进一步 include cardType
                cardType: shouldIncludeCards,
              }
            }
          }
        }),
        prisma.member.count({ where }),
      ]);
      
      // --- 核心修改：处理返回数据 ---
      const members = membersData.map(member => {
        if (shouldIncludeCards) {
          // 如果需要完整卡片，则计算总余额
          const totalBalance = member.cards.reduce(
              (sum, card) => sum.plus(new Decimal(card.balance)), 
              new Decimal(0)
          );
          return { ...member, totalBalance: totalBalance.toNumber() };
        } else {
          // 如果不需要完整卡片，则构造 _count
          const cardsCount = member.cards.length;
          // 删除 cards 数组，避免传输不必要的数据
          delete member.cards;
          return { ...member, _count: { cards: cardsCount } };
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




  
}