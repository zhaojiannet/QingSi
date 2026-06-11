// backend/app/src/routes/reports.js

import prisma from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.ts';
import Decimal from 'decimal.js';
import {
  businessReportSchema,
  paymentSummarySchema,
  cardSalesSummarySchema,
  serviceRankingSchema,
  memberRankingSchema,
  sleepingMembersSchema,
  pendingStatsSchema
} from '../schemas/reports.js';
import { applyAuth } from '../utils/applyAuth.js';
import { shopDayRange } from '../utils/shopTime.js';

export default async function (fastify, opts) {
  applyAuth(fastify, opts);
  // --- 营业报表 ---
  fastify.get('/business', { schema: businessReportSchema }, async (request, reply) => {
    const { startDate, endDate } = request.query;
    const { start, end } = shopDayRange(startDate, endDate);
    if (start > end) {
      return reply.code(400).send({ message: '开始日期不能晚于结束日期' });
    }

    // 查询窗口内全部交易；清账记录也要取（卡耗需要统计用卡清账的扣减）
    const transactions = await prisma.transaction.findMany({
      where: {
        transactionTime: { gte: start, lte: end }
      },
    });

    // 判断是否为办卡/充值记录（历史数据已由 migration 回填类型）
    const isCardPurchase = (t) => t.transactionType === 'CARD_PURCHASE';

    // 总消费按消费发生日统计：挂账当天计入（金额为负取绝对值），
    // 清账日不再计（排除 PENDING_CLEAR，否则一笔挂账计两次），排除办卡/充值
    const consumptionTransactions = transactions
      .filter(t => t.transactionType !== 'PENDING_CLEAR' && !isCardPurchase(t));
    const totalConsumption = consumptionTransactions
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount).abs()), new Decimal(0));

    // 会员卡消费（卡耗）= 卡余额真实扣减：正常卡消费 + 用卡清账（清账日卡才扣钱）
    const cardConsumption = transactions
      .filter(t => t.paymentMethod === 'MEMBER_CARD' && !isCardPurchase(t)
        && (t.transactionType === 'NORMAL' || t.transactionType === 'PENDING_CLEAR'))
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0));

    // 总客数：按消费发生日计，清账不算一次到店
    const totalCustomers = new Set(consumptionTransactions.map(t => t.memberId || t.id)).size;

    // 充值金额：统计办卡/充值记录
    const totalRecharge = transactions
      .filter(t => isCardPurchase(t))
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0));

    // 当期新增挂账（含其后已结清的）：总消费里属于"未收款生意"的部分，单独返回供前端标注
    const pendingAmount = transactions
      .filter(t => t.transactionType === 'PENDING')
      .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount).abs()), new Decimal(0));

    return {
      totalRevenue: totalConsumption.toFixed(2),  // 总消费（服务消费，按发生日，含挂账）
      pendingAmount: pendingAmount.toFixed(2),  // 当期新增挂账（未收款部分）
      cardConsumption: cardConsumption.toFixed(2),  // 会员卡消费（卡耗）
      totalRecharge: totalRecharge.toFixed(2),  // 充值金额
      totalCustomers,  // 总客数
      averageOrderValue: totalCustomers > 0 ? totalConsumption.div(totalCustomers).toFixed(2) : "0.00",  // 客单价
    };
  });

  // 项目销售排行榜
  fastify.get('/service-ranking', { schema: serviceRankingSchema }, async (request, reply) => {
    const { startDate, endDate } = request.query;

    // 验证和限制分页参数
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit) || 25));  // 最大100条
    const skip = (page - 1) * limit;

    // 构建时间筛选条件（SQL 片段，无日期时不过滤）
    let timeCond = Prisma.empty;
    if (startDate && endDate) {
      const { start, end } = shopDayRange(startDate, endDate);
      timeCond = Prisma.sql`WHERE t.transactionTime >= ${start} AND t.transactionTime <= ${end}`;
    }

    // 销售额必须按 单价 × 数量 计算，groupBy 的 _sum 无法表达 price*quantity，
    // 改在数据库层 SUM(price * quantity)（DECIMAL 精确运算），
    // 返回行数不超过服务数，不再把全量交易明细拉到应用层
    const grouped = await prisma.$queryRaw`
      SELECT ti.serviceId AS serviceId,
             SUM(ti.price * ti.quantity) AS totalSales,
             SUM(ti.quantity) AS totalCount
      FROM TransactionItem ti
      JOIN Transaction t ON t.id = ti.transactionId
      ${timeCond}
      GROUP BY ti.serviceId
      ORDER BY totalSales DESC, serviceId ASC
    `;

    const total = grouped.length;
    const pageEntries = grouped.slice(skip, skip + limit);

    const serviceIds = pageEntries.map(row => row.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true }
    });
    const serviceMap = new Map(services.map(s => [s.id, s.name]));

    const data = pageEntries.map(row => ({
      serviceId: row.serviceId,
      serviceName: serviceMap.get(row.serviceId) || '未知服务',
      totalSales: new Decimal(row.totalSales).toFixed(2),
      totalCount: Number(row.totalCount),
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
  fastify.get('/sleeping-members', { schema: sleepingMembersSchema }, async (request, reply) => {
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
  fastify.get('/member-ranking', { schema: memberRankingSchema }, async (request, reply) => {
    const { startDate, endDate } = request.query;

    // 验证和限制分页参数
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit) || 25));
    const skip = (page - 1) * limit;

    // 构建时间筛选条件
    let timeFilter = { memberId: { not: null } };
    if (startDate && endDate) {
      const { start, end } = shopDayRange(startDate, endDate);
      timeFilter = {
        ...timeFilter,
        transactionTime: { gte: start, lte: end }
      };
    }

    // 消费排行只统计真实消费：排除挂账（PENDING 负数）与办卡充值（CARD_PURCHASE），
    // 否则充值大户会被当成消费大户、欠账会员排名偏低。
    // 聚合下沉到数据库（每会员一行），不再全量拉交易明细
    const grouped = await prisma.transaction.groupBy({
      by: ['memberId'],
      where: {
        ...timeFilter,
        transactionType: { notIn: ['PENDING', 'CARD_PURCHASE'] },
      },
      _sum: { actualPaidAmount: true },
      orderBy: [{ _sum: { actualPaidAmount: 'desc' } }, { memberId: 'asc' }],
    });

    const total = grouped.length;
    const pageEntries = grouped.slice(skip, skip + limit);

    const memberIds = pageEntries.map(g => g.memberId);
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, phone: true }
    });
    const memberMap = new Map(members.map(m => [m.id, m]));

    const data = pageEntries.map(g => ({
      memberId: g.memberId,
      memberName: memberMap.get(g.memberId)?.name || '未知会员',
      memberPhone: memberMap.get(g.memberId)?.phone || '',
      totalConsumption: new Decimal(g._sum.actualPaidAmount).toFixed(2),
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
    // 与消费排行统计标准一致：排除挂账（PENDING）与办卡充值（CARD_PURCHASE），避免排名失真。
    // 聚合下沉到数据库（每会员一行），结果已按消费额降序，下标即排名
    const grouped = await prisma.transaction.groupBy({
      by: ['memberId'],
      where: {
        memberId: { not: null },
        transactionType: { notIn: ['PENDING', 'CARD_PURCHASE'] },
      },
      _sum: { actualPaidAmount: true },
      orderBy: [{ _sum: { actualPaidAmount: 'desc' } }, { memberId: 'asc' }],
    });

    const consumptionMap = new Map();
    grouped.forEach((g, index) => {
      consumptionMap.set(g.memberId, {
        totalConsumption: new Decimal(g._sum.actualPaidAmount).toFixed(2),
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
  fastify.get('/payment-summary', { schema: paymentSummarySchema }, async (request, reply) => {
    const { startDate, endDate } = request.query;
    const { start, end } = shopDayRange(startDate, endDate);
    if (start > end) {
      return reply.code(400).send({ message: '开始日期不能晚于结束日期' });
    }

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
  fastify.get('/card-sales-summary', { schema: cardSalesSummarySchema }, async (request, reply) => {
    const { startDate, endDate } = request.query;
    const { start, end } = shopDayRange(startDate, endDate);
    if (start > end) {
      return reply.code(400).send({ message: '开始日期不能晚于结束日期' });
    }

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
  fastify.get('/pending-stats', { schema: pendingStatsSchema }, async (request, reply) => {
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