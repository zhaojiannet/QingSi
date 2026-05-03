/**
 * 数据验证工具函数
 */

/**
 * 验证业务 ID 格式：6-8 位小写字母或数字。
 * 6 位为历史数据（数据库已有 5000+ 条），8 位为新生成（nanoid 加宽降低碰撞概率）。
 */
function validateCardIdFormat(cardId) {
  if (!cardId || typeof cardId !== 'string') {
    return false;
  }
  return /^[0-9a-z]{6,8}$/.test(cardId);
}

/**
 * 生成符合格式的卡片ID
 * @param {number} length - ID长度，默认6位
 * @returns {string} 生成的卡片ID
 */
function generateCardId(length = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // 验证生成的ID格式
  if (!validateCardIdFormat(result)) {
    throw new Error('生成的卡片ID格式不正确');
  }
  
  return result;
}

/**
 * 验证并生成唯一的卡片ID
 * @param {Object} prisma - Prisma客户端实例
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<string>} 唯一的卡片ID
 */
async function generateUniqueCardId(prisma, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    const cardId = generateCardId();
    
    // 检查ID是否已存在
    const existingCard = await prisma.card.findUnique({
      where: { id: cardId }
    });
    
    if (!existingCard) {
      return cardId;
    }
  }
  
  throw new Error(`无法在${maxRetries}次尝试内生成唯一的卡片ID`);
}

/**
 * 验证成员ID格式（可扩展用于其他实体）
 * @param {string} memberId - 成员ID
 * @returns {boolean} 是否符合格式要求
 */
function validateMemberIdFormat(memberId) {
  if (!memberId || typeof memberId !== 'string') {
    return false;
  }
  
  // 根据实际需求调整格式验证
  return memberId.length > 0 && memberId.length <= 191;
}

/**
 * 通用ID格式验证
 * @param {string} id - 要验证的ID
 * @param {RegExp} pattern - 验证模式
 * @returns {boolean} 是否符合格式要求
 */
function validateIdFormat(id, pattern) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  return pattern.test(id);
}

export {
  validateCardIdFormat,
  generateCardId,
  generateUniqueCardId,
  validateMemberIdFormat,
  validateIdFormat
};