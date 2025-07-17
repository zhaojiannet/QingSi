// frontend/app/src/api/cardType.js

import request from './index.js';

export const getCardTypeList = (params) => {
  return request({
    url: '/card-types',
    method: 'get',
    params,
  });
};

export const createCardType = (data) => {
  return request({
    url: '/card-types',
    method: 'post',
    data,
  });
};

// --- 核心修正：修复模板字符串的拼接错误 ---
export const updateCardType = (id, data) => {
  return request({
    // 之前这里可能是 `url: '/card-types/${id}'` (使用了单引号)
    // 正确的写法是使用反引号 ``
    url: `/card-types/${id}`, 
    method: 'put',
    data,
  });
};