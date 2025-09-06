// frontend/app/src/utils/date.js
// 统一使用时区检测系统，避免硬编码

import { getUserTimezone, formatDate } from './timezone-unified';

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
    }).format(date).replace(/\//g, '/');
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
    
    return formatted.replace(/\//g, '/');
}