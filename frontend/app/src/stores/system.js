// frontend/app/src/stores/system.js

import { defineStore } from 'pinia';
import { getTodayAppointmentCount } from '@/api/appointment.js';

export const useSystemStore = defineStore('system', {
  state: () => ({
    todayAppointmentCount: 0,
  }),
  actions: {
    async fetchTodayAppointmentCount() {
      try {
        const { count } = await getTodayAppointmentCount();
        this.todayAppointmentCount = count;
      } catch (error) {
        console.error('获取今日预约数量失败:', error);
        this.todayAppointmentCount = 0;
      }
    },
    // 提供一个直接设置数量的方法，用于乐观更新或测试
    setTodayAppointmentCount(count) {
        this.todayAppointmentCount = count;
    }
  },
});