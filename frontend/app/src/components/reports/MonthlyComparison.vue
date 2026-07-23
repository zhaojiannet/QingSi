<template>
  <div v-loading="state.loading" class="monthly-comparison">
    <div class="chart-block">
      <h3 class="chart-title">营业金额（近 12 个月）</h3>
      <v-chart v-if="state.amountOption" :option="state.amountOption" autoresize class="chart" />
    </div>
    <div class="chart-block">
      <h3 class="chart-title">客流与会员</h3>
      <v-chart v-if="state.customerOption" :option="state.customerOption" autoresize class="chart" />
    </div>
    <div class="chart-block">
      <h3 class="chart-title">挂账</h3>
      <v-chart v-if="state.pendingOption" :option="state.pendingOption" autoresize class="chart" />
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { getMonthlyBusinessReport } from '@/api/report.js';
import {
  generateMonthlyAmountOption,
  generateMonthlyCustomerOption,
  generateMonthlyPendingOption,
} from './chartOptions.js';

const state = reactive({ loading: false, amountOption: null, customerOption: null, pendingOption: null });

const fetchData = async () => {
  state.loading = true;
  try {
    const data = await getMonthlyBusinessReport();
    state.amountOption = generateMonthlyAmountOption(data);
    state.customerOption = generateMonthlyCustomerOption(data);
    state.pendingOption = generateMonthlyPendingOption(data);
  } finally {
    state.loading = false;
  }
};

onMounted(fetchData);
</script>

<style scoped>
.monthly-comparison {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.chart-block {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 20px;
}
.chart-title {
  font-size: 16px;
  color: #303133;
  margin: 0 0 15px;
}
.chart {
  height: 300px;
  width: 100%;
}
</style>
