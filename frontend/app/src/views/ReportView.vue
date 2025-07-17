<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">统计报表</h2>
    </div>

    <el-tabs v-model="activeTab" class="report-tabs">
      <!-- 核心营业报表 -->
      <el-tab-pane label="核心营业报表" name="business">
        <div class="filter-container">
          <!-- 核心改动1：在 el-form-item 上直接应用 flex 布局 -->
          <el-form :inline="true" :model="filters" class="date-filter-form">
            <el-form-item label="选择日期">
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                @change="fetchBusinessReport"
              />
            </el-form-item>
            <el-form-item>
              <el-radio-group v-model="quickDate" @change="handleQuickDateChange">
                <el-radio-button label="today">今日</el-radio-button>
                <el-radio-button label="this_week">本周</el-radio-button>
                <el-radio-button label="this_month">本月</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </div>
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
      </el-tab-pane>


      <!-- 项目销售排行 -->
      <el-tab-pane label="项目销售排行" name="serviceRanking">
         <el-table :data="serviceRanking.data" v-loading="serviceRanking.loading" stripe>
           <el-table-column type="index" label="排名" width="80" />
           <el-table-column prop="serviceName" label="项目名称" />
           <el-table-column prop="totalSales" label="销售总额(元)" align="right" sortable />
           <el-table-column prop="totalCount" label="销售数量" align="center" sortable />
         </el-table>
      </el-tab-pane>

      <el-tab-pane label="沉睡会员" name="sleepingMembers">
        <div class="tip">超过90天未产生任何消费的活跃会员</div>
        <el-table :data="sleepingMembers.data" v-loading="sleepingMembers.loading" stripe max-height="600">
           <el-table-column prop="name" label="姓名" />
           <el-table-column prop="phone" label="手机号" />
           <el-table-column prop="registrationDate" label="注册日期">
              <template #default="{ row }">{{ new Date(row.registrationDate).toLocaleDateString() }}</template>
           </el-table-column>
           <el-table-column prop="lastVisitDate" label="最后消费日期">
             <template #default="{ row }">
                <span v-if="row.lastVisitDate">{{ new Date(row.lastVisitDate).toLocaleDateString() }}</span>
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
import { getBusinessReport, getServiceRanking, getSleepingMembers } from '@/api/report.js';

const activeTab = ref('business');

// --- 营业报表 ---
const dateRange = ref([]);
const quickDate = ref('this_month'); // 核心改动2：新增状态，用于高亮快捷按钮
const businessReport = reactive({
  loading: false,
  data: {
    totalRevenue: 0,
    cardConsumption: 0,
    totalCustomers: 0,
    averageOrderValue: 0,
  },
});

const fetchBusinessReport = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) {
      // 当手动清除日期时，quickDate也应清空
      quickDate.value = ''; 
      return;
  };
  businessReport.loading = true;
  try {
    const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
    const res = await getBusinessReport(params);
    businessReport.data = res;
  } finally {
    businessReport.loading = false;
  }
};

// 核心改动3：新增快捷日期切换函数
const handleQuickDateChange = (value) => {
  const today = new Date();
  let start, end;
  
  switch (value) {
    case 'today':
      start = today;
      end = today;
      break;
    case 'this_week': {
      // 周一为一周的开始
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
  
  // 主动调用 fetchBusinessReport
  fetchBusinessReport();
};


// --- 项目排行 ---
const serviceRanking = reactive({
  loading: false,
  data: [],
});
const fetchServiceRanking = async () => {
  serviceRanking.loading = true;
  try {
    serviceRanking.data = await getServiceRanking();
  } finally {
    serviceRanking.loading = false;
  }
};

// --- 沉睡会员 ---
const sleepingMembers = reactive({
  loading: false,
  data: [],
});
const fetchSleepingMembers = async () => {
  sleepingMembers.loading = true;
  try {
    sleepingMembers.data = await getSleepingMembers();
  } finally {
    sleepingMembers.loading = false;
  }
};

// --- 初始化和Tab切换 ---
onMounted(() => {
  // 初始化日期范围为本月
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const formatDate = (d) => d.toISOString().split('T')[0];
  dateRange.value = [formatDate(startOfMonth), formatDate(endOfMonth)];
  
  fetchBusinessReport(); // 默认加载第一个报表
});

// 监听Tab切换，按需加载数据
watch(activeTab, (newTab) => {
  if (newTab === 'serviceRanking' && serviceRanking.data.length === 0) {
    fetchServiceRanking();
  } else if (newTab === 'sleepingMembers' && sleepingMembers.data.length === 0) {
    fetchSleepingMembers();
  }
});
</script>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.report-tabs { flex-grow: 1; display: flex; flex-direction: column; }
.report-tabs :deep(.el-tabs__content) { flex-grow: 1; overflow-y: auto; }
.filter-container { margin-bottom: 20px; }
.stats-cards { padding: 20px; background-color: #fafafa; border-radius: 6px; }
.el-statistic { text-align: center; }
.tip { color: #909399; font-size: 14px; margin-bottom: 15px; }
/* --- 核心改动2：全新的样式方案 --- */
.date-filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

/* 
  让 el-form-item 自身也成为一个 flex 容器，
  并让其内部的 label 和内容（日期选择框）垂直居中对齐。
  这是解决对齐问题的关键。
*/
.date-filter-form .el-form-item {
  display: flex;
  align-items: center;
  margin-bottom: 0; /* 移除 inline 表单的默认下边距 */
}
</style>