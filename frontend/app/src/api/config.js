//frontend/app/src/api/config.js


import request from './index.js';

export const getSystemConfig = () => {
  return request({
    url: '/configs',
    method: 'get',
  });
};

export const updateSystemConfig = (data) => {
  return request({
    url: '/configs',
    method: 'patch',
    data,
  });
};