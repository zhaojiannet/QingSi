// frontend/app/src/stores/user.js

import { defineStore } from 'pinia';
import { login as loginApi, logout as logoutApi } from '@/api/auth';
import { jwtDecode } from 'jwt-decode';
import { useSystemStore } from './system'; // 引入 system store

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
      // Token parsing failed - handled silently
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
        
        // --- 核心修复：登录成功后，在这里获取预约数 ---
        const systemStore = useSystemStore();
        await systemStore.fetchTodayAppointmentCount();

      } catch (error) {
        return Promise.reject(error);
      }
    },
    
    setTokens(accessToken, refreshToken) {
      this.accessToken = accessToken;
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        localStorage.setItem('refreshToken', refreshToken);
      }
    },

    clearTokensAndRedirect() {
      const refreshToken = this.refreshToken;
      
      this.accessToken = null;
      this.refreshToken = null;
      this.userInfo = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      if (refreshToken) {
        logoutApi({ refreshToken }).catch(() => { /* Logout notification failed - handled silently */ });
      }

      window.location.href = '/login';
    },

    logout() {
      this.clearTokensAndRedirect();
    },
  },
});