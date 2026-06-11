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

export {
  validateCardIdFormat
};
