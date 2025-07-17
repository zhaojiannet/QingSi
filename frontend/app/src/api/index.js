import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';

const service = axios.create({ 
  baseURL: '/api', 
  timeout: 10000 
});

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    const userStore = useUserStore();
    if (userStore.isLoggedIn && config.headers) {
      config.headers['Authorization'] = `Bearer ${userStore.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const userStore = useUserStore();
    
    // --- 核心修改：重构整个错误处理逻辑 ---
    if (error.response) {
      const { status, data, config } = error.response;
      const message = data?.message || '服务器发生未知错误';
      
      // 判断是否是登录接口返回的401错误
      const isLoginFailure = status === 401 && config.url === '/auth/login';

      if (isLoginFailure) {
        // 如果是登录失败（用户名或密码错误），只弹出警告提示，不跳转
        ElMessage.warning(message);
      } else if (status === 401) {
        // 如果是其他接口返回的401（通常是Token过期或无效），则执行登出
        ElMessage.error('认证已过期，请重新登录');
        userStore.logout();
      } else {
        // 处理其他所有错误（如400, 404, 500等）
        const messageType = status >= 500 ? 'error' : 'warning';
        ElMessage({
          message: message,
          type: messageType,
          duration: 5 * 1000,
        });
      }
    } else if (error.request) {
      ElMessage.error('网络连接异常，请检查您的网络');
    } else {
      ElMessage.error('请求发送失败');
    }
    
    return Promise.reject(error);
  }
);

export default service;