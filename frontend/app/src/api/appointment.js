// src/api/appointment.js
import request from './index.js';

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