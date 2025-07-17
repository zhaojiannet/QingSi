//frontend/app/src/api/service.js


import request from './index.js';

export const getServiceList = (params) => {
  return request({
    url: '/services',
    method: 'get',
    params, // 将 params 对象传递给 axios
  });
};

export const createService = (data) => {
  return request({
    url: '/services',
    method: 'post',
    data,
  });
};

export const updateService = (id, data) => {
  return request({
    url: `/services/${id}`,
    method: 'put',
    data,
  });
};

// 新增
export const deleteService = (id) => {
  return request({
    url: `/services/${id}`,
    method: 'delete',
  });
};