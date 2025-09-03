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
        // Error fetching appointment count - handled silently
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
        // Error fetching birthday count - handled silently
        this.upcomingBirthdayCount = 0;
      }
    },

  },
});