<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">统计报表</h2>
    </div>

    <!-- 全局日期筛选器 -->
    <div class="global-filter-container">
      <el-form :inline="true" class="date-filter-form">
        <el-form-item label="选择日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="quickDate" @change="handleQuickDateChange">
            <el-radio-button value="today">今日</el-radio-button>
            <el-radio-button value="this_week">本周</el-radio-button>
            <el-radio-button value="this_month">本月</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <el-tabs v-model="activeTab" class="report-tabs">
      <!-- 营业概览 -->
      <el-tab-pane label="营业概览" name="business">
        <el-row :gutter="20" v-loading="businessReport.loading" class="stats-cards">
          <el-col :span="6" :xs="12">
            <el-statistic title="总收入 (元)" :value="businessReport.data.totalRevenue" />
          </el-col>
          <el-col :span="6" :xs="12">
            <el-statistic title="卡耗 (元)" :value="businessReport.data.cardConsumption" />
          </el-col>
          <el-col :span="6" :xs="12">
            <el-statistic title="总客数" :value="businessReport.data.totalCustomers" />
          </el-col>
          <el-col :span="6" :xs="12">
            <el-statistic title="客单价 (元)" :value="businessReport.data.averageOrderValue" />
          </el-col>
        </el-row>
        <div class="transaction-list-container">
          <h3 class="section-title">消费流水</h3>
          <el-table :data="transactionList.data" v-loading="transactionList.loading" stripe max-height="500">
            <el-table-column prop="transactionTime" label="时间" width="180">
              <template #default="{ row }">{{ formatInAppTimeZone(row.transactionTime) }}</template>
            </el-table-column>
            <el-table-column label="姓名">
              <template #default="{ row }">{{ row.member?.name || '非会员用户' }}</template>
            </el-table-column>
            <el-table-column label="服务项目">
              <template #default="{ row }">{{ row.summary || row.items.map(item => item.service.name).join(', ') }}</template>
            </el-table-column>
            <el-table-column prop="staff.name" label="服务员工" />
            <el-table-column prop="actualPaidAmount" label="实付金额(元)" align="right" />
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 支付方式构成 -->
      <el-tab-pane label="支付统计" name="paymentSummary">
        <div v-loading="paymentSummary.loading" class="chart-table-layout">
          <div class="chart-container">
            <v-chart v-if="paymentSummary.chartOption" :option="paymentSummary.chartOption" autoresize />
            <el-empty v-else description="暂无数据" />
          </div>
          <div class="table-container">
            <el-table :data="paymentSummary.data" stripe>
              <el-table-column prop="name" label="支付方式" />
              <el-table-column prop="value" label="金额 (元)" align="right" />
              <el-table-column prop="count" label="笔数" align="center" />
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <!-- 会员卡销售排行 -->
      <el-tab-pane label="会员卡统计" name="cardSalesSummary">
        <div v-loading="cardSalesSummary.loading" class="chart-table-layout">
          <div class="chart-container">
            <v-chart v-if="cardSalesSummary.chartOption" :option="cardSalesSummary.chartOption" autoresize />
            <el-empty v-else description="暂无数据" />
          </div>
          <div class="table-container">
            <el-table :data="cardSalesSummary.data" stripe>
              <el-table-column prop="name" label="卡类型" />
              <el-table-column prop="value" label="销售额 (元)" align="right" sortable />
              <el-table-column prop="count" label="销售张数" align="center" sortable />
            </el-table>
          </div>
        </div>
      </el-tab-pane>
      
      <!-- 项目消费排行 -->
      <el-tab-pane label="项目消费排行" name="serviceRanking">
         <el-table :data="serviceRanking.data" v-loading="serviceRanking.loading" stripe>
           <el-table-column type="index" label="排名" width="80" />
           <el-table-column prop="serviceName" label="项目名称" />
           <el-table-column prop="totalSales" label="销售总额(元)" align="right" sortable />
           <el-table-column prop="totalCount" label="销售数量" align="center" sortable />
         </el-table>
      </el-tab-pane>

      <!-- 会员消费排行 -->
      <el-tab-pane label="会员消费排行" name="memberRanking">
        <el-table :data="memberRanking.data" v-loading="memberRanking.loading" stripe max-height="600">
           <el-table-column type="index" label="排名" width="80" />
           <el-table-column prop="memberName" label="会员姓名" />
           <el-table-column prop="memberPhone" label="手机号" />
           <el-table-column prop="totalConsumption" label="消费总额(元)" align="right" sortable />
        </el-table>
      </el-tab-pane>

      <!-- 生日提醒 -->
      <el-tab-pane name="birthdayReminders">
        <template #label>
          <el-badge 
            :value="systemStore.upcomingBirthdayCount" 
            :hidden="systemStore.upcomingBirthdayCount === 0" 
            type="warning"
          >
            生日提醒
          </el-badge>
        </template>
        <div class="tip">未来15天内过生日的会员</div>
        <el-table :data="birthdayReminders.data" v-loading="birthdayReminders.loading" stripe max-height="600">
           <el-table-column prop="name" label="姓名" />
           <el-table-column prop="phone" label="手机号" />
           <el-table-column prop="birthday" label="生日日期">
              <template #default="{ row }">{{ new Date(row.birthday).toLocaleDateString([], { month: '2-digit', day: '2-digit' }) }}</template>
           </el-table-column>
           <el-table-column prop="status" label="会员状态">
             <template #default="{ row }">
                <el-tag :type="memberStatusTagType(row.status)">{{ memberStatusText(row.status) }}</el-tag>
             </template>
           </el-table-column>    
                  <!-- 核心修改：新增两列表格 -->

