// frontend/app/src/utils/date.js

// 设定整个应用的基准时区，确保所有用户看到的时间都是一致的
const appTimeZone = 'Asia/Shanghai';

/**
 * 使用应用的基准时区来格式化日期和时间。
 * @param {string | Date} isoString - 从后端获取的ISO 8601格式的UTC时间字符串或Date对象。
 * @param {object} options - Intl.DateTimeFormat的额外选项。
 * @returns {string} 格式化后的本地化时间字符串。
 */
export function formatInAppTimeZone(isoString, options = {}) {
  if (!isoString) return '无记录';
  const date = new Date(isoString);
  // 使用Intl API，无需额外依赖
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: appTimeZone,
    ...options
  }).format(date);
}

/**
 * 仅格式化日期部分。
 * @param {string | Date} isoString - 从后端获取的ISO 8601格式的UTC时间字符串或Date对象。
 * @returns {string} 格式化后的本地化日期字符串 (YYYY/MM/DD)。
 */
export function formatDateInAppTimeZone(isoString) {
  if (!isoString) return '无记录';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: appTimeZone
  }).format(date);
}

/**
 * 仅格式化时间部分。
 * @param {string | Date} isoString - 从后端获取的ISO 8601格式的UTC时间字符串或Date对象。
 * @returns {string} 格式化后的本地化时间字符串 (HH:mm)。
 */
export function formatTimeInAppTimeZone(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: appTimeZone
    }).format(date);
}