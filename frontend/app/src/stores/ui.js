// frontend/app/src/stores/ui.js

import { defineStore } from 'pinia';

export const useUIStore = defineStore('ui', {
  state: () => ({
    // 从 localStorage 读取用户上次的选择，如果没有则默认为 'default'
    fontSize: localStorage.getItem('appFontSize') || 'default',
  }),
  actions: {
    /**
     * 设置并持久化应用字体大小
     * @param {'default' | 'medium' | 'large'} newSize 
     */
    setFontSize(newSize) {
      // 校验传入的值
      const validSizes = ['default', 'medium', 'large'];
      if (!validSizes.includes(newSize)) {
        console.warn('无效的字体大小:', newSize);
        return;
      }
      
      this.fontSize = newSize;
      localStorage.setItem('appFontSize', newSize);
      // 应用字体大小的逻辑将在 App.vue 中处理
    },
  },
});