<el-table-column label="累计消费 (元)" align="right">
  <template #default="{ row }">
    <span>
      <strong>{{ Number(row.totalConsumption).toFixed(2) }} 元</strong>

      <div
        v-if="typeof row.rank === 'number'"
        style="color: #909399; font-size: 12px; margin-left: 6px;"
      >
        * 排行：{{ row.rank }}
      </div>

    </span>
  </template>
</el-table-column>






        </el-table>
      </el-tab-pane>
        
      <!-- 沉睡会员 -->
      <el-tab-pane label="沉睡会员" name="sleepingMembers">
        <div class="tip">超过90天未产生任何消费的活跃会员</div>
        <el-table :data="sleepingMembers.data" v-loading="sleepingMembers.loading" stripe max-height="600">
           <el-table-column prop="name" label="姓名" />
           <el-table-column prop="phone" label="手机号" />
           <el-table-column prop="registrationDate" label="注册日期">
              <template #default="{ row }">{{ formatDateInAppTimeZone(row.registrationDate) }}</template>
           </el-table-column>
           <el-table-column prop="lastVisitDate" label="最后消费日期">
             <template #default="{ row }">
                <span v-if="row.lastVisitDate">{{ formatDateInAppTimeZone(row.lastVisitDate) }}</span>
                <span v-else>无消费记录</span>
             </template>
           </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { getBusinessReport, getServiceRanking, getSleepingMembers, getMemberRanking, getBirthdayReminders, getPaymentSummary, getCardSalesSummary } from '@/api/report.js';
import { getTransactionsByDateRange } from '@/api/transaction.js';
import { useSystemStore } from '@/stores/system';
import { formatInAppTimeZone, formatDateInAppTimeZone } from '@/utils/date.js';
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';

use([
  CanvasRenderer,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
]);

const activeTab = ref('business');
const systemStore = useSystemStore();

const dateRange = ref([]);
const quickDate = ref('today');

// --- 报表数据状态 ---
const businessReport = reactive({
  loading: false,
  data: { totalRevenue: 0, cardConsumption: 0, totalCustomers: 0, averageOrderValue: 0 },
});
const transactionList = reactive({
  loading: false,
  data: [],
});
const paymentSummary = reactive({
  loading: false,
  data: [],
  chartOption: null,
});
const cardSalesSummary = reactive({
  loading: false,
  data: [],
  chartOption: null,
});
const serviceRanking = reactive({ loading: false, data: [] });
const memberRanking = reactive({ loading: false, data: [] });
const birthdayReminders = reactive({ loading: false, data: [] });
const sleepingMembers = reactive({ loading: false, data: [] });

// --- 数据获取函数 ---
const fetchBusinessData = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
  businessReport.loading = true;
  transactionList.loading = true;
  try {
    const [reportData, transactionsData] = await Promise.all([
      getBusinessReport(params),
      getTransactionsByDateRange(params)
    ]);
    businessReport.data = reportData;
    transactionList.data = transactionsData;
  } finally {
    businessReport.loading = false;
    transactionList.loading = false;
  }
};

const generatePieOption = (title, data) => ({
  title: { text: title, left: 'center', top: '5%' },
  tooltip: { trigger: 'item', formatter: '{b} : ¥{c} ({d}%)' },
  legend: { top: 'bottom', left: 'center' },
  series: [{
    name: '金额',
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: false,
    itemStyle: {
      borderRadius: 10,
      borderColor: '#fff',
      borderWidth: 2
    },
    label: { show: false, position: 'center' },
    emphasis: {
      label: { show: true, fontSize: 20, fontWeight: 'bold' }
    },
    labelLine: { show: false },
    data: data.map(item => ({ value: item.value, name: item.name })),
  }],
});

