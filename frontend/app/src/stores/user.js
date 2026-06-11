// frontend/app/src/stores/user.js

import { defineStore } from 'pinia';
import { login as loginApi, logout as logoutApi, refreshToken as refreshTokenApi } from '@/api/auth';
import { jwtDecode } from 'jwt-decode';
import { useSystemStore } from './system'; // 引入 system store
import tokenManager from '@/utils/tokenManager';

function getInitialState() {
  const accessToken = localStorage.getItem('accessToken');
  // refresh token 在 httpOnly cookie 中、JS 读不到；这里只尝试用 access token 恢复登录态
  if (accessToken) {
    try {
      const decoded = jwtDecode(accessToken);
      if (decoded.exp * 1000 > Date.now()) {
        // 如果token有效，启动token管理器
        setTimeout(() => {
          tokenManager.restart();
        }, 100);

        return {
          accessToken,
          userInfo: { id: decoded.id, username: decoded.username, role: decoded.role },
        };
      }
    } catch (error) {
      // accessToken 解析失败，清掉坏值
    }
  }
  // access token 缺失/过期：清掉残留，由路由守卫用 cookie 里的 refresh token 续期
  localStorage.removeItem('accessToken');
  return { accessToken: null, userInfo: null };
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
        // refresh token 由后端通过 httpOnly cookie 下发，响应体只含 accessToken
        const { accessToken } = await loginApi(credentials);
        this.setTokens(accessToken);

        const decoded = jwtDecode(accessToken);
        this.userInfo = { id: decoded.id, username: decoded.username, role: decoded.role };

        // --- 核心修复：登录成功后，在这里获取预约数 ---
        const systemStore = useSystemStore();
        await systemStore.fetchTodayAppointmentCount();

        // 启动token自动刷新管理
        tokenManager.restart();

      } catch (error) {
        return Promise.reject(error);
      }
    },

    // 用 httpOnly cookie 里的 refresh token 换取新的 accessToken（页面刷新/启动时调用）
    async refreshAccessToken() {
      try {
        const { accessToken } = await refreshTokenApi();
        if (!accessToken) return false;
        this.setTokens(accessToken);
        const decoded = jwtDecode(accessToken);
        this.userInfo = { id: decoded.id, username: decoded.username, role: decoded.role };
        tokenManager.restart();
        return true;
      } catch (error) {
        // 续期失败（cookie 缺失/过期）：清除本地残留，由路由守卫跳转登录
        this.accessToken = null;
        this.userInfo = null;
        localStorage.removeItem('accessToken');
        return false;
      }
    },

    setTokens(accessToken) {
      this.accessToken = accessToken;
      localStorage.setItem('accessToken', accessToken);
    },

    clearTokensAndRedirect() {
      // 停止token管理器
      tokenManager.destroy();

      this.accessToken = null;
      this.userInfo = null;
      localStorage.removeItem('accessToken');

      // 通知后端删除 refresh token 并清除 cookie（refresh token 在 cookie 中随请求自动带）
      logoutApi().catch(() => { /* Logout notification failed - handled silently */ });

      window.location.href = '/login';
    },

    logout() {
      this.clearTokensAndRedirect();
    },
  },
});
