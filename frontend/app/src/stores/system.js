// frontend/app/src/stores/system.js

import { defineStore } from 'pinia';
import { getTodayAppointmentCount } from '@/api/appointment.js';
import { getBirthdayReminders } from '@/api/report.js'; // 引入新API

export const useSystemStore = defineStore('system', {
  state: () => ({
    todayAppointmentCount: 0,
    // 新增：生日提醒数量
    upcomingBirthdayCount: 0,
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
    
    // 新增：获取生日提醒数量的 action
    async fetchUpcomingBirthdayCount() {
      try {
        // getBirthdayReminders 返回的是一个数组
        const reminders = await getBirthdayReminders();
        this.upcomingBirthdayCount = reminders.length;
      } catch (error) {
        console.error('获取生日提醒数量失败:', error);
        this.upcomingBirthdayCount = 0;
      }
    },

  },
});