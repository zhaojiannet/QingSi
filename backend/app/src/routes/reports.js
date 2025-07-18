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
    const result = await prisma.transactionItem.groupBy({
      by: ['serviceId'],
      _sum: { price: true },
      _count: { _all: true },
      orderBy: { _sum: { price: 'desc' } },
    });
    const serviceIds = result.map(item => item.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true }
    });
    const serviceMap = new Map(services.map(s => [s.id, s.name]));
    return result.map(item => ({
      serviceId: item.serviceId,
      serviceName: serviceMap.get(item.serviceId) || '未知服务',
      totalSales: new Decimal(item._sum.price).toFixed(2),
      totalCount: item._count._all,
    }));
  });

  // 沉睡会员报表
  fastify.get('/sleeping-members', async (request, reply) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return await prisma.member.findMany({
      where: {
        OR: [{ lastVisitDate: null }, { lastVisitDate: { lt: ninetyDaysAgo } }],
        status: 'ACTIVE',
      },
      select: { id: true, name: true, phone: true, lastVisitDate: true, registrationDate: true },
      orderBy: { lastVisitDate: 'asc' }
    });
  });

  // 会员消费排行榜
  fastify.get('/member-ranking', async (request, reply) => {
    const memberConsumptions = await prisma.transaction.groupBy({
      by: ['memberId'],
      _sum: { actualPaidAmount: true },
      where: { memberId: { not: null } },
      orderBy: { _sum: { actualPaidAmount: 'desc' } },
      take: 100, // 100名成员
    });
    const memberIds = memberConsumptions.map(m => m.memberId);
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, phone: true }
    });
    const memberMap = new Map(members.map(m => [m.id, m]));
    return memberConsumptions.map(item => ({
      memberId: item.memberId,
      memberName: memberMap.get(item.memberId)?.name || '未知会员',
      memberPhone: memberMap.get(item.memberId)?.phone || '',
      totalConsumption: new Decimal(item._sum.actualPaidAmount).toFixed(2),
    }));
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
      WECHAT_PAY: '微信支付',
      ALIPAY: '支付宝',
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


}