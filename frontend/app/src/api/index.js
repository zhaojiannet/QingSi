// frontend/app/src/api/index.js

import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { refreshToken as refreshTokenApi } from './auth';
import { setTimezoneHeader } from '@/utils/timezone-unified';

const service = axios.create({ 
  baseURL: '/api', 
  timeout: 10000 
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
    
    // 只处理 401 Unauthorized 错误
    if (error.response?.status === 401 && originalRequest.url !== '/auth/refresh') {
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
        refreshTokenApi({ refreshToken: userStore.refreshToken })
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