const fetchPaymentSummary = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  paymentSummary.loading = true;
  paymentSummary.chartOption = null;
  try {
    const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
    const data = await getPaymentSummary(params);
    paymentSummary.data = data;
    if (data.length > 0) {
      paymentSummary.chartOption = generatePieOption('支付方式构成', data);
    }
  } finally {
    paymentSummary.loading = false;
  }
};

const fetchCardSalesSummary = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  cardSalesSummary.loading = true;
  cardSalesSummary.chartOption = null;
  try {
    const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
    const data = await getCardSalesSummary(params);
    cardSalesSummary.data = data;
    if (data.length > 0) {
      cardSalesSummary.chartOption = generatePieOption('会员卡销售统计', data);
    }
  } finally {
    cardSalesSummary.loading = false;
  }
};

const fetchServiceRanking = async () => {
  serviceRanking.loading = true;
  try {
    serviceRanking.data = await getServiceRanking();
  } finally {
    serviceRanking.loading = false;
  }
};

const fetchMemberRanking = async () => {
  memberRanking.loading = true;
  try {
    memberRanking.data = await getMemberRanking();
  } finally {
    memberRanking.loading = false;
  }
};

const fetchBirthdayReminders = async () => {
  birthdayReminders.loading = true;
  try {
    birthdayReminders.data = await getBirthdayReminders();
  } finally {
    birthdayReminders.loading = false;
  }
};

const fetchSleepingMembers = async () => {
  sleepingMembers.loading = true;
  try {
    sleepingMembers.data = await getSleepingMembers();
  } finally {
    sleepingMembers.loading = false;
  }
};

// --- 日期控制 ---
const handleDateChange = () => {
    quickDate.value = ''; 
    reloadCurrentTabData();
};

const handleQuickDateChange = (value) => {
  const today = new Date();
  let start, end;
  switch (value) {
    case 'today':
      start = today; end = today; break;
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
      start = new Date(today.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
  }
  const formatDate = (d) => d.toISOString().split('T')[0];
  dateRange.value = [formatDate(start), formatDate(end)];
  reloadCurrentTabData();
};

const reloadCurrentTabData = () => {
  // 根据当前激活的Tab，调用对应的加载函数
  const tabLoadFunctions = {
    business: fetchBusinessData,
    paymentSummary: fetchPaymentSummary,
    cardSalesSummary: fetchCardSalesSummary,
  };
  const loadFunc = tabLoadFunctions[activeTab.value];
  if (loadFunc) {
    loadFunc();
  }
};

onMounted(() => {
  handleQuickDateChange('today');
});

watch(activeTab, (newTab) => {
  const dataStores = {
    business: transactionList,
    paymentSummary,
    cardSalesSummary,
    serviceRanking,
    memberRanking,
    birthdayReminders,
    sleepingMembers
  };
  const dataStore = dataStores[newTab];

  // 切换Tab时，如果它依赖日期，就重新加载数据；如果它不依赖日期且未加载过，也加载数据
  if (['business', 'paymentSummary', 'cardSalesSummary'].includes(newTab)) {
    reloadCurrentTabData();
  } else if (dataStore && (!dataStore.data || dataStore.data.length === 0)) {
    const tabLoadFunctions = {
      serviceRanking: fetchServiceRanking,
      memberRanking: fetchMemberRanking,
      birthdayReminders: fetchBirthdayReminders,
      sleepingMembers: fetchSleepingMembers,
    };
    const loadFunc = tabLoadFunctions[newTab];
    if (loadFunc) {
      loadFunc();
    }
  }
});
</script>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.global-filter-container {
  padding: 15px 20px;
  background-color: #fafafa;
  border-radius: 6px;
  margin-bottom: 0px; /* 调整间距 */
}
.report-tabs { flex-grow: 1; display: flex; flex-direction: column; }
.report-tabs :deep(.el-tabs__content) { flex-grow: 1; overflow-y: auto; padding-top: 20px;}
.stats-cards { padding: 20px; background-color: #fafafa; border-radius: 6px; }
.el-statistic { text-align: center; }
.tip { color: #909399; font-size: 14px; margin-bottom: 15px; }
.date-filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
.date-filter-form .el-form-item {
  display: flex;
  align-items: center;
  margin-bottom: 0;
}
.transaction-list-container {
    margin-top: 30px;
}
.section-title {
    font-size: 18px;
    color: #303133;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e4e7ed;
}
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