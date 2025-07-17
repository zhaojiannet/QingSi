// src/routes/members.js
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

  // --- 新增：删除会员 (物理删除) ---
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
      // 在删除会员前，先处理关联数据，避免外键约束失败
      // 例如：将关联的卡片也删除或置为无效
      await prisma.card.deleteMany({
        where: { memberId: id },
      });
      // 注意：交易记录和预约记录通常不应删除，可以保留或解除关联

      await prisma.member.delete({
        where: { id },
      });
      return { message: '会员已彻底删除' };

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