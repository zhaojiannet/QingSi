// frontend/app/src/api/user.js


import request from './index.js';

export const updateUserPassword = (data) => {
  return request({
    url: '/users/password',
    method: 'patch', // 使用 PATCH 更符合 RESTful 规范，表示局部更新
    data, // { oldPassword, newPassword }
  });
};