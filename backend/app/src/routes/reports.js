// src/routes/reports.js
import prisma from '../db/prisma.js';
import Decimal from 'decimal.js';

export default async function (fastify, opts) {
  // 核心营业报表
  fastify.get('/business', async (request, reply) => {
    const { startDate, endDate } = request.query;
    if (!startDate || !endDate) {
      return reply.code(400).send({ message: '必须提供 startDate 和 endDate' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // 包含当天

    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          transactionTime: { gte: start, lte: end },
        },
      });

      const totalRevenue = transactions.reduce(
        (sum, t) => sum.plus(new Decimal(t.actualPaidAmount)),
        new Decimal(0)
      );
      
      const cardConsumption = transactions
        .filter(t => t.paymentMethod === 'MEMBER_CARD')
        .reduce((sum, t) => sum.plus(new Decimal(t.actualPaidAmount)), new Decimal(0));

      const totalCustomers = new Set(transactions.map(t => t.memberId || t.id)).size;

      const report = {
        totalRevenue: totalRevenue.toFixed(2), // 总收入
        cardConsumption: cardConsumption.toFixed(2), // 卡耗
        cashAndOnline: totalRevenue.minus(cardConsumption).toFixed(2), // 现金及线上支付
        totalTransactions: transactions.length, // 总单数
        totalCustomers, // 总客数
        averageOrderValue: totalCustomers > 0 ? totalRevenue.div(totalCustomers).toFixed(2) : "0.00", // 客单价
      };

      return report;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ message: '获取营业报表失败' });
    }
  });

  // 项目销售排行榜
  fastify.get('/service-ranking', async (request, reply) => {
      try {
          const result = await prisma.transactionItem.groupBy({
              by: ['serviceId'],
              _sum: {
                  price: true,
              },
              _count: {
                  _all: true,
              },
              orderBy: {
                  _sum: {
                      price: 'desc',
                  },
              },
          });

          // 补充服务详情
          const serviceIds = result.map(item => item.serviceId);
          const services = await prisma.service.findMany({
              where: { id: { in: serviceIds } },
              select: { id: true, name: true }
          });
          const serviceMap = new Map(services.map(s => [s.id, s.name]));

          const report = result.map(item => ({
              serviceId: item.serviceId,
              serviceName: serviceMap.get(item.serviceId) || '未知服务',
              totalSales: new Decimal(item._sum.price).toFixed(2),
              totalCount: item._count._all,
          }));

          return report;
      } catch (error) {
          fastify.log.error(error);
          reply.code(500).send({ message: '获取项目销售排行失败' });
      }
  });

  // 沉睡会员报表 (超过90天未消费)
  fastify.get('/sleeping-members', async (request, reply) => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const sleepingMembers = await prisma.member.findMany({
        where: {
          OR: [
            { lastVisitDate: null },
            { lastVisitDate: { lt: ninetyDaysAgo } }
          ],
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          phone: true,
          lastVisitDate: true,
          registrationDate: true,
        },
        orderBy: {
          lastVisitDate: 'asc'
        }
      });
      return sleepingMembers;
    } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ message: '获取沉睡会员报表失败' });
    }
  });
}