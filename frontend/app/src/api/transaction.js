//frontend/app/src/api/transaction.js

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

// --- 新增 ---
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