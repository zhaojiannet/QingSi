// frontend/app/src/api/report.js

import request from './index.js';

// 获取核心营业报表
export const getBusinessReport = (params) => {
  return request({
    url: '/reports/business',
    method: 'get',
    params, // { startDate, endDate }
  });
};

// 获取项目销售排行榜
export const getServiceRanking = () => {
  return request({
    url: '/reports/service-ranking',
    method: 'get',
  });
};

// 获取沉睡会员列表
export const getSleepingMembers = () => {
  return request({
    url: '/reports/sleeping-members',
    method: 'get',
  });
};

// --- 新增1：获取会员消费排行 ---
export const getMemberRanking = () => {
    return request({
      url: '/reports/member-ranking',
      method: 'get',
    });
};

// --- 新增2：获取生日提醒列表 ---
export const getBirthdayReminders = () => {
    return request({
      url: '/reports/birthday-reminders',
      method: 'get',
    });
};


// --- 新增1：获取支付方式构成分析 ---
export const getPaymentSummary = (params) => {
  return request({
    url: '/reports/payment-summary',
    method: 'get',
    params, // { startDate, endDate }
  });
};

// --- 新增2：获取会员卡销售分析 ---
export const getCardSalesSummary = (params) => {
  return request({
    url: '/reports/card-sales-summary',
    method: 'get',
    params, // { startDate, endDate }
  });
};