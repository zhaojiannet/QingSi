// frontend/app/src/utils/date.js
// 统一使用时区检测系统，避免硬编码

import { getUserTimezone } from './timezone-unified';

/**
 * 使用统一时区系统格式化日期和时间
 * @param {string | Date} isoString - ISO时间字符串或Date对象
 * @param {object} options - 格式化选项
 * @returns {string} 格式化后的时间字符串
 */
export function formatInAppTimeZone(isoString, options = {}) {
  if (!isoString) return '无记录';
  
  const date = new Date(isoString);
  // 使用统一的时区检测
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: getUserTimezone(),
    ...options
  }).format(date);
}

/**
 * 仅格式化日期部分 - 统一时区
 */
export function formatDateInAppTimeZone(isoString) {
  if (!isoString) return '无记录';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: getUserTimezone()
  }).format(date);
}

/**
 * 纯日期字段（如生日）：后端存为 UTC 零点，必须按 UTC 取日历日，
 * 若按用户时区格式化，UTC 负偏移时区会前移一天
 */
export function formatPureDate(isoString) {
  if (!isoString) return '无记录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(isoString));
}

/**
 * 纯日期字段仅取月日（如生日提醒），同上按 UTC 读取
 */
export function formatPureMonthDay(isoString) {
  if (!isoString) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(isoString));
}

/**
 * 仅格式化时间部分 - 统一时区
 */
export function formatTimeInAppTimeZone(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: getUserTimezone()
    }).format(date);
}

/**
 * 格式化短日期 - 统一时区
 */
export function formatShortDateInAppTimeZone(isoString) {
    if (!isoString) return '无记录';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: getUserTimezone()
    }).format(date);
}

/**
 * 格式化完整日期时间 - 统一时区
 */
export function formatFullDateTimeInAppTimeZone(isoString) {
    if (!isoString) return '无记录';
    const date = new Date(isoString);
    const formatted = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: getUserTimezone()
    }).format(date);

    return formatted;
}