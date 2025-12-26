// backend/app/src/routes/staff.js

import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  const managerAndAdminAccess = { onRequest: [fastify.authenticate, fastify.hasRole(['ADMIN', 'MANAGER'])] };

  // 创建新员工
  fastify.post('/', managerAndAdminAccess, async (request, reply) => {
    let { name, position, phone, status, countsCommission, sortOrder } = request.body;
    if (!name || !position) {
      return reply.code(400).send({ message: '缺少必要参数：姓名、职位' });
    }

    // --- 核心修复：将空字符串转换为 null ---
    if (phone === '') {
      phone = null;
    }

    const newStaff = await prisma.staff.create({
      data: {
        id: generateId(), 
        name, 
        position, 
        phone, // 使用预处理后的 phone 值
        status: status || 'ACTIVE',
        countsCommission: countsCommission !== undefined ? countsCommission : true,
        sortOrder: sortOrder || 99,
      },
    });
    return newStaff;
  });

  // 获取所有员工列表
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.query;
    const where = {};
    if (status) {
      where.status = status;
    }
    const staffList = await prisma.staff.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { hireDate: 'desc' }
      ],
    });
    return staffList;
  });

  // 更新员工信息
  fastify.put('/:id', managerAndAdminAccess, async (request, reply) => {
    const { id } = request.params;
    let { name, position, phone, countsCommission, status, sortOrder } = request.body;
    const dataToUpdate = {};

    if (name !== undefined) dataToUpdate.name = name;
    if (position !== undefined) dataToUpdate.position = position;
    if (phone !== undefined) {
      // --- 核心修复：将空字符串转换为 null ---
      dataToUpdate.phone = phone === '' ? null : phone;
    }
    if (countsCommission !== undefined) dataToUpdate.countsCommission = countsCommission;
    if (status !== undefined) dataToUpdate.status = status;
    if (sortOrder !== undefined) dataToUpdate.sortOrder = sortOrder;
    
    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: dataToUpdate,
    });
    return updatedStaff;
  });

  // 删除员工 (保持不变)
  fastify.delete('/:id', managerAndAdminAccess, async (request, reply) => {
    const { id } = request.params;
    
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) {
      return reply.code(404).send({ message: '员工不存在' });
    }
    if (staff.status !== 'INACTIVE') {
      return reply.code(400).send({ message: '删除失败：必须先将员工状态设为离职。' });
    }

    await prisma.$transaction(async (tx) => {
        await tx.transaction.updateMany({ where: { staffId: id }, data: { staffId: null } });
        await tx.appointment.updateMany({ where: { assignedStaffId: id }, data: { assignedStaffId: null } });
        await tx.staff.delete({ where: { id } });
    });

    return { message: '员工已删除' };
  });
}