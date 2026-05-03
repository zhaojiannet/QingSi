// backend/app/src/routes/voidLogs.js

import prisma from '../db/prisma.js';
import Decimal from 'decimal.js';
import { voidLogsQuerySchema } from '../schemas/voidLogs.js';

export default async function (fastify, opts) {
  // 获取撤销日志列表 - 需要 ADMIN 或 MANAGER 权限
  fastify.get('/', {
    onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])],
    schema: voidLogsQuerySchema
  }, async (request, reply) => {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate
    } = request.query;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // 日期范围过滤
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.voidedAt = { gte: start, lte: end };
    }

    const [voidLogs, total] = await Promise.all([
      prisma.voidLog.findMany({
        where,
        orderBy: { voidedAt: 'desc' },
        skip: offset,
        take: limitNum
      }),
      prisma.voidLog.count({ where })
    ]);

    // 格式化金额字段
    const formattedLogs = voidLogs.map(log => ({
      ...log,
      totalAmount: new Decimal(log.totalAmount).toFixed(2),
      actualPaidAmount: new Decimal(log.actualPaidAmount).toFixed(2),
      balanceRestored: log.balanceRestored ? JSON.parse(log.balanceRestored) : [],
      cardInfo: log.cardInfo ? JSON.parse(log.cardInfo) : null
    }));

    return {
      data: formattedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: offset + formattedLogs.length < total
      }
    };
  });

  // 获取单条撤销日志详情
  fastify.get('/:id', {
    onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const { id } = request.params;

    const voidLog = await prisma.voidLog.findUnique({
      where: { id }
    });

    if (!voidLog) {
      return reply.code(404).send({ message: '撤销记录不存在' });
    }

    return {
      ...voidLog,
      totalAmount: new Decimal(voidLog.totalAmount).toFixed(2),
      actualPaidAmount: new Decimal(voidLog.actualPaidAmount).toFixed(2),
      balanceRestored: voidLog.balanceRestored ? JSON.parse(voidLog.balanceRestored) : [],
      cardInfo: voidLog.cardInfo ? JSON.parse(voidLog.cardInfo) : null
    };
  });
}
