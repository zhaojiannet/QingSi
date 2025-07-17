// backend/app/src/routes/staff.js


import prisma from '../db/prisma.js';
import { generateId } from '../utils/id.js';

export default async function (fastify, opts) {
  // 创建新员工
  fastify.post('/', async (request, reply) => {

      const { name, position, phone, status } = request.body;
      if (!name || !position) {
        return reply.code(400).send({ message: '缺少必要参数：姓名、职位' });
      }

      const newStaff = await prisma.staff.create({
        data: {
          id: generateId(),
          name,
          position,
          phone,
          status: status || 'ACTIVE', // 默认为在职
        },
      });
      return newStaff;

  });

  // 获取所有员工列表
  fastify.get('/', async (request, reply) => {
    const { status } = request.query; // 获取查询参数 status

    const where = {};
    if (status) {
      where.status = status;
    }


      const staffList = await prisma.staff.findMany({
        where, // 应用过滤条件
        orderBy: { hireDate: 'desc' },
      });
      return staffList;

  });

  // --- 核心修改：修复 PUT 接口对布尔值的处理 ---
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, position, phone, countsCommission, status } = request.body;

    // 创建一个 dataToUpdate 对象，只包含明确传递过来的值
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (position !== undefined) dataToUpdate.position = position;
    if (phone !== undefined) dataToUpdate.phone = phone;
    // 关键：明确检查 countsCommission 是否被定义，这样 false 值也能被正确处理
    if (countsCommission !== undefined) dataToUpdate.countsCommission = countsCommission;
    if (status !== undefined) dataToUpdate.status = status;


      const updatedStaff = await prisma.staff.update({
        where: { id },
        data: dataToUpdate,
      });
      return updatedStaff;

  });
}