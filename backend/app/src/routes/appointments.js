// backend/app/src/routes/appointments.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';
import {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
  appointmentsQuerySchema
} from '../schemas/appointments.js';

export default async function (fastify, opts) {
  
  fastify.get('/count/today', async (request, reply) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const count = await prisma.appointment.count({
      where: {
        appointmentTime: {
          gte: startOfToday,
          lt: endOfToday,
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
          id: generateId(),
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
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
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