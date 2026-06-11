// frontend/app/src/api/index.js

import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { refreshToken as refreshTokenApi } from './auth';
import { setTimezoneHeader } from '@/utils/timezone-unified';

const service = axios.create({
  baseURL: '/api',
  timeout: 10000,
  // 让 httpOnly cookie（refresh token、验证码 session）随请求自动发送
  withCredentials: true,
});

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    const userStore = useUserStore();
    
    // 确保只在有 accessToken 时才添加Authorization请求头
    if (userStore.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${userStore.accessToken}`;
    }
    
    // 自动为所有请求添加时区头信息
    if (config.headers) {
      setTimezoneHeader(config.headers);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- 刷新逻辑控制 ---
// 标记是否正在刷新token
let isRefreshing = false;
// 存储因token过期而失败的请求的回调函数
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 响应拦截器
service.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const originalRequest = error.config;
    
    // 登录/刷新接口自身返回的 401 不走刷新流程：
    // 登录密码错误应直接提示用户，刷新失败应直接登出
    const isAuthRetryExempt =
      originalRequest.url === '/auth/refresh' || originalRequest.url === '/auth/login';

    // _retry 标记防止刷新后用新 token 重试仍 401 时陷入无限刷新-重试循环
    if (error.response?.status === 401 && !isAuthRetryExempt && !originalRequest._retry) {
      originalRequest._retry = true;
      if (isRefreshing) {
        // 如果正在刷新中，将当前失败的请求存入队列，并返回一个pending的Promise
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return service(originalRequest); // 刷新成功后，用新token重试
        });
      }

      isRefreshing = true;
      const userStore = useUserStore();

      return new Promise((resolve, reject) => {
        // refresh token 在 httpOnly cookie 中，随请求自动发送，无需手动传
        refreshTokenApi()
          .then(res => {
            const { accessToken } = res;
            userStore.setTokens(accessToken); // 更新 store 和 localStorage
            
            // 用新的 token 重试原始请求
            originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;
            resolve(service(originalRequest));
            
            // 执行队列中所有挂起的请求
            processQueue(null, accessToken);
          })
          .catch(err => {
            // 刷新失败，清空所有状态并重定向到登录页
            processQueue(err, null);
            userStore.clearTokensAndRedirect();
            ElMessage.error('您的会话已过期，请重新登录。');
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }
    
    // 处理其他所有非401错误
    const message = error.response?.data?.message || '服务器发生未知错误';
    const messageType = error.response?.status >= 500 ? 'error' : 'warning';
    
    // 避免对 429 速率限制错误弹出通用提示
    if (error.response?.status !== 429) {
        ElMessage({
            message: message,
            type: messageType,
            duration: 5 * 1000,
        });
    } else {
        ElMessage.error('您的操作过于频繁，请稍后再试。');
    }
    
    return Promise.reject(error);
  }
);

export default service;