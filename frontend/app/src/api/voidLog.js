// frontend/app/src/api/voidLog.js
import request from './index.js';

// 获取撤销日志列表
export const getVoidLogs = (params = {}) => {
  return request({
    url: '/void-logs',
    method: 'get',
    params,
  });
};

// 获取单条撤销日志详情
export const getVoidLogDetail = (id) => {
  return request({
    url: `/void-logs/${id}`,
    method: 'get',
  });
};
