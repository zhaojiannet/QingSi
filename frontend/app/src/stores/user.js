//frontend/app/src/stores/user.js


import { defineStore } from 'pinia';
import { login as loginApi } from '@/api/auth';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('authToken') || null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(credentials) {
      try {
        const { token } = await loginApi(credentials);
        this.token = token;
        localStorage.setItem('authToken', token);
      } catch (error) {
        // 让错误在 api/index.js 中被统一处理，这里只向上抛出
        return Promise.reject(error);
      }
    },
    logout() {
      this.token = null;
      localStorage.removeItem('authToken');
      // 跳转到登录页
      window.location.href = '/login';
    },
  },
});