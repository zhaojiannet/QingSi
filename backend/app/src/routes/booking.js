// backend/app/src/routes/booking.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import { checkRateLimit, recordRequest } from '../utils/rateLimit.js';
import { sendNotification, formatAppointmentNotification } from '../utils/wxpush.js';

async function verifyBookingCode(code) {
  if (!code || code.length < 2) return false;

  const config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
    select: { bookingCode: true }
  });

  return config?.bookingCode === code;
}

export default async function (fastify, opts) {

  // 获取预约选项（服务、员工、可用时段）
  fastify.get('/options', async (request, reply) => {
    const { code } = request.query;

    if (!await verifyBookingCode(code)) {
      return reply.code(404).send({ error: '链接无效或已过期' });
    }

    const [services, staff] = await Promise.all([
      prisma.service.findMany({
        where: { status: 'AVAILABLE' },
        select: { id: true, name: true, standardPrice: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.staff.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' }
      })
    ]);

    return { services, staff };
  });

  // 创建预约
  fastify.post('/', async (request, reply) => {
    const { code } = request.query;

    if (!await verifyBookingCode(code)) {
      return reply.code(404).send({ error: '链接无效或已过期' });
    }

    const { customerName, customerPhone, appointmentTime, serviceIds, assignedStaffId, notes } = request.body;

    // 输入验证
    if (!customerPhone || !appointmentTime || !serviceIds?.length) {
      return reply.code(400).send({ error: '请填写完整信息' });
    }

    // 手机号格式验证
    if (!/^1[3-9]\d{9}$/.test(customerPhone)) {
      return reply.code(400).send({ error: '手机号格式不正确' });
    }

    // 频率限制检查 (IP + 手机号)
    const clientIp = request.ip || 'unknown';
    const rateLimitKey = `booking:${clientIp}:${customerPhone}`;
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return reply.code(429).send({
        error: `请稍后再试，${rateCheck.remainingSeconds}秒后可再次提交`
      });
    }

    // 预约时间验证
    const appointmentDate = new Date(appointmentTime);
    const now = new Date();
    if (appointmentDate <= now) {
      return reply.code(400).send({ error: '预约时间必须在当前时间之后' });
    }

    // 冲突检测: 同手机号+同时段(前后1小时内)
    const timeRangeStart = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
    const timeRangeEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000);

    const phoneConflict = await prisma.appointment.findFirst({
      where: {
        customerPhone,
        appointmentTime: { gte: timeRangeStart, lte: timeRangeEnd },
        status: { in: ['PENDING', 'CONFIRMED'] }
      }
    });

    if (phoneConflict) {
      return reply.code(409).send({ error: '您在该时段已有预约' });
    }

    // 冲突检测: 同员工+同时段
    if (assignedStaffId) {
      const staffConflict = await prisma.appointment.findFirst({
        where: {
          assignedStaffId,
          appointmentTime: { gte: timeRangeStart, lte: timeRangeEnd },
          status: { in: ['PENDING', 'CONFIRMED'] }
        }
      });

      if (staffConflict) {
        return reply.code(409).send({ error: '该员工在此时段已有预约' });
      }
    }

    // 验证服务ID有效性
    const validServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, status: 'AVAILABLE' },
      select: { id: true }
    });

    if (validServices.length !== serviceIds.length) {
      return reply.code(400).send({ error: '所选服务不存在或已下架' });
    }

    // 验证员工ID有效性
    if (assignedStaffId) {
      const validStaff = await prisma.staff.findUnique({
        where: { id: assignedStaffId, status: 'ACTIVE' }
      });
      if (!validStaff) {
        return reply.code(400).send({ error: '所选员工不存在或已离职' });
      }
    }

    // 记录请求（用于频率限制）
    recordRequest(rateLimitKey);

    // 创建预约
    const appointment = await prisma.appointment.create({
      data: {
        id: generateId(),
        customerName: customerName || '用户',
        customerPhone,
        appointmentTime: appointmentDate,
        notes,
        status: 'PENDING',
        services: { connect: serviceIds.map(id => ({ id })) },
        ...(assignedStaffId && { staff: { connect: { id: assignedStaffId } } }),
      },
      include: {
        services: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      }
    });

    // 异步发送微信通知
    const notificationData = formatAppointmentNotification(appointment);
    sendNotification(notificationData).catch(err => {
      console.error('[Booking] Notification failed:', err);
    });

    return {
      success: true,
      message: '预约成功，我们会尽快与您确认',
      appointmentId: appointment.id
    };
  });
}
