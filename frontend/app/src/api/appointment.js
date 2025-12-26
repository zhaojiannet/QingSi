// frontend/app/src/api/appointment.js

import request from './index.js';

// --- 新增：获取当日预约数量的API函数 ---
export const getTodayAppointmentCount = () => {
  return request({
    url: '/appointments/count/today',
    method: 'get',
  });
};

export const getAppointments = (params) => {
  return request({
    url: '/appointments',
    method: 'get',
    params,
  });
};

export const createAppointment = (data) => {
  return request({
    url: '/appointments',
    method: 'post',
    data,
  });
};

export const updateAppointmentStatus = (id, status) => {
  return request({
    url: `/appointments/${id}/status`,
    method: 'patch',
    data: { status },
  });
};