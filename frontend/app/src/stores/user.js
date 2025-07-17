// frontend/app/src/stores/user.js

import { defineStore } from 'pinia';
import { login as loginApi, logout as logoutApi } from '@/api/auth'; // 引入 logoutApi
import { jwtDecode } from 'jwt-decode';

function getInitialState() {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (accessToken && refreshToken) {
    try {
      const decoded = jwtDecode(accessToken);
      if (decoded.exp * 1000 > Date.now()) {
        return {
          accessToken,
          refreshToken,
          userInfo: { id: decoded.id, username: decoded.username, role: decoded.role },
        };
      }
    } catch (error) {
      console.error('解析旧的 Access Token 失败:', error);
    }
  }
  return { accessToken: null, refreshToken: null, userInfo: null };
}

export const useUserStore = defineStore('user', {
  state: () => getInitialState(),

  getters: {
    isLoggedIn: (state) => !!state.accessToken,
    userRole: (state) => state.userInfo?.role || null,
  },

  actions: {
    async login(credentials) {
      try {
        const { accessToken, refreshToken } = await loginApi(credentials);
        this.setTokens(accessToken, refreshToken);

        const decoded = jwtDecode(accessToken);
        this.userInfo = { id: decoded.id, username: decoded.username, role: decoded.role };
      } catch (error) {
        return Promise.reject(error);
      }
    },
    
    // 新增：用于设置和存储令牌
    setTokens(accessToken, refreshToken) {
      this.accessToken = accessToken;
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) { // 刷新令牌是可选的，只有在登录时才更新
        this.refreshToken = refreshToken;
        localStorage.setItem('refreshToken', refreshToken);
      }
    },

    // 新增：清理令牌
    clearTokensAndRedirect() {
      const refreshToken = this.refreshToken;
      
      this.accessToken = null;
      this.refreshToken = null;
      this.userInfo = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('rememberedCredentials');
      
      // 异步通知后端也销毁该 refresh token
      if (refreshToken) {
        logoutApi({ refreshToken }).catch(err => console.error("通知后端登出失败:", err));
      }

      window.location.href = '/login';
    },

    // 修改：logout 方法现在只调用清理函数
    logout() {
      this.clearTokensAndRedirect();
    },
  },
});