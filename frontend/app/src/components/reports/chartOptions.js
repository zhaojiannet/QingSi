import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, BarChart, LineChart } from 'echarts/charts';
import { formatCurrency } from '@/utils/currency.js';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';

use([CanvasRenderer, PieChart, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent]);

export const generatePieOption = (title, data) => ({
  title: { text: title, left: 'center', top: '5%' },
  tooltip: { trigger: 'item', formatter: '{b} : ¥{c} ({d}%)' },
  legend: { top: 'bottom', left: 'center' },
  series: [{
    name: '金额',
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: false,
    itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
    label: { show: false, position: 'center' },
    emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
    labelLine: { show: false },
    data: data.map(item => ({ value: item.value, name: item.name })),
  }],
});

// --- 月度对比图（data 为 /reports/business/monthly 的返回数组） ---

const monthlyBase = (data) => ({
  legend: { top: 'top' },
  grid: { left: '3%', right: '3%', bottom: '3%', containLabel: true },
  xAxis: { type: 'category', data: data.map(item => item.month), axisLabel: { rotate: 45 } },
  yAxis: { type: 'value' },
});

// 营业金额：总消费 / 充值 / 卡耗
export const generateMonthlyAmountOption = (data) => ({
  ...monthlyBase(data),
  tooltip: { trigger: 'axis', valueFormatter: (v) => formatCurrency(v) },
  series: [
    { name: '总消费', type: 'bar', data: data.map(item => Number(item.totalRevenue)) },
    { name: '充值', type: 'bar', data: data.map(item => Number(item.totalRecharge)) },
    { name: '卡耗', type: 'bar', data: data.map(item => Number(item.cardConsumption)) },
  ],
});

// 客流与会员：客数 / 新增会员折线，tooltip 附带客单价
export const generateMonthlyCustomerOption = (data) => ({
  ...monthlyBase(data),
  tooltip: {
    trigger: 'axis',
    formatter: (params) => {
      const row = data[params[0].dataIndex];
      const lines = params.map(p => `${p.marker}${p.seriesName}：${p.value} 人`);
      lines.push(`客单价：${formatCurrency(row.averageOrderValue)}`);
      return `${row.month}<br/>${lines.join('<br/>')}`;
    },
  },
  series: [
    { name: '到店客数', type: 'line', data: data.map(item => item.totalCustomers) },
    { name: '新增会员', type: 'line', data: data.map(item => item.newMembers) },
  ],
});

// 挂账：新增 / 收回
export const generateMonthlyPendingOption = (data) => ({
  ...monthlyBase(data),
  tooltip: { trigger: 'axis', valueFormatter: (v) => formatCurrency(v) },
  series: [
    { name: '挂账新增', type: 'bar', data: data.map(item => Number(item.pendingAdded)) },
    { name: '挂账收回', type: 'bar', data: data.map(item => Number(item.pendingCleared)) },
  ],
});
