// frontend/app/src/api/auth.js

import request from './index.js';

export const login = (data) => {
  return request({
    url: '/auth/login',
    method: 'post',
    data,
  });
};