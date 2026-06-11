// backend/app/src/routes/transactions.js

import prisma from '../db/prisma.js';
import { generateId, generateUniqueId } from '../utils/id.js';
import Decimal from 'decimal.js';
import { getMemberBalanceSnapshot, atomicDecrementBalance } from '../utils/balance.js';
import {
  createTransactionSchema,
  voidTransactionSchema,
  transactionsQuerySchema
} from '../schemas/transactions.js';
import { applyAuth } from '../utils/applyAuth.js';
import { shopTodayRange, shopDayRange } from '../utils/shopTime.js';

// 取卡的有效折扣率：自定义折扣卡用 customDiscountRate，否则用卡类型的折扣率。
// 计费必须与展示折扣（同样优先 customDiscountRate）保持一致。
function effectiveDiscountRate(card) {
  if (card.discountSource === 'custom' && card.customDiscountRate != null) {
    return new Decimal(card.customDiscountRate);
  }
  return new Decimal(card.cardType.discountRate);
}

// 智能卡片支付处理函数
async function handleSmartCardPayment(request, reply, memberId, serviceIds, manualPriceAdjustment, notes, customerName, customTransactionTime) {
  // 获取会员的所有有效卡片
  const memberCards = await prisma.card.findMany({
    where: {
      memberId: memberId,
      status: 'ACTIVE',
      balance: { gt: 0 },
      OR: [
        { expiryDate: null },
        { expiryDate: { gte: new Date() } },
      ],
    },
    include: { cardType: true },
    orderBy: { balance: 'asc' } // 优先使用余额少的卡
  });

  if (memberCards.length === 0) {
    return reply.code(400).send({ message: '该会员没有可用的会员卡' });
  }

  // 计算消费总额
  const uniqueServiceIds = [...new Set(serviceIds)];
  const services = await prisma.service.findMany({ where: { id: { in: uniqueServiceIds } } });
  
  if (services.length !== uniqueServiceIds.length) {
    return reply.code(404).send({ message: '一个或多个服务项目不存在' });
  }

  // 计算服务数量和金额
  const serviceQuantities = {};
  serviceIds.forEach(id => {
    serviceQuantities[id] = (serviceQuantities[id] || 0) + 1;
  });

  const totalAmount = Object.keys(serviceQuantities).reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    const quantity = serviceQuantities[serviceId];
    return sum.plus(new Decimal(service.standardPrice).times(quantity));
  }, new Decimal(0));

  // 分离参加折扣和不参加折扣的服务金额
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

  // 检查是否有手动价格调整
  let targetAmount = totalAmount;
  if (manualPriceAdjustment && manualPriceAdjustment.adjustedAmount !== undefined) {
    targetAmount = new Decimal(manualPriceAdjustment.adjustedAmount);
  }

  // 选择首选卡：余额少的优先（清空小额卡策略）
  // memberCards 已按 balance asc 排序，取第一张有余额的卡
  const preferredCard = memberCards[0];

  // 尝试用首选卡（余额最少的卡）支付
  const cardBalance = new Decimal(preferredCard.balance);
  
  // 如果有价格调整，直接比较调整后的金额与卡片余额
  if (manualPriceAdjustment && manualPriceAdjustment.adjustedAmount !== undefined) {
    if (cardBalance.greaterThanOrEqualTo(targetAmount)) {
      // 首选卡余额够支付调整后的金额，使用单卡支付
      request.body.cardId = preferredCard.id;
      return undefined; // 让调用方继续执行主流程
    }
  } else {
    // 正常折扣计算：考虑noDiscount服务
    const discountRate = effectiveDiscountRate(preferredCard);
    const discountedAmount = discountableAmount.times(discountRate);
    const totalNeededAmount = discountedAmount.plus(noDiscountAmount);
    
    if (cardBalance.greaterThanOrEqualTo(totalNeededAmount)) {
      // 首选卡余额够，使用单卡支付
      request.body.cardId = preferredCard.id;
      return undefined; // 让调用方继续执行主流程
    }
  }

  // 首选卡余额不够，使用多卡组合支付
  // 如果有价格调整，使用调整后的金额进行多卡支付
  let remainingAmountToPay = targetAmount;
  let actualPaidTotal = new Decimal(0);
  const paymentDetails = [];

  // 如果有手动价格调整，直接使用调整后的金额
  if (manualPriceAdjustment && manualPriceAdjustment.adjustedAmount !== undefined) {
    // 使用多卡最优支付算法 - 手动调价情况
    for (const card of memberCards) {
      if (remainingAmountToPay.isZero()) break;
      
      const cardBalance = new Decimal(card.balance);
      const amountToCoverByThisCard = Decimal.min(remainingAmountToPay, cardBalance);
      const deduction = amountToCoverByThisCard;
      
      if (deduction.greaterThan(0)) {
        remainingAmountToPay = remainingAmountToPay.minus(amountToCoverByThisCard);
        actualPaidTotal = actualPaidTotal.plus(deduction);
        // 生成正确的卡片名称（包含自定义面值卡）
        const cardName = card.isCustomCard 
          ? `自定义面值卡(¥${new Decimal(card.customAmount).toFixed(2)})`
          : card.cardType.name;
        
        paymentDetails.push({
          cardId: card.id,
          cardName: cardName,
          originalAmountCovered: amountToCoverByThisCard.toNumber(),
          actualPaid: deduction.toNumber(),
          discountAmount: 0, // 价格调整情况下不显示折扣
          newBalance: cardBalance.minus(deduction).toNumber()
        });
      }
    }
  } else {
    // 正常情况：先支付不打折部分，再支付打折部分
    let remainingNoDiscountAmount = noDiscountAmount;
    let remainingDiscountableAmount = discountableAmount;
    
    // 使用多卡最优支付算法 - 正常折扣情况
    for (const card of memberCards) {
      if (remainingNoDiscountAmount.isZero() && remainingDiscountableAmount.isZero()) break;
      
      const cardBalance = new Decimal(card.balance);
      let totalDeduction = new Decimal(0);
      let totalOriginalCovered = new Decimal(0);
      let totalDiscountAmount = new Decimal(0);
      
      // 先支付不打折部分（按原价扣费）
      if (!remainingNoDiscountAmount.isZero()) {
        const noDiscountCovered = Decimal.min(remainingNoDiscountAmount, cardBalance.minus(totalDeduction));
        if (noDiscountCovered.greaterThan(0)) {
          totalDeduction = totalDeduction.plus(noDiscountCovered);
          totalOriginalCovered = totalOriginalCovered.plus(noDiscountCovered);
          remainingNoDiscountAmount = remainingNoDiscountAmount.minus(noDiscountCovered);
          remainingAmountToPay = remainingAmountToPay.minus(noDiscountCovered);
        }
      }
      
      // 再支付打折部分（按折扣价扣费）
      if (!remainingDiscountableAmount.isZero() && totalDeduction.lessThan(cardBalance)) {
        const discountRate = effectiveDiscountRate(card);
        const remainingBalance = cardBalance.minus(totalDeduction);
        const maxDiscountableAmountThisCardCanCover = remainingBalance.div(discountRate);
        const discountableCovered = Decimal.min(remainingDiscountableAmount, maxDiscountableAmountThisCardCanCover);
        const discountableDeduction = discountableCovered.times(discountRate);
        
        if (discountableDeduction.greaterThan(0)) {
          totalDeduction = totalDeduction.plus(discountableDeduction);
          totalOriginalCovered = totalOriginalCovered.plus(discountableCovered);
          totalDiscountAmount = totalDiscountAmount.plus(discountableCovered.minus(discountableDeduction));
          remainingDiscountableAmount = remainingDiscountableAmount.minus(discountableCovered);
          remainingAmountToPay = remainingAmountToPay.minus(discountableCovered);
        }
      }
      
      // 如果这张卡有扣费，记录支付详情
      if (totalDeduction.greaterThan(0)) {
        actualPaidTotal = actualPaidTotal.plus(totalDeduction);
        // 生成正确的卡片名称（包含自定义面值卡）
        const cardName = card.isCustomCard 
          ? `自定义面值卡(¥${new Decimal(card.customAmount).toFixed(2)})`
          : card.cardType.name;
        
        paymentDetails.push({
          cardId: card.id,
          cardName: cardName,
          originalAmountCovered: totalOriginalCovered.toNumber(),
          actualPaid: totalDeduction.toNumber(),
          discountAmount: totalDiscountAmount.toNumber(),
          newBalance: cardBalance.minus(totalDeduction).toNumber()
        });
      }
    }
  }

  if (!remainingAmountToPay.isZero()) {
    return reply.code(400).send({ message: '所有会员卡余额不足' });
  }

  // 执行多卡支付事务
  const result = await prisma.$transaction(async (tx) => {
    // 原子扣减所有使用的卡余额
    for (const detail of paymentDetails) {
      await atomicDecrementBalance(tx, detail.cardId, detail.actualPaid);
    }

    // 获取使用的卡ID列表和扣款金额
    const usedCardIds = paymentDetails.map(d => d.cardId);
    const cardDeductions = {};
    paymentDetails.forEach(d => {
      cardDeductions[d.cardId] = d.actualPaid;  // 实际扣款金额
    });
    // 记录会员所有卡的余额快照（含交易前后）
    const balanceSnapshot = await getMemberBalanceSnapshot(tx, memberId, usedCardIds, cardDeductions);

    // 计算多卡支付的实际折扣金额
    const totalDiscountGiven = paymentDetails.reduce((sum, detail) => {
      return sum.plus(new Decimal(detail.discountAmount || 0));
    }, new Decimal(0));

    // 创建交易记录 + 同步写多卡 link 表
    const newTransaction = await tx.transaction.create({
      data: {
        id: await generateUniqueId(tx.transaction),
        memberId: memberId,
        customerName: customerName || null,
        summary: '项目消费',
        totalAmount: totalAmount.toNumber(),
        actualPaidAmount: actualPaidTotal.toNumber(),
        discountAmount: totalDiscountGiven.toNumber(),
        paymentMethod: 'MEMBER_CARD',
        cardId: null, // 多卡支付不关联单一卡片
        balanceSnapshot: balanceSnapshot,
        notes: `${customTransactionTime ? '[手动设置时间] ' : ''}${notes ? notes + ' | ' : ''}多卡联合支付: ${paymentDetails.map(d => `${d.cardName}¥${new Decimal(d.actualPaid).toFixed(2)}`).join(' + ')}`,
        transactionTime: customTransactionTime ? new Date(customTransactionTime) : new Date(),
        cardLinks: {
          create: paymentDetails.map(d => ({
            cardId: d.cardId,
            cardName: d.cardName,
            amount: d.actualPaid,
          })),
        },
      }
    });

    // 创建交易明细
    const transactionItems = Object.keys(serviceQuantities).map(serviceId => ({
      id: generateId(),
      transactionId: newTransaction.id,
      serviceId: serviceId,
      price: services.find(s => s.id === serviceId).standardPrice,
      quantity: serviceQuantities[serviceId],
    }));

    await tx.transactionItem.createMany({
      data: transactionItems
    });

    return { newTransaction, transactionItems, paymentDetails };
  });

  // 返回结果
  return reply.send({
    ...result.newTransaction,
    items: result.transactionItems.map(item => ({
      ...item,
      service: services.find(s => s.id === item.serviceId)
    })),
    cardPayments: result.paymentDetails,
    member: await prisma.member.findUnique({ where: { id: memberId } })
  });
}

