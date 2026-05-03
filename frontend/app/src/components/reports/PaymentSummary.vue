<template>
  <div v-loading="state.loading" class="chart-table-layout">
    <div class="chart-container">
      <v-chart v-if="state.chartOption" :option="state.chartOption" autoresize />
      <el-empty v-else description="暂无数据" />
    </div>
    <div class="table-container">
      <el-table :data="state.data" stripe show-overflow-tooltip>
        <el-table-column prop="name" label="支付方式" />
        <el-table-column prop="value" label="金额 (元)" align="right" />
        <el-table-column prop="count" label="笔数" align="center" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';
import VChart from 'vue-echarts';
import { getPaymentSummary } from '@/api/report.js';
import { generatePieOption } from './chartOptions.js';

const props = defineProps({
  dateRange: { type: Array, required: true }
});

const state = reactive({ loading: false, data: [], chartOption: null });

const reload = async () => {
  if (!props.dateRange || props.dateRange.length !== 2) return;
  state.loading = true;
  state.chartOption = null;
  try {
    const params = { startDate: props.dateRange[0], endDate: props.dateRange[1] };
    const data = await getPaymentSummary(params);
    state.data = data;
    if (data.length > 0) {
      state.chartOption = generatePieOption('支付方式构成', data);
    }
  } finally {
    state.loading = false;
  }
};

watch(() => props.dateRange, reload, { immediate: true });

defineExpose({ reload });
</script>

<style scoped>
.chart-table-layout {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.chart-container {
  flex: 1;
  min-width: 300px;
  height: 400px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background-color: #fff;
}
.table-container {
  flex: 1;
  min-width: 300px;
}
</style>
