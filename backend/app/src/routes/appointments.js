// backend/app/src/routes/appointments.js

import prisma from '../db/prisma.js';
import { generateUniqueId } from '../utils/id.js';
import {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
  appointmentsQuerySchema
} from '../schemas/appointments.js';
import { applyAuth } from '../utils/applyAuth.js';
import { shopDayRange, shopTodayRange } from '../utils/shopTime.js';

export default async function (fastify, opts) {
  applyAuth(fastify, opts);

  fastify.get('/count/today', async (request, reply) => {
    const { start: startOfToday, end: endOfToday } = shopTodayRange();

    const count = await prisma.appointment.count({
      where: {
        appointmentTime: {
          gte: startOfToday,
          lte: endOfToday,
        },
        // --- 核心修改：只统计“待确认”和“已确认”的预约 ---
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      }
    });

    return { count };
  });

  fastify.post('/', { schema: createAppointmentSchema }, async (request, reply) => {

    const {
        memberId,
        customerName,
        customerPhone,
        appointmentTime,
        assignedStaffId,
        serviceIds,
        notes,
      } = request.body;

      const newAppointment = await prisma.appointment.create({
        data: {
          id: await generateUniqueId(prisma.appointment),
          customerName: customerName || '非会员用户',
          customerPhone,
          appointmentTime: new Date(appointmentTime),
          notes,
          status: 'PENDING',
          services: { connect: serviceIds.map(id => ({ id })) },
          ...(memberId && { member: { connect: { id: memberId } } }),
          ...(assignedStaffId && { staff: { connect: { id: assignedStaffId } } }),
        },
        include: {
          member: true,
          staff: true,
          services: true,
        },
      });
      return newAppointment;

  });

  fastify.get('/', { schema: appointmentsQuerySchema }, async (request, reply) => {
    const { startDate, endDate, staffId, status } = request.query;
    const where = {};

    if (startDate && endDate) {
        const { start, end } = shopDayRange(startDate, endDate);
        where.appointmentTime = { gte: start, lte: end };
    }
    if (staffId) {
        where.assignedStaffId = staffId;
    }
    if (status) {
        where.status = status;
    }

      const appointments = await prisma.appointment.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, phone: true } },
          staff: { select: { id: true, name: true } },
          services: { select: { id: true, name: true } },
        },
        orderBy: { appointmentTime: 'asc' },
      });
      return appointments;

  });

  fastify.patch('/:id/status', { schema: updateAppointmentStatusSchema }, async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

          const updatedAppointment = await prisma.appointment.update({
              where: { id },
              data: { status },
          });
          return updatedAppointment;

  });
}