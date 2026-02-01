// frontend/app/src/api/booking.js

import axios from 'axios';

const publicApi = axios.create({
  baseURL: '/api/public/booking',
  timeout: 10000
});

publicApi.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export const getBookingOptions = (code) => {
  return publicApi({
    url: '/options',
    method: 'get',
    params: { code }
  });
};

export const createBooking = (code, data) => {
  return publicApi({
    url: '/',
    method: 'post',
    params: { code },
    data
  });
};
