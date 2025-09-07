// backend/app/src/routes/reports.js

import prisma from '../db/prisma.js';
import Decimal from 'decimal.js';

export default async function (fastify, opts) {
  // --- 营业报表 ---
  fastify.get('/business', async (request, reply) => {
    const { startDate, endDate } = request.query;
    if (!startDate || !endDate) {
      return reply.code(400).send({ message: '必须提供 startDate 和 endDate' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const transactions = await prisma.transaction.findMany({
      where: { transactionTime: { gte: start, lte: end } },
    });
    const totalRevenue = transactions.reduce(
      (sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0)
    );
    const cardConsumption = transactions
      .filter(t => t.paymentMethod === 'MEMBER_CARD')
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0));
    const totalCustomers = new Set(transactions.map(t => t.memberId || t.id)).size;
    return {
      totalRevenue: totalRevenue.toFixed(2),
      cardConsumption: cardConsumption.toFixed(2),
      cashAndOnline: totalRevenue.minus(cardConsumption).toFixed(2),
      totalTransactions: transactions.length,
      totalCustomers,
      averageOrderValue: totalCustomers > 0 ? totalRevenue.div(totalCustomers).toFixed(2) : "0.00",
    };
  });

  // 项目销售排行榜
  fastify.get('/service-ranking', async (request, reply) => {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 25;
    const skip = (page - 1) * limit;

    const result = await prisma.transactionItem.groupBy({
      by: ['serviceId'],
      _sum: { price: true },
      _count: { _all: true },
      orderBy: { _sum: { price: 'desc' } },
      skip,
      take: limit,
    });

    // 获取总数
    const totalResult = await prisma.transactionItem.groupBy({
      by: ['serviceId'],
      _count: { _all: true },
    });
    const total = totalResult.length;

    const serviceIds = result.map(item => item.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true }
    });
    const serviceMap = new Map(services.map(s => [s.id, s.name]));
    
    const data = result.map(item => ({
      serviceId: item.serviceId,
      serviceName: serviceMap.get(item.serviceId) || '未知服务',
      totalSales: new Decimal(item._sum.price).toFixed(2),
      totalCount: item._count._all,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  });

  // 沉睡会员报表 - 基于Transaction表动态计算，避免lastVisitDate不同步问题
  fastify.get('/sleeping-members', async (request, reply) => {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 25;
    const skip = (page - 1) * limit;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // 使用原生SQL查询获取真正的沉睡会员
    const sleepingMembers = await prisma.$queryRaw`
      SELECT 
        m.id,
        m.name,
        m.phone,
        m.registrationDate,
        COALESCE(latest_transaction.lastVisitDate, NULL) as lastVisitDate
      FROM Member m
      LEFT JOIN (
        SELECT 
          memberId,
          MAX(transactionTime) as lastVisitDate
        FROM Transaction 
        WHERE memberId IS NOT NULL
        GROUP BY memberId
      ) latest_transaction ON m.id = latest_transaction.memberId
      WHERE 
        m.status = 'ACTIVE' AND
        (
          latest_transaction.lastVisitDate IS NULL OR 
          latest_transaction.lastVisitDate < ${ninetyDaysAgo}
        )
      ORDER BY COALESCE(latest_transaction.lastVisitDate, m.registrationDate) ASC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 获取总数
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM Member m
      LEFT JOIN (
        SELECT 
          memberId,
          MAX(transactionTime) as lastVisitDate
        FROM Transaction 
        WHERE memberId IS NOT NULL
        GROUP BY memberId
      ) latest_transaction ON m.id = latest_transaction.memberId
      WHERE 
        m.status = 'ACTIVE' AND
        (
          latest_transaction.lastVisitDate IS NULL OR 
          latest_transaction.lastVisitDate < ${ninetyDaysAgo}
        )
    `;
    
    const total = Number(totalResult[0].count);

    return {
      data: sleepingMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  });

  // 会员消费排行榜
  fastify.get('/member-ranking', async (request, reply) => {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 25;
    const skip = (page - 1) * limit;

    const memberConsumptions = await prisma.transaction.groupBy({
      by: ['memberId'],
      _sum: { actualPaidAmount: true },
      where: { memberId: { not: null } },
      orderBy: { _sum: { actualPaidAmount: 'desc' } },
      skip,
      take: limit,
    });

    // 获取总数
    const totalResult = await prisma.transaction.groupBy({
      by: ['memberId'],
      where: { memberId: { not: null } },
      _count: { _all: true },
    });
    const total = totalResult.length;

    const memberIds = memberConsumptions.map(m => m.memberId);
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, phone: true }
    });
    const memberMap = new Map(members.map(m => [m.id, m]));
    
    const data = memberConsumptions.map(item => ({
      memberId: item.memberId,
      memberName: memberMap.get(item.memberId)?.name || '未知会员',
      memberPhone: memberMap.get(item.memberId)?.phone || '',
      totalConsumption: new Decimal(item._sum.actualPaidAmount).toFixed(2),
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  });

  // --- 核心修改：生日提醒接口，增加消费排名 ---
  fastify.get('/birthday-reminders', async (request, reply) => {
    // --- 第一步：获取所有会员的消费排名 ---
    const memberConsumptions = await prisma.transaction.groupBy({
      by: ['memberId'],
      _sum: { actualPaidAmount: true },
      where: { memberId: { not: null } },
      orderBy: { _sum: { actualPaidAmount: 'desc' } },
    });
    
    // 创建一个 Map 用于快速查找消费数据和排名
    const consumptionMap = new Map();
    memberConsumptions.forEach((item, index) => {
      consumptionMap.set(item.memberId, {
        totalConsumption: new Decimal(item._sum.actualPaidAmount).toFixed(2),
        rank: index + 1, // 排名从1开始
      });
    });

    // --- 第二步：获取未来15天内过生日的会员 ---
    const today = new Date();
    const fifteenDaysLater = new Date();
    fifteenDaysLater.setDate(today.getDate() + 15);

    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const fifteenDaysLaterMonth = fifteenDaysLater.getMonth() + 1;
    const fifteenDaysLaterDay = fifteenDaysLater.getDate();

    const upcomingBirthdayMembers = await prisma.$queryRaw`
      SELECT id, name, phone, birthday, status
      FROM Member
      WHERE 
        status = 'ACTIVE' AND
        birthday IS NOT NULL AND
        (
          (MONTH(birthday) = ${todayMonth} AND DAY(birthday) >= ${todayDay}) OR
          (MONTH(birthday) = ${fifteenDaysLaterMonth} AND DAY(birthday) <= ${fifteenDaysLaterDay}) OR
          (
            ${fifteenDaysLaterMonth} < ${todayMonth} AND 
            (MONTH(birthday) > ${todayMonth} OR MONTH(birthday) < ${fifteenDaysLaterMonth})
          )
        )
      ORDER BY MONTH(birthday), DAY(birthday) ASC
    `;
    
    // --- 第三步：合并数据 ---
    const report = upcomingBirthdayMembers.map(member => {
      const consumptionData = consumptionMap.get(member.id);
      return {
        ...member,
        totalConsumption: consumptionData?.totalConsumption || '0.00',
        rank: consumptionData?.rank || '无消费', // 如果没有消费记录，则显示'无'
      };
    });
    
    return report;
  });

  // --- 新增1：支付方式构成分析 ---
  fastify.get('/payment-summary', async (request, reply) => {
    const { startDate, endDate } = request.query;
    if (!startDate || !endDate) {
      return reply.code(400).send({ message: '必须提供 startDate 和 endDate' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const result = await prisma.transaction.groupBy({
      by: ['paymentMethod'],
      _sum: {
        actualPaidAmount: true,
      },
      _count: {
        _all: true,
      },
      where: {
        transactionTime: { gte: start, lte: end },
      },
    });
    
    // 映射为更友好的名称
    const paymentMethodMap = {
      CASH: '现金',
      WECHAT_PAY: '微信',
      ALIPAY: '支付宝',
      DOUYIN: '抖音',
      MEITUAN: '美团',
      MEMBER_CARD: '会员卡',
      CARD_SWIPE: '刷卡',
      OTHER: '其他',
    };

    const summary = result.map(item => ({
      name: paymentMethodMap[item.paymentMethod] || item.paymentMethod,
      value: new Decimal(item._sum.actualPaidAmount).toFixed(2),
      count: item._count._all,
    }));

    return summary;
  });

  // --- 新增2：会员卡销售分析 ---
  fastify.get('/card-sales-summary', async (request, reply) => {
    const { startDate, endDate } = request.query;
    if (!startDate || !endDate) {
      return reply.code(400).send({ message: '必须提供 startDate 和 endDate' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 查找所有“办卡”类型的交易
    const cardSaleTransactions = await prisma.transaction.findMany({
      where: {
        transactionTime: { gte: start, lte: end },
        summary: {
          startsWith: '办理【',
        },
      },
    });

    // 在内存中进行分组统计
    const summaryMap = new Map();
    for (const tx of cardSaleTransactions) {
      const cardName = tx.summary.replace('办理【', '').replace('】', '');
      const amount = new Decimal(tx.actualPaidAmount);
      
      if (summaryMap.has(cardName)) {
        const current = summaryMap.get(cardName);
        summaryMap.set(cardName, {
          value: current.value.plus(amount),
          count: current.count + 1,
        });
      } else {
        summaryMap.set(cardName, {
          value: amount,
          count: 1,
        });
      }
    }

    const summary = Array.from(summaryMap.entries()).map(([name, data]) => ({
      name: name,
      value: data.value.toFixed(2),
      count: data.count,
    }));
    
    return summary.sort((a, b) => b.value - a.value);
  });

  // --- 挂账统计报表 ---
  fastify.get('/pending-stats', async (request, reply) => {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 25;
    const skip = (page - 1) * limit;

    try {
      // 获取挂账统计数据和汇总信息
      const [pendingStats, totalStats] = await prisma.$transaction([
        // 获取有挂账的会员详细信息
        prisma.member.findMany({
          where: {
            pendingPayments: {
              some: {}
            }
          },
          skip,
          take: limit,
          include: {
            pendingPayments: {
              orderBy: {
                createdAt: 'desc'
              }
            }
          },
          orderBy: [
            {
              pendingPayments: {
                _count: 'desc'
              }
            },
            {
              name: 'asc'
            }
          ]
        }),
        // 获取总体统计信息
        prisma.pendingPayment.aggregate({
          _sum: {
            amount: true
          },
          _count: {
            id: true
          }
        })
      ]);

      // 处理数据，计算每个会员的挂账信息
      const processedData = pendingStats.map(member => {
        const totalPending = member.pendingPayments.reduce(
          (sum, payment) => sum.plus(new Decimal(payment.amount)),
          new Decimal(0)
        );
        
        const recordCount = member.pendingPayments.length;
        const earliestDate = member.pendingPayments[recordCount - 1]?.createdAt;
        const latestDate = member.pendingPayments[0]?.createdAt;

        return {
          id: member.id,
          name: member.name,
          phone: member.phone,
          totalPending: totalPending.toNumber(),
          recordCount,
          earliestDate,
          latestDate,
          payments: member.pendingPayments
        };
      });

      // 获取总会员数（有挂账的）
      const memberCount = await prisma.member.count({
        where: {
          pendingPayments: {
            some: {}
          }
        }
      });

      // 计算汇总信息
      const summary = {
        totalAmount: totalStats._sum.amount ? new Decimal(totalStats._sum.amount).toNumber() : 0,
        recordCount: totalStats._count.id || 0,
        memberCount: memberCount,
        averageAmount: memberCount > 0 
          ? new Decimal(totalStats._sum.amount || 0).div(memberCount).toNumber() 
          : 0
      };

      return {
        data: processedData,
        total: memberCount,
        page,
        limit,
        hasMore: (page * limit) < memberCount,
        summary
      };
    } catch (error) {
      fastify.log.error('获取挂账统计失败:', error);
      return reply.code(500).send({ message: '获取挂账统计失败' });
    }
  });


}