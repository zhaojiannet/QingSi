//frontend/app/src/api/staff.js

import request from './index.js';

export const getStaffList = (params) => {
  return request({
    url: '/staff',
    method: 'get',
    params, // 将 params 对象传递给 axios
  });
};

export const createStaff = (data) => {
  return request({
    url: '/staff',
    method: 'post',
    data,
  });
};

export const updateStaff = (id, data) => {
  return request({
    url: `/staff/${id}`,
    method: 'put',
    data,
  });
};