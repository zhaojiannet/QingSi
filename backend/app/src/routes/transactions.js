// backend/app/src/routes/transactions.js

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
      manualPriceAdjustment,
    } = request.body;

    if (!serviceIds || !serviceIds.length || !paymentMethod) {
      return reply.code(400).send({ message: '缺少必要参数：服务项目、支付方式' });
    }
    if (paymentMethod === 'MEMBER_CARD' && (!memberId || !cardId)) {
      return reply.code(400).send({ message: '使用会员卡支付时，必须提供会员ID和卡ID' });
    }


      const services = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
      if (services.length !== serviceIds.length) {
        return reply.code(404).send({ message: '一个或多个服务项目不存在' });
      }
      
      const totalAmount = services.reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));
      
      // 分离参加折扣和不参加折扣的服务
      const discountableAmount = services
        .filter(s => !s.noDiscount)
        .reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));
      const noDiscountAmount = services
        .filter(s => s.noDiscount)
        .reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));
      
      let actualPaidAmount = totalAmount;
      let discountAmount = new Decimal(0);
      let cardUsed = null;
      let isManualAdjustment = false;

      // 如果有手动价格调整
      if (manualPriceAdjustment && manualPriceAdjustment.adjustedAmount !== undefined) {
        actualPaidAmount = new Decimal(manualPriceAdjustment.adjustedAmount);
        isManualAdjustment = true;
        
        // 计算手动调整的折扣金额（可能为负数，表示加价）
        discountAmount = totalAmount.minus(actualPaidAmount);
      }

      if (paymentMethod === 'MEMBER_CARD') {
        cardUsed = await prisma.card.findUnique({
          where: { id: cardId },
          include: { cardType: true },
        });

        if (!cardUsed || cardUsed.memberId !== memberId) {
          return reply.code(404).send({ message: '会员卡不存在或不属于该会员' });
        }
        
        const cardBalance = new Decimal(cardUsed.balance);

        // 如果没有手动调整，应用会员卡折扣（仅对可折扣的服务）
        if (!isManualAdjustment) {
          const discountRate = new Decimal(cardUsed.cardType.discountRate);
          const discountedAmount = discountableAmount.times(discountRate);
          actualPaidAmount = discountedAmount.plus(noDiscountAmount);
          discountAmount = discountableAmount.minus(discountedAmount);
        }

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
            // 不设置summary，让前端显示具体的服务项目名称
            totalAmount: totalAmount.toNumber(),
            actualPaidAmount: actualPaidAmount.toNumber(),
            discountAmount: discountAmount.toNumber(),
            paymentMethod,
            notes: isManualAdjustment 
              ? `${notes ? notes + ' | ' : ''}价格调整：${manualPriceAdjustment.reason}`
              : notes,
            member: memberId ? { connect: { id: memberId } } : undefined,
            staff: staffId ? { connect: { id: staffId } } : undefined,
            cardUsed: cardId ? { connect: { id: cardId } } : undefined,
            items: {
              create: (() => {
                const serviceQuantities = {};
                serviceIds.forEach(id => {
                  serviceQuantities[id] = (serviceQuantities[id] || 0) + 1;
                });
                return Object.keys(serviceQuantities).map(serviceId => ({
                  id: generateId(),
                  serviceId: serviceId,
                  price: services.find(s => s.id === serviceId).standardPrice,
                  quantity: serviceQuantities[serviceId],
                }));
              })(),
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


  });

  // --- 组合支付结算接口 ---
  fastify.post('/combo-checkout', async (request, reply) => {
    const { memberId, serviceIds, staffId, notes, appointmentId, manualPriceAdjustment } = request.body;

    if (!memberId || !serviceIds || !serviceIds.length) {
      return reply.code(400).send({ message: '缺少必要参数：会员、服务项目' });
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

      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
      });
      if (services.length !== serviceIds.length) {
        return reply.code(404).send({ message: '一个或多个服务项目不存在' });
      }
      const totalAmount = services.reduce((sum, s) => sum.plus(new Decimal(s.standardPrice)), new Decimal(0));
      
      let remainingAmountToPay = totalAmount;
      let actualPaidTotal = new Decimal(0);
      let isManualAdjustment = false;
      const paymentDetails = [];

      // 如果有手动价格调整，直接使用调整后的金额
      if (manualPriceAdjustment && manualPriceAdjustment.adjustedAmount !== undefined) {
        actualPaidTotal = new Decimal(manualPriceAdjustment.adjustedAmount);
        isManualAdjustment = true;
        
        // 检查余额是否足够支付调整后的金额
        const totalBalance = memberCards.reduce((sum, card) => sum.plus(new Decimal(card.balance)), new Decimal(0));
        if (totalBalance.lessThan(actualPaidTotal)) {
          return reply.code(400).send({ message: `所有会员卡余额不足，余额总计 ¥${totalBalance.toFixed(2)}，需支付 ¥${actualPaidTotal.toFixed(2)}` });
        }

        // 按卡余额分配扣款
        let remainingToDeduct = actualPaidTotal;
        for (const card of memberCards) {
          if (remainingToDeduct.isZero()) break;
          const cardBalance = new Decimal(card.balance);
          const deduction = Decimal.min(cardBalance, remainingToDeduct);
          
          remainingToDeduct = remainingToDeduct.minus(deduction);
          paymentDetails.push({ cardId: card.id, deduction: deduction.toNumber() });
        }
      } else {

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
      }

      if (!isManualAdjustment && !remainingAmountToPay.isZero()) {
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
                // 不设置summary，让前端显示具体的服务项目名称
                totalAmount: totalAmount.toNumber(),
                actualPaidAmount: actualPaidTotal.toNumber(),
                discountAmount: totalAmount.minus(actualPaidTotal).toNumber(),
                paymentMethod: 'MEMBER_CARD',
                notes: isManualAdjustment 
                  ? `${notes ? notes + ' | ' : ''}价格调整：${manualPriceAdjustment.reason}`
                  : notes,
                member: { connect: { id: memberId } },
                staff: staffId ? { connect: { id: staffId } } : undefined,
                appointment: appointmentId ? { connect: { id: appointmentId } } : undefined,
                items: { 
                  create: (() => {
                    const serviceQuantities = {};
                    serviceIds.forEach(id => {
                      serviceQuantities[id] = (serviceQuantities[id] || 0) + 1;
                    });
                    return Object.keys(serviceQuantities).map(serviceId => ({
                      id: generateId(),
                      serviceId: serviceId,
                      price: services.find(s => s.id === serviceId).standardPrice,
                      quantity: serviceQuantities[serviceId],
                    }));
                  })(),
                },
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
          member: { select: { name: true, phone: true } },
          staff: { select: { name: true } },
          cardUsed: { 
            include: { 
              cardType: { select: { name: true, discountRate: true } } 
            } 
          },
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

  });



    // --- 优化点2: 支持服务器端搜索和分页的流水查询接口 ---
  fastify.get('/', async (request, reply) => {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50,
      search = ''  // 新增搜索参数
    } = request.query;
    
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 200); // 最大200条防止性能问题
    const offset = (pageNum - 1) * limitNum;
    
    const where = {};
    
    // 日期范围过滤
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.transactionTime = { gte: start, lte: end };
    }
    
    // 服务器端搜索过滤
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        {
          member: {
            name: { contains: searchTerm }
          }
        },
        {
          member: {
            phone: { contains: searchTerm }
          }
        }
      ];
    }

    // 并行执行查询和计数
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          memberId: true,
          staffId: true,
          summary: true,
          totalAmount: true,
          actualPaidAmount: true,
          discountAmount: true,
          paymentMethod: true,
          cardId: true,
          transactionTime: true,
          notes: true,
          member: { 
            select: { 
              name: true, 
              phone: true 
            } 
          },
          staff: { 
            select: { 
              name: true 
            } 
          },
          cardUsed: { 
            select: {
              id: true,
              cardType: { 
                select: { 
                  name: true, 
                  discountRate: true 
                } 
              }
            }
          },
          items: { 
            select: {
              id: true,
              price: true,
              quantity: true,
              service: { 
                select: { 
                  name: true, 
                  standardPrice: true 
                } 
              }
            }
          },
        },
        orderBy: [
          { transactionTime: 'desc' },
          { id: 'desc' }  // 添加二级排序确保结果一致
        ],
        skip: offset,
        take: limitNum
      }),
      prisma.transaction.count({ where })
    ]);

    const formattedTransactions = transactions.map(t => ({
      ...t,
      totalAmount: new Decimal(t.totalAmount).toFixed(2),
      actualPaidAmount: new Decimal(t.actualPaidAmount).toFixed(2),
      discountAmount: new Decimal(t.discountAmount).toFixed(2),
    }));

    // 返回分页结果
    return {
      data: formattedTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: offset + formattedTransactions.length < total
      }
    };
  });



}