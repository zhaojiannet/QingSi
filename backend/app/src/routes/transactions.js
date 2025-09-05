// backend/app/src/routes/transactions.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import Decimal from 'decimal.js';

// 四舍五入到两位小数的工具函数
const roundToTwoDecimals = (value) => {
  return Math.round(value * 100) / 100;
};

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

      // 获取去重的服务ID列表
      const uniqueServiceIds = [...new Set(serviceIds)];
      const services = await prisma.service.findMany({ where: { id: { in: uniqueServiceIds } } });
      
      // 检查是否所有服务都存在
      if (services.length !== uniqueServiceIds.length) {
        return reply.code(404).send({ message: '一个或多个服务项目不存在' });
      }
      
      // 计算数量 - 统计每个服务ID出现的次数
      const serviceQuantities = {};
      serviceIds.forEach(id => {
        serviceQuantities[id] = (serviceQuantities[id] || 0) + 1;
      });

      // 根据数量计算总金额
      const totalAmount = Object.keys(serviceQuantities).reduce((sum, serviceId) => {
        const service = services.find(s => s.id === serviceId);
        const quantity = serviceQuantities[serviceId];
        return sum.plus(new Decimal(service.standardPrice).times(quantity));
      }, new Decimal(0));
      
      // 分离参加折扣和不参加折扣的服务（考虑数量）
      const discountableAmount = Object.keys(serviceQuantities).reduce((sum, serviceId) => {
        const service = services.find(s => s.id === serviceId);
        if (!service.noDiscount) {
          const quantity = serviceQuantities[serviceId];
          return sum.plus(new Decimal(service.standardPrice).times(quantity));
        }
        return sum;
      }, new Decimal(0));
      
      const noDiscountAmount = Object.keys(serviceQuantities).reduce((sum, serviceId) => {
        const service = services.find(s => s.id === serviceId);
        if (service.noDiscount) {
          const quantity = serviceQuantities[serviceId];
          return sum.plus(new Decimal(service.standardPrice).times(quantity));
        }
        return sum;
      }, new Decimal(0));
      
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
              create: Object.keys(serviceQuantities).map(serviceId => ({
                id: generateId(),
                serviceId: serviceId,
                price: services.find(s => s.id === serviceId).standardPrice,
                quantity: serviceQuantities[serviceId],
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

  // --- 多卡联合支付接口（新逻辑：优先清空余额少的卡） ---
  fastify.post('/multi-card', async (request, reply) => {
    const {
      memberId,
      staffId,
      serviceIds,
      notes,
      appointmentId,
      manualPriceAdjustment,
    } = request.body;

    if (!serviceIds || !serviceIds.length || !memberId) {
      return reply.code(400).send({ message: '缺少必要参数：会员ID、服务项目' });
    }

    try {
      // 1. 获取服务信息
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

      // 2. 获取会员的有效卡片，按余额从小到大排序（优先清空小余额卡）
      const memberCards = await prisma.card.findMany({
        where: { 
          memberId,
          status: 'ACTIVE',
          balance: { gt: 0 }
        },
        include: { cardType: true },
        orderBy: { balance: 'asc' } // 关键修改：按余额升序排序
      });

      if (memberCards.length === 0) {
        return reply.code(400).send({ message: '该会员没有可用的会员卡' });
      }

      // 3. 计算多卡最佳支付方案（新逻辑）
      let remainingDiscountableAmount = discountableAmount;
      let remainingNoDiscountAmount = noDiscountAmount;
      let totalPaid = new Decimal(0);
      const cardPayments = [];

      for (const card of memberCards) {
        if (remainingDiscountableAmount.isZero() && remainingNoDiscountAmount.isZero()) break;
        
        const cardBalance = new Decimal(card.balance);
        const discountRate = new Decimal(card.cardType.discountRate);
        let cardUsed = new Decimal(0);
        let originalAmountCovered = new Decimal(0);
        let discountAmountFromCard = new Decimal(0);

        // 先支付无折扣服务（原价）
        if (!remainingNoDiscountAmount.isZero()) {
          const noDiscountPayment = Decimal.min(remainingNoDiscountAmount, cardBalance);
          cardUsed = cardUsed.plus(noDiscountPayment);
          originalAmountCovered = originalAmountCovered.plus(noDiscountPayment);
          remainingNoDiscountAmount = remainingNoDiscountAmount.minus(noDiscountPayment);
        }
        
        // 再支付可折扣服务（打折价）
        if (!remainingDiscountableAmount.isZero() && cardUsed.lessThan(cardBalance)) {
          const remainingBalance = cardBalance.minus(cardUsed);
          const maxDiscountableAmount = remainingBalance.div(discountRate);
          const discountablePayment = Decimal.min(remainingDiscountableAmount, maxDiscountableAmount);
          const discountableDeduction = discountablePayment.times(discountRate);
          
          // 四舍五入处理
          const roundedDeduction = new Decimal(roundToTwoDecimals(discountableDeduction.toNumber()));
          
          cardUsed = cardUsed.plus(roundedDeduction);
          originalAmountCovered = originalAmountCovered.plus(discountablePayment);
          discountAmountFromCard = discountAmountFromCard.plus(discountablePayment.minus(roundedDeduction));
          remainingDiscountableAmount = remainingDiscountableAmount.minus(discountablePayment);
        }

        if (originalAmountCovered.gt(0)) {
          // 四舍五入处理最终扣款金额
          const finalCardUsed = new Decimal(roundToTwoDecimals(cardUsed.toNumber()));
          
          totalPaid = totalPaid.plus(finalCardUsed);
          cardPayments.push({
            cardId: card.id,
            cardName: card.cardType.name,
            originalAmountCovered: roundToTwoDecimals(originalAmountCovered.toNumber()),
            actualPaid: roundToTwoDecimals(finalCardUsed.toNumber()),
            discountAmount: roundToTwoDecimals(discountAmountFromCard.toNumber()),
            newBalance: roundToTwoDecimals(cardBalance.minus(finalCardUsed).toNumber())
          });
        }
      }

      // 检查是否能够完成支付
      const totalRemaining = remainingDiscountableAmount.plus(remainingNoDiscountAmount);
      if (!totalRemaining.isZero()) {
        return reply.code(400).send({ 
          message: `所有会员卡余额不足，还需支付: ¥${roundToTwoDecimals(totalRemaining.toNumber())}`,
          cardPayments: cardPayments,
          shortfall: roundToTwoDecimals(totalRemaining.toNumber())
        });
      }

      // 4. 执行支付
      const result = await prisma.$transaction(async (tx) => {
        // 创建交易记录
        const newTransaction = await tx.transaction.create({
          data: {
            id: generateId(),
            memberId,
            staffId: staffId || null,
            summary: '项目消费',
            totalAmount: roundToTwoDecimals(totalAmount.toNumber()),
            actualPaidAmount: roundToTwoDecimals(totalPaid.toNumber()),
            discountAmount: roundToTwoDecimals(totalAmount.minus(totalPaid).toNumber()),
            paymentMethod: 'MEMBER_CARD',
            notes: `多卡联合支付: ${cardPayments.map(p => `${p.cardName}¥${p.actualPaid}`).join(' + ')}${notes ? ` | ${notes}` : ''}`,
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

        // 更新各个卡片余额
        for (const payment of cardPayments) {
          await tx.card.update({
            where: { id: payment.cardId },
            data: { balance: payment.newBalance }
          });
        }

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

      return {
        ...result,
        totalAmount: roundToTwoDecimals(parseFloat(result.totalAmount)),
        actualPaidAmount: roundToTwoDecimals(parseFloat(result.actualPaidAmount)),
        discountAmount: roundToTwoDecimals(parseFloat(result.discountAmount)),
        cardPayments: cardPayments
      };

    } catch (error) {
      console.error('多卡支付错误:', error);
      return reply.code(500).send({ message: '支付处理失败' });
    }
  });

}