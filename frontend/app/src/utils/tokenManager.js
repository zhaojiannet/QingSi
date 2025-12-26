// frontend/app/src/utils/tokenManager.js

import { jwtDecode } from 'jwt-decode';
import { useUserStore } from '@/stores/user';
import { refreshToken as refreshTokenApi } from '@/api/auth';

class TokenManager {
  constructor() {
    this.checkInterval = null;
    this.visibilityChangeHandler = null;
    this.isRefreshing = false;
    
    // 初始化
    this.init();
  }

  init() {
    // 启动定时检查
    this.startTokenCheck();
    
    // 监听页面可见性变化
    this.setupVisibilityListener();
  }

  // 启动定时检查token状态
  startTokenCheck() {
    // 每30秒检查一次token状态
    this.checkInterval = setInterval(() => {
      this.checkAndRefreshToken();
    }, 30 * 1000);
  }

  // 停止定时检查
  stopTokenCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // 监听页面可见性变化
  setupVisibilityListener() {
    this.visibilityChangeHandler = () => {
      if (!document.hidden) {
        // 页面重新获得焦点时立即检查token
        this.checkAndRefreshToken();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  // 移除页面可见性监听
  removeVisibilityListener() {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  }

  // 检查并刷新token
  async checkAndRefreshToken() {
    const userStore = useUserStore();
    
    if (!userStore.accessToken || !userStore.refreshToken) {
      return;
    }

    try {
      const decoded = jwtDecode(userStore.accessToken);
      const currentTime = Date.now() / 1000;
      const expirationTime = decoded.exp;
      
      // 如果token在5分钟内过期，则主动刷新
      const shouldRefresh = (expirationTime - currentTime) < 300; // 300秒 = 5分钟
      
      if (shouldRefresh && !this.isRefreshing) {
        await this.refreshToken();
      }
    } catch (error) {
      console.warn('Token检查失败:', error);
      // token解析失败，可能已经过期或格式错误
      if (!this.isRefreshing) {
        await this.refreshToken();
      }
    }
  }

  // 刷新token
  async refreshToken() {
    const userStore = useUserStore();
    
    if (this.isRefreshing || !userStore.refreshToken) {
      return;
    }

    this.isRefreshing = true;

    try {
      const res = await refreshTokenApi({ refreshToken: userStore.refreshToken });
      const { accessToken } = res;
      
      // 更新token
      userStore.setTokens(accessToken);
      
      console.log('Token自动刷新成功');
    } catch (error) {
      console.error('Token自动刷新失败:', error);
      // 刷新失败，清除所有状态并重定向到登录页
      userStore.clearTokensAndRedirect();
    } finally {
      this.isRefreshing = false;
    }
  }

  // 销毁token管理器
  destroy() {
    this.stopTokenCheck();
    this.removeVisibilityListener();
  }

  // 重启token管理器（登录后调用）
  restart() {
    this.destroy();
    this.init();
  }
}

// 创建单例实例
const tokenManager = new TokenManager();

export default tokenManager;