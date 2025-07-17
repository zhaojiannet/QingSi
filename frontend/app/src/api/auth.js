// frontend/app/src/api/auth.js

import request from './index.js';

export const login = (data) => {
  return request({
    url: '/auth/login',
    method: 'post',
    data,
  });
};

// 新增
export const refreshToken = (data) => {
  return request({
    url: '/auth/refresh',
    method: 'post',
    data, // { refreshToken }
  });
};

// 新增
export const logout = (data) => {
  return request({
    url: '/auth/logout',
    method: 'post',
    data, // { refreshToken }
  });
};