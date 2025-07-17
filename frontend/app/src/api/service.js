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