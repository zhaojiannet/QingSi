// frontend/app/src/api/auth.js

import request from './index.js';

export const login = (data) => {
  return request({
    url: '/auth/login',
    method: 'post',
    data,
  });
};

// refresh token 在 httpOnly cookie 中随请求自动发送；body 传空对象满足后端 JSON 校验
export const refreshToken = () => {
  return request({
    url: '/auth/refresh',
    method: 'post',
    data: {},
  });
};

export const logout = () => {
  return request({
    url: '/auth/logout',
    method: 'post',
    data: {},
  });
};