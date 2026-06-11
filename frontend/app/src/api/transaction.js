// frontend/app/src/api/transaction.js
import request from './index.js';

export const createTransaction = (data) => {
  return request({
    url: '/transactions',
    method: 'post',
    data,
  });
};

export const getTodayTransactions = (params = {}) => {
  return request({
    url: '/transactions/today',
    method: 'get',
    params
  });
};

// 按日期范围查询流水
export const getTransactionsByDateRange = (params) => {
  return request({
    url: '/transactions',
    method: 'get',
    params, // { startDate, endDate }
  });
};

// 兼容旧函数名：与 createTransaction 等价，统一走 /transactions 智能支付
export const createMultiCardTransaction = (data) => {
  return request({
    url: '/transactions',
    method: 'post',
    data,
  });
};

// 撤销交易
export const voidTransaction = (transactionId, reason = null) => {
  return request({
    url: `/transactions/${transactionId}/void`,
    method: 'post',
    data: { reason },
  });
};
