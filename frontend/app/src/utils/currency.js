// frontend/app/src/utils/currency.js
// 统一的金额格式化工具，确保所有金额显示保持2位小数且避免浮点数误差

import Decimal from 'decimal.js';

/**
 * 格式化金额显示，确保2位小数且无浮点数误差
 * @param {number|string|Decimal} amount - 金额数值
 * @returns {string} 格式化后的金额字符串，如 "123.45"
 */
export function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return '0.00';
  }
  
  try {
    return new Decimal(amount).toFixed(2);
  } catch (error) {
    console.warn('Invalid amount format:', amount, error);
    return '0.00';
  }
}

/**
 * 格式化金额显示并添加货币符号
 * 项目约定：¥ 与数字之间无空格（与组件内 `¥{{ formatAmount(x) }}` 拼写一致）。
 * @param {number|string|Decimal} amount - 金额数值
 * @returns {string} 格式化后的金额字符串，如 "¥123.45"
 */
export function formatCurrency(amount) {
  return `¥${formatAmount(amount)}`;
}

/**
 * 安全的金额计算，返回Decimal对象
 * @param {number|string|Decimal} amount - 金额数值
 * @returns {Decimal} Decimal对象
 */
export function toDecimal(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return new Decimal(0);
  }
  
  try {
    return new Decimal(amount);
  } catch (error) {
    console.warn('Invalid amount for Decimal conversion:', amount, error);
    return new Decimal(0);
  }
}

/**
 * 金额相加
 * @param {number|string|Decimal} a
 * @param {number|string|Decimal} b
 * @returns {string} 格式化后的结果，如 "123.45"
 */
export function addAmounts(a, b) {
  return toDecimal(a).plus(toDecimal(b)).toFixed(2);
}

/**
 * 金额相减
 * @param {number|string|Decimal} a
 * @param {number|string|Decimal} b
 * @returns {string} 格式化后的结果，如 "123.45"
 */
export function subtractAmounts(a, b) {
  return toDecimal(a).minus(toDecimal(b)).toFixed(2);
}

/**
 * 金额相乘
 * @param {number|string|Decimal} a
 * @param {number|string|Decimal} b
 * @returns {string} 格式化后的结果，如 "123.45"
 */
export function multiplyAmounts(a, b) {
  return toDecimal(a).times(toDecimal(b)).toFixed(2);
}

/**
 * 金额相除
 * @param {number|string|Decimal} a
 * @param {number|string|Decimal} b
 * @returns {string} 格式化后的结果，如 "123.45"
 */
export function divideAmounts(a, b) {
  const divisor = toDecimal(b);
  if (divisor.isZero()) {
    return '0.00';
  }
  return toDecimal(a).div(divisor).toFixed(2);
}

/**
 * 格式化折扣率显示
 * @param {number|string|Decimal} rate - 折扣率 (0-1)
 * @returns {string} 如 "8折"
 */
export function formatDiscountRate(rate) {
  const discount = toDecimal(rate).times(10);
  return `${Math.round(discount.toNumber())}折`;
}