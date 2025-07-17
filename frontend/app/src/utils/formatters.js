// frontend/app/src/utils/formatters.js

/**
 * 格式化会员状态文本
 * @param {string} status - 后端返回的状态枚举
 * @returns {string} 本地化的状态文本
 */
export const memberStatusText = (status) => {
  // 核心修改：更新为新的业务术语
  const map = { ACTIVE: '正常', INACTIVE: '冻结', DELETED: '已注销' };
  return map[status] || '未知';
};

/**
 * 获取会员状态对应的Element Plus Tag类型
 * @param {string} status - 后端返回的状态枚举
 * @returns {string} success | warning | danger
 */
export const memberStatusTagType = (status) => {
  // 核心修改：为“冻结”状态分配 warning 类型
  const map = { ACTIVE: 'success', INACTIVE: 'warning', DELETED: 'danger' };
  return map[status] || 'info';
};

/**
 * 格式化预约状态文本
 * @param {string} status - 后端返回的状态枚举
 * @returns {string} 本地化的状态文本
 */
export const appointmentStatusText = (status) => {
  const map = { PENDING: '待确认', CONFIRMED: '已确认', COMPLETED: '已完成', CANCELLED: '已取消', NO_SHOW: '未到店' };
  return map[status] || '未知';
};

/**
 * 获取预约状态对应的Element Plus Tag类型
 * @param {string} status - 后端返回的状态枚举
 * @returns {string} warning | primary | success | info | danger
 */
export const appointmentStatusTagType = (status) => {
  const map = { PENDING: 'warning', CONFIRMED: 'primary', COMPLETED: 'success', CANCELLED: 'info', NO_SHOW: 'danger' };
  return map[status] || 'info';
};

/**
 * 格式化会员卡状态文本
 * @param {string} status - 后端返回的状态枚举
 * @returns {string} 本地化的状态文本
 */
export const cardStatusText = (status) => {
  const map = { ACTIVE: '有效', DEPLETED: '已用尽', EXPIRED: '已过期', FROZEN: '已冻结' };
  return map[status] || '未知';
};

/**
 * 获取会员卡状态对应的Element Plus Tag类型
 * @param {string} status - 后端返回的状态枚举
 * @returns {string} success | info | warning | danger
 */
export const cardStatusTagType = (status) => {
  const map = { ACTIVE: 'success', DEPLETED: 'info', EXPIRED: 'warning', FROZEN: 'danger' };
  return map[status] || 'info';
};