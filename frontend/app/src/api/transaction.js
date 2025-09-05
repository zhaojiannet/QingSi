// frontend/app/src/api/transaction.js
import request from './index.js';

export const createTransaction = (data) => {
  return request({
    url: '/transactions',
    method: 'post',
    data,
  });
};

export const getTodayTransactions = () => {
  return request({
    url: '/transactions/today',
    method: 'get',
  });
};

// --- 优化点2: 新增流水查询API ---
export const getTransactionsByDateRange = (params) => {
  return request({
    url: '/transactions',
    method: 'get',
    params, // { startDate, endDate }
  });
};

export const createComboCheckout = (data) => {
  return request({
    url: '/transactions/combo-checkout',
    method: 'post',
    data,
  });
};

export const getComboCheckoutPreview = (data) => {
  return request({
    url: '/transactions/combo-preview',
    method: 'post',
    data,
  });
};

// 智能会员卡支付接口（自动选择最优支付方式：单卡或多卡组合）
export const createSmartCardPayment = (data) => {
  return request({
    url: '/transactions',
    method: 'post',
    data,
  });
};

// 兼容性：保留旧函数名，使用智能支付接口
export const createMultiCardTransaction = (data) => {
  return request({
    url: '/transactions',
    method: 'post',
    data,
  });
};