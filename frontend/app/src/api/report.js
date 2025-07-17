// src/api/report.js
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