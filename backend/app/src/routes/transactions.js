// backend/src/routes/transactions.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import Decimal from 'decimal.js';

export default async function (fastify, opts) {

  // --- 创建一笔新消费 (手动选卡或非会员) ---
  fastify.post('/', async (request, reply) => {
    const {
      memberId,
      staffId,
      serviceIds,
      paymentMethod,
      cardId,
      notes,
      appointmentId,
    } = request.body;

    if (!serviceIds || !serviceIds.length || !paymentMethod) {
      return reply.code(400).send({ message: '缺少必要参数：服务项目、支付方式' });
    }
    if (paymentMethod === 'MEMBER_CARD' && (!memberId || !cardId)) {
      return reply.code(400).send({ message: '使用会员卡支付时，必须提供会员ID和卡ID' });
    }

    try {
      const services = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
      if (services.length !== serviceIds.length) {
        return reply.code(404).send({ message: '一个或多个服务项目不存在' });
      }
      
      const totalAmount = services.reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));
      let actualPaidAmount = totalAmount;
      let cardUsed = null;

      if (paymentMethod === 'MEMBER_CARD') {
        cardUsed = await prisma.card.findUnique({
          where: { id: cardId },
          include: { cardType: true },
        });

        if (!cardUsed || cardUsed.memberId !== memberId) {
          return reply.code(404).send({ message: '会员卡不存在或不属于该会员' });
        }
        
        const cardBalance = new Decimal(cardUsed.balance);
        const discountRate = new Decimal(cardUsed.cardType.discountRate);
        actualPaidAmount = totalAmount.times(discountRate);

        if (cardBalance.lessThan(actualPaidAmount)) {
          return reply.code(400).send({ message: '该会员卡余额不足' });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        if (cardUsed) {
          await tx.card.update({
            where: { id: cardId },
            data: { balance: { decrement: actualPaidAmount.toNumber() } },
          });
        }
        
        if (memberId) {
          await tx.member.update({
            where: { id: memberId },
            data: { lastVisitDate: new Date() }
          });
        }

        const newTransaction = await tx.transaction.create({
          data: {
            id: generateId(),
            totalAmount: totalAmount.toNumber(),
            actualPaidAmount: actualPaidAmount.toNumber(),
            discountAmount: totalAmount.minus(actualPaidAmount).toNumber(),
            paymentMethod,
            notes,
            member: memberId ? { connect: { id: memberId } } : undefined,
            staff: staffId ? { connect: { id: staffId } } : undefined,
            cardUsed: cardId ? { connect: { id: cardId } } : undefined,
            items: {
              create: services.map(s => ({
                id: generateId(),
                serviceId: s.id,
                price: s.standardPrice,
                quantity: 1,
              })),
            },
            appointment: appointmentId ? { connect: { id: appointmentId } } : undefined,
          },
        });
        
        if (appointmentId) {
            await tx.appointment.update({
                where: { id: appointmentId },
                data: { status: 'COMPLETED' }
            });
        }

        return tx.transaction.findUnique({
            where: { id: newTransaction.id },
            include: { member: true, staff: true, items: { include: { service: true } } },
        });
      });
      
      const finalResult = {
        ...result,
        totalAmount: new Decimal(result.totalAmount).toFixed(2),
        actualPaidAmount: new Decimal(result.actualPaidAmount).toFixed(2),
        discountAmount: new Decimal(result.discountAmount).toFixed(2),
      };

      return finalResult;

    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'P2025') {
         return reply.code(404).send({ message: '关联的员工、会员或卡片不存在' });
      }
      return reply.code(500).send({ message: '创建消费记录失败' });
    }
  });

  // --- 组合支付结算接口 ---
  fastify.post('/combo-checkout', async (request, reply) => {
    const { memberId, serviceIds, staffId, notes, appointmentId } = request.body;

    if (!memberId || !serviceIds || !serviceIds.length) {
      return reply.code(400).send({ message: '缺少必要参数：会员、服务项目' });
    }

    try {
      const memberCards = await prisma.card.findMany({
        where: {
          memberId: memberId,
          status: 'ACTIVE',
          balance: { gt: 0 },
        },
        include: { cardType: true },
        orderBy: [
          { cardType: { discountRate: 'asc' } },
          { balance: 'asc' },
        ],
      });

      if (memberCards.length === 0) {
        return reply.code(400).send({ message: '该会员没有可用的会员卡' });
      }

      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
      });
      if (services.length !== serviceIds.length) {
        return reply.code(404).send({ message: '一个或多个服务项目不存在' });
      }
      const totalAmount = services.reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));
      
      let remainingAmountToPay = totalAmount;
      let actualPaidTotal = new Decimal(0);
      const paymentDetails = [];

      for (const card of memberCards) {
        if (remainingAmountToPay.isZero()) break;
        const cardBalance = new Decimal(card.balance);
        const discountRate = new Decimal(card.cardType.discountRate);
        const maxOriginalAmountThisCardCanCover = cardBalance.div(discountRate);
        const amountToCoverByThisCard = Decimal.min(remainingAmountToPay, maxOriginalAmountThisCardCanCover);
        const deduction = amountToCoverByThisCard.times(discountRate);
        
        actualPaidTotal = actualPaidTotal.plus(deduction);
        remainingAmountToPay = remainingAmountToPay.minus(amountToCoverByThisCard);

        paymentDetails.push({ cardId: card.id, deduction: deduction.toNumber() });
      }

      if (!remainingAmountToPay.isZero()) {
        return reply.code(400).send({ message: `所有会员卡余额不足，仍有 ¥${remainingAmountToPay.toFixed(2)} 未支付` });
      }

      const result = await prisma.$transaction(async (tx) => {
        for (const detail of paymentDetails) {
          await tx.card.update({
            where: { id: detail.cardId },
            data: { balance: { decrement: detail.deduction } },
          });
        }
        
        await tx.member.update({ where: { id: memberId }, data: { lastVisitDate: new Date() } });

        const newTransaction = await tx.transaction.create({
            data: {
                id: generateId(),
                totalAmount: totalAmount.toNumber(),
                actualPaidAmount: actualPaidTotal.toNumber(),
                discountAmount: totalAmount.minus(actualPaidTotal).toNumber(),
                paymentMethod: 'MEMBER_CARD',
                notes,
                member: { connect: { id: memberId } },
                staff: staffId ? { connect: { id: staffId } } : undefined,
                appointment: appointmentId ? { connect: { id: appointmentId } } : undefined,
                items: { create: services.map(s => ({ id: generateId(), serviceId: s.id, price: s.standardPrice })) },
            }
        });
        
        if(appointmentId) {
            await tx.appointment.update({
                where: { id: appointmentId },
                data: { status: 'COMPLETED' }
            });
        }

        return tx.transaction.findUnique({
            where: { id: newTransaction.id },
            include: { member: true, staff: true, items: { include: { service: true } } },
        });
      });
      
      const finalResult = {
        ...result,
        totalAmount: new Decimal(result.totalAmount).toFixed(2),
        actualPaidAmount: new Decimal(result.actualPaidAmount).toFixed(2),
        discountAmount: new Decimal(result.discountAmount).toFixed(2),
      };

      return finalResult;

    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'P2025') {
         return reply.code(404).send({ message: '关联的员工或会员不存在' });
      }
      return reply.code(500).send({ message: '创建消费记录失败' });
    }
  });

  // --- 组合支付“试算”接口 ---
  fastify.post('/combo-preview', async (request, reply) => {
    const { memberId, serviceIds } = request.body;
    if (!memberId || !serviceIds || !serviceIds.length) {
      return reply.code(400).send({ message: '缺少必要参数' });
    }

    const memberCards = await prisma.card.findMany({
        where: {
          memberId: memberId,
          status: 'ACTIVE',
          balance: { gt: 0 },
        },
        include: { cardType: true },
        orderBy: [
          { cardType: { discountRate: 'asc' } },
          { balance: 'asc' },
        ],
    });
    if (memberCards.length === 0) {
      return reply.code(400).send({ message: '该会员没有可用的会员卡' });
    }
    
    const services = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
    const totalAmount = services.reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));

    let remainingAmountToPay = totalAmount;
    let actualPaidTotal = new Decimal(0);
    const paymentDetails = [];

    for (const card of memberCards) {
      if (remainingAmountToPay.isZero()) break;
      const cardBalance = new Decimal(card.balance);
      const discountRate = new Decimal(card.cardType.discountRate);
      const maxOriginalAmountThisCardCanCover = cardBalance.div(discountRate);
      const amountToCoverByThisCard = Decimal.min(remainingAmountToPay, maxOriginalAmountThisCardCanCover);
      const deduction = amountToCoverByThisCard.times(discountRate);
      
      actualPaidTotal = actualPaidTotal.plus(deduction);
      remainingAmountToPay = remainingAmountToPay.minus(amountToCoverByThisCard);

      paymentDetails.push({
        cardId: card.id,
        cardName: card.cardType.name,
        deduction: deduction.toDecimalPlaces(2).toNumber(),
        originalAmountCovered: amountToCoverByThisCard.toDecimalPlaces(2).toNumber(),
        discountRate: card.cardType.discountRate
      });
    }

    if (!remainingAmountToPay.isZero()) {
      return reply.code(400).send({ message: `所有会员卡余额不足，仍有 ¥${remainingAmountToPay.toFixed(2)} 未支付` });
    }
    
    const discountAmount = totalAmount.minus(actualPaidTotal);

    return {
      totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
      actualPaidAmount: actualPaidTotal.toDecimalPlaces(2).toNumber(),
      discountAmount: discountAmount.toDecimalPlaces(2).toNumber(),
      paymentDetails,
    };
  });

  // --- 获取今日交易记录的接口 ---
  fastify.get('/today', async (request, reply) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const transactions = await prisma.transaction.findMany({
        where: {
          transactionTime: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          member: { select: { name: true } },
          staff: { select: { name: true } },
          items: { 
            include: { 
              service: { select: { name: true, standardPrice: true } } 
            } 
          },
        },
        orderBy: { transactionTime: 'desc' },
                // take: 20, // 只返回最多20条记录

      });

      const formattedTransactions = transactions.map(t => ({
        ...t,
        totalAmount: new Decimal(t.totalAmount).toFixed(2),
        actualPaidAmount: new Decimal(t.actualPaidAmount).toFixed(2),
        discountAmount: new Decimal(t.discountAmount).toFixed(2),
      }));

      return formattedTransactions;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ message: '获取今日交易记录失败' });
    }
  });
}