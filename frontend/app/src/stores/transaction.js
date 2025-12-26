//frontend/app/src/stores/transaction.js

import { defineStore } from 'pinia';

export const useTransactionStore = defineStore('transaction', {
  state: () => ({
    // 用于从预约页传递到结算页的临时数据
    appointmentToCheckout: null, 
  }),
  actions: {
    // 设置要结算的预约信息
    setAppointmentToCheckout(appointmentData) {
      this.appointmentToCheckout = appointmentData;
    },
    // 取出数据，取后即焚
    consumeAppointmentToCheckout() {
      const data = this.appointmentToCheckout;
      this.appointmentToCheckout = null; // 取出后立即清空
      return data;
    },
  },
});