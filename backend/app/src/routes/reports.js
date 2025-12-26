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

    // 验证日期格式
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.code(400).send({ message: '日期格式无效' });
    }
    if (start > end) {
      return reply.code(400).send({ message: '开始日期不能晚于结束日期' });
    }
    end.setHours(23, 59, 59, 999);

    // 查询所有交易记录，排除挂账清账记录
    const transactions = await prisma.transaction.findMany({
      where: {
        transactionTime: { gte: start, lte: end },
        transactionType: { not: 'PENDING_CLEAR' }  // 排除挂账清账记录
      },
    });

    // 判断是否为办卡/充值记录
    const isCardPurchase = (t) => t.summary && t.summary.startsWith('办理【');

    // 总消费：统计实际服务消费，排除办卡/充值记录（避免重复计算）
    // 挂账的 actualPaidAmount 是负数，需要取绝对值才是真实消费金额
    const totalConsumption = transactions
      .filter(t => !isCardPurchase(t))
      .reduce((sum, t) => sum.plus(new Decimal(Math.abs(t.actualPaidAmount))), new Decimal(0));

    // 会员卡消费：只统计会员卡支付的实际消费（排除办卡记录）
    const cardConsumption = transactions
      .filter(t => t.paymentMethod === 'MEMBER_CARD' && t.transactionType === 'NORMAL' && !isCardPurchase(t))
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0));

    // 总客数：排除办卡记录
    const consumptionTransactions = transactions.filter(t => !isCardPurchase(t));
    const totalCustomers = new Set(consumptionTransactions.map(t => t.memberId || t.id)).size;

    // 充值金额：统计办卡/充值记录
    const totalRecharge = transactions
      .filter(t => isCardPurchase(t))
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0));

    return {
      totalRevenue: totalConsumption.toFixed(2),  // 总消费（服务消费）
      cardConsumption: cardConsumption.toFixed(2),  // 会员卡消费（卡耗）
      totalRecharge: totalRecharge.toFixed(2),  // 充值金额
      totalCustomers,  // 总客数
      averageOrderValue: totalCustomers > 0 ? totalConsumption.div(totalCustomers).toFixed(2) : "0.00",  // 客单价
    };
  });

  // 项目销售排行榜
  fastify.get('/service-ranking', async (request, reply) => {
    const { startDate, endDate } = request.query;

    // 验证和限制分页参数
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit) || 25));  // 最大100条
    const skip = (page - 1) * limit;

    // 构建时间筛选条件
    let timeFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      timeFilter = {
        transaction: {
          transactionTime: { gte: start, lte: end }
        }
      };
    }

    const result = await prisma.transactionItem.groupBy({
      by: ['serviceId'],
      _sum: { price: true },
      _count: { _all: true },
      where: timeFilter,
      orderBy: { _sum: { price: 'desc' } },
      skip,
      take: limit,
    });

    // 获取总数
    const totalResult = await prisma.transactionItem.groupBy({
      by: ['serviceId'],
      where: timeFilter,
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
    // 验证和限制分页参数
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit) || 25));
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
    const { startDate, endDate } = request.query;

    // 验证和限制分页参数
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit) || 25));
    const skip = (page - 1) * limit;

    // 构建时间筛选条件
    let timeFilter = { memberId: { not: null } };
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      timeFilter = {
        ...timeFilter,
        transactionTime: { gte: start, lte: end }
      };
    }

    const memberConsumptions = await prisma.transaction.groupBy({
      by: ['memberId'],
      _sum: { actualPaidAmount: true },
      where: timeFilter,
      orderBy: { _sum: { actualPaidAmount: 'desc' } },
      skip,
      take: limit,
    });

    // 获取总数
    const totalResult = await prisma.transaction.groupBy({
      by: ['memberId'],
      where: timeFilter,
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

    // 验证日期格式
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.code(400).send({ message: '日期格式无效' });
    }
    if (start > end) {
      return reply.code(400).send({ message: '开始日期不能晚于结束日期' });
    }
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
        transactionType: { 
          notIn: ['PENDING']  // 排除挂账记录
        }
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

    // 验证日期格式
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.code(400).send({ message: '日期格式无效' });
    }
    if (start > end) {
      return reply.code(400).send({ message: '开始日期不能晚于结束日期' });
    }
    end.setHours(23, 59, 59, 999);

    // 改用Card表的issueDate统计办卡情况
    const cards = await prisma.card.findMany({
      where: {
        issueDate: { gte: start, lte: end }
      },
      include: {
        cardType: true
      }
    });

    // 按卡片类型分组统计
    const summaryMap = new Map();
    for (const card of cards) {
      let cardName;
      let amount;
      
      // 处理自定义面值卡
      if (card.isCustomCard) {
        cardName = '自定义面值卡';
        amount = new Decimal(card.customAmount);
      } else {
        cardName = card.cardType.name;
        amount = new Decimal(card.cardType.initialPrice);
      }
      
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
    // 验证和限制分页参数
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit) || 25));
    const skip = (page - 1) * limit;

    try {
      // 获取挂账统计数据和汇总信息
      const [pendingStats, totalStats] = await prisma.$transaction([
        // 获取有挂账的会员详细信息
        prisma.member.findMany({
          where: {
            transactions: {
              some: {
                transactionType: 'PENDING',
                isPending: true
              }
            }
          },
          skip,
          take: limit,
          include: {
            transactions: {
              where: {
                transactionType: 'PENDING',
                isPending: true
              },
              orderBy: {
                transactionTime: 'desc'
              }
            }
          },
          orderBy: [
            {
              transactions: {
                _count: 'desc'
              }
            },
            {
              name: 'asc'
            }
          ]
        }),
        // 获取总体统计信息
        prisma.transaction.aggregate({
          where: {
            transactionType: 'PENDING',
            isPending: true
          },
          _sum: {
            totalAmount: true
          },
          _count: {
            id: true
          }
        })
      ]);

      // 处理数据，计算每个会员的挂账信息
      const processedData = pendingStats.map(member => {
        const totalPending = member.transactions.reduce(
          (sum, tx) => sum.plus(new Decimal(Math.abs(tx.totalAmount))),
          new Decimal(0)
        );
        
        const recordCount = member.transactions.length;
        const earliestDate = member.transactions[recordCount - 1]?.transactionTime;
        const latestDate = member.transactions[0]?.transactionTime;

        // 转换格式以兼容前端
        const payments = member.transactions.map(tx => ({
          id: tx.id,
          amount: Math.abs(tx.totalAmount),
          description: tx.summary?.replace('挂账：', '') || null,
          createdAt: tx.transactionTime
        }));

        return {
          id: member.id,
          name: member.name,
          phone: member.phone,
          totalPending: totalPending.toNumber(),
          recordCount,
          earliestDate,
          latestDate,
          payments: payments
        };
      });

      // 获取总会员数（有挂账的）
      const memberCount = await prisma.member.count({
        where: {
          transactions: {
            some: {
              transactionType: 'PENDING',
              isPending: true
            }
          }
        }
      });

      // 计算汇总信息（注意totalAmount是负数，需要取绝对值）
      const summary = {
        totalAmount: totalStats._sum.totalAmount ? Math.abs(new Decimal(totalStats._sum.totalAmount).toNumber()) : 0,
        recordCount: totalStats._count.id || 0,
        memberCount: memberCount,
        averageAmount: memberCount > 0 
          ? Math.abs(new Decimal(totalStats._sum.totalAmount || 0).div(memberCount).toNumber())
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