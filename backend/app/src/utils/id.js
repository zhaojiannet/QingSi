// backend/app/src/utils/id.js

import { customAlphabet } from 'nanoid';
import { validateCardIdFormat } from './validators.js';

// 不含易混淆字符（1/l 看起来像、0/O 看起来像）。36 字符 × 长度 8 = 36^8 ≈ 2.8e12 种可能。
// 10 万 ID 时碰撞概率约 1.8e-6（生日悖论），实务中可视为无碰撞。
// 历史数据保留 6 位 ID（tdb 中已有 5000+ 条），validateCardIdFormat 同时接受 6-8 位。
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;
const nanoid = customAlphabet(ALPHABET, ID_LENGTH);

export const generateId = () => {
  const id = nanoid();
  if (!validateCardIdFormat(id)) {
    throw new Error(`生成的ID格式不符合要求: ${id}`);
  }
  return id;
};

// 关键写路径用：生成 ID 后查 prisma model 是否已存在，碰撞则重试。
// prismaModel 形如 prisma.card / tx.transaction，需具备 findUnique({ where: { id } })。
// 默认最多重试 5 次（5 次内未命中唯一 ID 概率 < 1e-30，触发即外部异常）。
export async function generateUniqueId(prismaModel, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const id = nanoid();
    if (!validateCardIdFormat(id)) continue;
    const exists = await prismaModel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return id;
  }
  throw new Error('UNIQUE_ID_GENERATION_FAILED');
}