export default async function (fastify, opts) {
  applyAuth(fastify, opts);

  // --- 创建一笔新消费 (手动选卡或非会员) ---
  fastify.post('/', { schema: createTransactionSchema }, async (request, reply) => {
    const {
      memberId,
      customerName,
      staffId,
      serviceIds,
      paymentMethod,
      notes,
      appointmentId,
      manualPriceAdjustment,
      customTransactionTime,
    } = request.body;

    let cardId = request.body.cardId;

    if (paymentMethod === 'MEMBER_CARD' && !memberId) {
      return reply.code(400).send({ message: '使用会员卡支付时，必须提供会员ID' });
    }

    // 验证会员是否存在
    if (memberId) {
      const member = await prisma.member.findUnique({ where: { id: memberId } });
      if (!member) {
        return reply.code(404).send({ message: '会员不存在' });
      }
    }

    // 验证服务项目数量限制
    if (serviceIds.length > 20) {
      return reply.code(400).send({ message: '单次消费服务项目不能超过20个' });
    }
    
    // 智能支付：如果是会员卡支付但未指定cardId，自动选择最优支付方式
    if (paymentMethod === 'MEMBER_CARD' && !cardId) {
      const smartPaymentResult = await handleSmartCardPayment(request, reply, memberId, serviceIds, manualPriceAdjustment, notes, customerName, customTransactionTime);
      
      // 如果是多卡支付或遇到错误，直接返回结果
      if (smartPaymentResult !== undefined) {
        return smartPaymentResult;
      }
      
      // 如果是单卡支付，继续执行下面的流程（此时request.body.cardId已经被设置）
      // 重新获取cardId值以便后续使用
      cardId = request.body.cardId;
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

        // 校验卡状态与有效期：停用（FROZEN/DEPLETED/EXPIRED）或已过期的卡不能扣款
        if (cardUsed.status !== 'ACTIVE') {
          return reply.code(400).send({ message: '该会员卡已停用，无法使用' });
        }
        if (cardUsed.expiryDate && new Date(cardUsed.expiryDate) < new Date()) {
          return reply.code(400).send({ message: '该会员卡已过期，无法使用' });
        }

        const cardBalance = new Decimal(cardUsed.balance);

        // 如果没有手动调整，应用会员卡折扣（仅对可折扣的服务）
        if (!isManualAdjustment) {
          const discountRate = effectiveDiscountRate(cardUsed);
          const discountedAmount = discountableAmount.times(discountRate);
          actualPaidAmount = discountedAmount.plus(noDiscountAmount);
          discountAmount = discountableAmount.minus(discountedAmount);
        }

        if (cardBalance.lessThan(actualPaidAmount)) {
          return reply.code(400).send({ message: '该会员卡余额不足' });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        let balanceSnapshot = null;

        if (cardUsed) {
          const deductionAmount = actualPaidAmount.toNumber();
          await atomicDecrementBalance(tx, cardId, deductionAmount);
          // 记录会员所有卡的余额快照（含交易前后）
          balanceSnapshot = await getMemberBalanceSnapshot(tx, memberId, [cardId], { [cardId]: deductionAmount });
        }

        const newTransaction = await tx.transaction.create({
          data: {
            id: await generateUniqueId(tx.transaction),
            // 不设置summary，让前端显示具体的服务项目名称
            customerName: customerName || null,
            totalAmount: totalAmount.toNumber(),
            actualPaidAmount: actualPaidAmount.toNumber(),
            discountAmount: discountAmount.toNumber(),
            paymentMethod,
            balanceSnapshot: balanceSnapshot,
            notes: (() => {
              let finalNotes = '';
              if (customTransactionTime) {
                finalNotes += '[手动设置时间] ';
              }
              if (isManualAdjustment) {
                finalNotes += `${notes ? notes + ' | ' : ''}价格调整：${manualPriceAdjustment.reason}`;
              } else {
                finalNotes += notes || '';
              }
              return finalNotes || null;
            })(),
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
            transactionTime: customTransactionTime ? new Date(customTransactionTime) : undefined, // 如果提供了自定义时间则使用，否则使用默认值
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

  // --- 获取今日交易记录的接口 ---
  fastify.get('/today', async (request, reply) => {
      const { page = 1, limit = 20 } = request.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // 按门店本地时区（UTC+8）计算"今天"范围，避免容器 UTC 跨日错位
      const { start: today, end: tomorrow } = shopTodayRange();

      // 获取总记录数
      const totalCount = await prisma.transaction.count({
        where: {
          transactionTime: {
            gte: today,
            lte: tomorrow,
          },
        },
      });

      const transactions = await prisma.transaction.findMany({
        where: {
          transactionTime: {
            gte: today,
            lte: tomorrow,
          },
        },
        include: {
          member: { select: { name: true, phone: true } },
          staff: { select: { name: true } },
          cardUsed: { 
            select: {
              id: true,
              isCustomCard: true,
              customAmount: true,
              customDiscountRate: true,
              cardType: { 
                select: { 
                  name: true, 
                  discountRate: true 
                } 
              }
            }
          },
          items: {
            include: {
              service: { select: { name: true, standardPrice: true } }
            }
          },
          cardLinks: true,
        },
        orderBy: { transactionTime: 'desc' },
        skip: skip,
        take: limitNum,
      });

      const formattedTransactions = transactions.map(t => {
        // 处理卡片显示名称
        let cardDisplayName = null;
        if (t.cardUsed) {
          if (t.cardUsed.isCustomCard) {
            const discountRate = t.cardUsed.customDiscountRate || t.cardUsed.cardType.discountRate;
            cardDisplayName = `自定义面值卡(¥${new Decimal(t.cardUsed.customAmount).toFixed(2)}) ${discountRate * 10}折`;
          } else {
            cardDisplayName = t.cardUsed.cardType.name;
          }
        }
        
        return {
          ...t,
          totalAmount: new Decimal(t.totalAmount).toFixed(2),
          actualPaidAmount: new Decimal(t.actualPaidAmount).toFixed(2),
          discountAmount: new Decimal(t.discountAmount).toFixed(2),
          cardDisplayName: cardDisplayName
        };
      });

      return {
        data: formattedTransactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          hasMore: skip + limitNum < totalCount
        }
      };

  });



    // --- 优化点2: 支持服务器端搜索和分页的流水查询接口 ---
  fastify.get('/', { schema: transactionsQuerySchema }, async (request, reply) => {
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
    
    // 日期范围过滤（按门店本地时区 UTC+8 计算边界）
    if (startDate && endDate) {
      const { start, end } = shopDayRange(startDate, endDate);
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
        },
        {
          customerName: { contains: searchTerm }
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
          customerName: true,
          staffId: true,
          summary: true,
          totalAmount: true,
          actualPaidAmount: true,
          discountAmount: true,
          paymentMethod: true,
          cardId: true,
          transactionTime: true,
          transactionType: true,
          notes: true,
          balanceSnapshot: true,
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
              isCustomCard: true,
              customAmount: true,
              customDiscountRate: true,
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
          cardLinks: {
            select: { cardId: true, cardName: true, amount: true }
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

    const formattedTransactions = transactions.map(t => {
      // 处理卡片显示名称
      let cardDisplayName = null;
      if (t.cardUsed) {
        if (t.cardUsed.isCustomCard) {
          const discountRate = t.cardUsed.customDiscountRate || t.cardUsed.cardType.discountRate;
          cardDisplayName = `自定义面值卡(¥${new Decimal(t.cardUsed.customAmount).toFixed(2)}) ${discountRate * 10}折`;
        } else {
          cardDisplayName = t.cardUsed.cardType.name;
        }
      }
      
      return {
        ...t,
        totalAmount: new Decimal(t.totalAmount).toFixed(2),
        actualPaidAmount: new Decimal(t.actualPaidAmount).toFixed(2),
        discountAmount: new Decimal(t.discountAmount).toFixed(2),
        cardDisplayName: cardDisplayName
      };
    });

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

  // 交易不提供物理删除：删除会绕过撤销流程（不退卡余额、不写审计、无时限校验）。
  // 需要冲正一笔交易时统一走下方的撤销接口 POST /:transactionId/void。

  // --- 撤销交易接口 ---
  fastify.post('/:transactionId/void', {
    onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])],
    schema: voidTransactionSchema
  }, async (request, reply) => {
    const { transactionId } = request.params;
    const { reason } = request.body;
    const userId = request.user.id;

    // 获取操作人信息（事务外查询，减少事务时间）
    const operator = await prisma.user.findUnique({
      where: { id: userId },
      include: { staff: { select: { name: true } } }
    });
    const operatorName = operator?.staff?.name || operator?.username || '未知用户';

    // 3. 执行撤销事务（所有关键检查和操作在事务内完成）
    try {
    const result = await prisma.$transaction(async (tx) => {
      // 3.1 检查撤销功能是否启用（在事务内检查，防止竞态条件）
      const config = await tx.systemConfig.findUnique({ where: { id: 1 } });
      if (!config?.enableTransactionVoid) {
        throw new Error('VOID_DISABLED');
      }

      // 检查功能是否已过期（10分钟）
      if (config.voidEnabledAt) {
        const enabledTime = new Date(config.voidEnabledAt).getTime();
        const tenMinutes = 10 * 60 * 1000;
        if (Date.now() - enabledTime > tenMinutes) {
          // 自动关闭过期的功能
          await tx.systemConfig.update({
            where: { id: 1 },
            data: { enableTransactionVoid: false, voidEnabledAt: null }
          });
          throw new Error('VOID_DISABLED');
        }
      }

      // 3.2 获取交易记录
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: {
          member: { select: { id: true, name: true } },
          cardUsed: {
            include: { cardType: true }
          },
          items: { include: { service: true } },
          cardLinks: true
        }
      });

      if (!transaction) {
        throw new Error('TX_NOT_FOUND');
      }

      // 3.3 检查是否在7天内
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (new Date(transaction.transactionTime) < sevenDaysAgo) {
        throw new Error('TX_TOO_OLD');
      }
      const balanceRestored = [];

      // 5.1 恢复会员卡余额
      if (transaction.paymentMethod === 'MEMBER_CARD') {
        // 检查是否为挂账交易（挂账不需要恢复余额）
        if (transaction.transactionType === 'PENDING' || transaction.isPending) {
          // 挂账交易不需要恢复余额
        } else if (transaction.cardId && transaction.cardUsed) {
          // 单卡支付：恢复余额
          const amountToRestore = new Decimal(transaction.actualPaidAmount);
          await tx.card.update({
            where: { id: transaction.cardId },
            data: { balance: { increment: amountToRestore.toNumber() } }
          });

          const cardName = transaction.cardUsed.isCustomCard
            ? `自定义面值卡(¥${new Decimal(transaction.cardUsed.customAmount).toFixed(2)})`
            : transaction.cardUsed.cardType.name;

          const updatedCard = await tx.card.findUnique({ where: { id: transaction.cardId } });
          balanceRestored.push({
            cardId: transaction.cardId,
            cardName: cardName,
            amountRestored: amountToRestore.toNumber(),
            newBalance: new Decimal(updatedCard.balance).toNumber()
          });
        } else if (transaction.cardLinks && transaction.cardLinks.length > 0) {
          // 多卡支付：从 link 表恢复余额（结构化关联，无 regex）
          for (const link of transaction.cardLinks) {
            const amount = new Decimal(link.amount).toNumber();
            await tx.card.update({
              where: { id: link.cardId },
              data: { balance: { increment: amount } },
            });
            const updatedCard = await tx.card.findUnique({ where: { id: link.cardId } });
            balanceRestored.push({
              cardId: link.cardId,
              cardName: link.cardName,
              amountRestored: amount,
              newBalance: new Decimal(updatedCard.balance).toNumber(),
            });
          }
        }
      }

      // 5.2 如果是清账交易，恢复原挂账记录状态
      if (transaction.transactionType === 'PENDING_CLEAR' && transaction.notes) {
        // 从notes中解析原挂账记录ID
        // 格式: "CLEAR_PENDING:pendingId" 或 "CARD_CLEAR_PENDING:pendingId|CARD:cardId"
        // 或批量: "CLEAR_ALL_PENDING:id1,id2,id3" 或 "CARD_CLEAR_ALL_PENDING:id1,id2,id3|CARD:cardId"
        let pendingIds = [];

        // 单笔清账
        const singleMatch = transaction.notes.match(/(?:CARD_)?CLEAR_PENDING:([a-zA-Z0-9]+)/);
        if (singleMatch) {
          pendingIds = [singleMatch[1]];
        }

        // 批量清账
        const batchMatch = transaction.notes.match(/(?:CARD_)?CLEAR_ALL_PENDING:([a-zA-Z0-9,]+)/);
        if (batchMatch) {
          pendingIds = batchMatch[1].split(',').filter(id => id.trim());
        }

        if (pendingIds.length > 0) {
          // 恢复挂账记录的 isPending 状态
          const updateResult = await tx.transaction.updateMany({
            where: {
              id: { in: pendingIds },
              transactionType: 'PENDING'
            },
            data: { isPending: true }
          });

          balanceRestored.push({
            action: 'PENDING_RESTORED',
            count: updateResult.count,
            message: `已恢复 ${updateResult.count} 条挂账记录`
          });
        } else {
          balanceRestored.push({
            warning: '未能从清账记录中解析出关联的挂账ID，请手动检查'
          });
        }
      }

      // 5.3 如果是办卡交易，删除对应的会员卡
      let deletedCard = null;
      if (transaction.transactionType === 'CARD_PURCHASE') {
        let targetCard = null;

        // 优先用办卡时写入的结构化标记 ISSUE_CARD:<cardId> 精确定位（新办卡交易）
        const issueMatch = transaction.notes && transaction.notes.match(/ISSUE_CARD:([a-zA-Z0-9_-]+)/);
        if (issueMatch && transaction.memberId) {
          targetCard = await tx.card.findFirst({
            where: { id: issueMatch[1], memberId: transaction.memberId },
            include: { cardType: true }
          });
        }

        // 回退：历史办卡交易无 ISSUE_CARD 标记，用卡名 + 时间窗匹配（仅兼容旧数据）
        const cardMatch = !targetCard && transaction.summary.match(/办理【(.+?)(?:\s+[\d.]+折)?】/);
        if (!targetCard && cardMatch && transaction.memberId) {
          const cardName = cardMatch[1].trim();

          // 查找该会员的匹配卡片（优先匹配发行时间接近的）
          const memberCards = await tx.card.findMany({
            where: {
              memberId: transaction.memberId,
              OR: [
                { cardType: { name: cardName } },
                { isCustomCard: true }
              ]
            },
            include: { cardType: true },
            orderBy: { issueDate: 'desc' }
          });

          // 找到与办卡交易时间最接近的卡片
          const txTime = new Date(transaction.transactionTime).getTime();
          let minTimeDiff = Infinity;

          for (const card of memberCards) {
            const cardTime = new Date(card.issueDate).getTime();
            const timeDiff = Math.abs(cardTime - txTime);
            // 只匹配5分钟内创建的卡片
            if (timeDiff < 5 * 60 * 1000 && timeDiff < minTimeDiff) {
              // 检查卡名是否匹配
              const cardDisplayName = card.isCustomCard
                ? `自定义面值卡(¥${new Decimal(card.customAmount).toFixed(2)})`
                : card.cardType.name;
              if (cardDisplayName.includes(cardName) || cardName.includes(card.cardType?.name || '')) {
                minTimeDiff = timeDiff;
                targetCard = card;
              }
            }
          }
        }

        if (transaction.memberId) {
          if (targetCard) {
            deletedCard = {
              cardId: targetCard.id,
              cardName: targetCard.isCustomCard
                ? `自定义面值卡(¥${new Decimal(targetCard.customAmount).toFixed(2)})`
                : targetCard.cardType.name,
              balance: new Decimal(targetCard.balance).toNumber()
            };

            // 删除该会员卡
            await tx.card.delete({
              where: { id: targetCard.id }
            });

            balanceRestored.push({
              action: 'CARD_DELETED',
              cardId: targetCard.id,
              cardName: deletedCard.cardName,
              message: `会员卡已删除`
            });
          } else {
            balanceRestored.push({
              warning: '未找到与此办卡交易关联的会员卡，请手动检查'
            });
          }
        }
      }

      // 5.4 生成卡片信息快照
      let cardInfo = null;
      if (transaction.cardUsed) {
        cardInfo = JSON.stringify({
          cardId: transaction.cardUsed.id,
          isCustomCard: transaction.cardUsed.isCustomCard,
          customAmount: transaction.cardUsed.customAmount,
          cardTypeName: transaction.cardUsed.cardType?.name
        });
      }

      // 5.5 创建撤销日志
      const voidLog = await tx.voidLog.create({
        data: {
          originalTxId: transaction.id,
          originalTxTime: transaction.transactionTime,
          memberId: transaction.memberId,
          memberName: transaction.member?.name,
          summary: transaction.summary || transaction.items.map(i => i.service.name).join('、'),
          totalAmount: transaction.totalAmount,
          actualPaidAmount: transaction.actualPaidAmount,
          paymentMethod: transaction.paymentMethod,
          cardInfo: cardInfo,
          balanceRestored: JSON.stringify(balanceRestored),
          balanceSnapshot: transaction.balanceSnapshot || null,
          voidedBy: userId,
          voidedByName: operatorName,
          reason: reason || null
        }
      });

      // 5.6 删除交易记录
      await tx.transaction.delete({
        where: { id: transactionId }
      });

      return { voidLog, balanceRestored };
    });

    return {
      success: true,
      message: '交易撤销成功',
      voidLog: result.voidLog,
      balanceRestored: result.balanceRestored
    };
  } catch (error) {
    // 处理事务内抛出的业务错误
    if (error.message === 'VOID_DISABLED') {
      return reply.code(403).send({ message: '交易撤销功能未启用或已过期' });
    }
    if (error.message === 'TX_NOT_FOUND') {
      return reply.code(404).send({ message: '交易记录不存在' });
    }
    if (error.message === 'TX_TOO_OLD') {
      return reply.code(400).send({ message: '超过7天的交易无法撤销' });
    }
    // 其他未知错误
    throw error;
  }
  });

}

