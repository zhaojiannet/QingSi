<template>
  <div>
    <div class="tip">超过90天未产生任何消费的活跃会员</div>
    <el-table :data="state.data" v-loading="state.loading" stripe show-overflow-tooltip style="width: 100%">
      <el-table-column prop="name" label="姓名">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.phone"
            :content="`会员：${row.name} 手机号码：${row.phone}`"
            placement="top"
          >
            <span>{{ row.name }}</span>
          </el-tooltip>
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="registrationDate" label="注册日期">
        <template #default="{ row }">{{ formatDateInAppTimeZone(row.registrationDate) }}</template>
      </el-table-column>
      <el-table-column prop="lastVisitDate" label="最后消费日期">
        <template #default="{ row }">
          <span v-if="isValidDate(row.lastVisitDate)">{{ formatDateInAppTimeZone(row.lastVisitDate) }}</span>
          <span v-else class="text-muted">无消费记录</span>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination-section" v-if="state.data.length > 0">
      <div class="load-more-container">
        <el-button
          v-if="state.hasMore"
          @click="loadMore"
          :loading="state.loadingMore"
          type="primary"
          size="small"
          style="padding: 12px 24px; border-radius: 6px;"
        >
          {{ state.loadingMore ? '加载中...' : `加载更多 (已显示 ${state.data.length}/${state.total || state.data.length} 条)` }}
        </el-button>
        <div v-else class="all-loaded">已加载全部数据</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { getSleepingMembers } from '@/api/report.js';
import { formatDateInAppTimeZone } from '@/utils/date.js';

const state = reactive({
  loading: false,
  loadingMore: false,
  data: [],
  page: 1,
  hasMore: false,
  total: 0
});

const isValidDate = (date) => {
  return date && date !== null && date !== '' && date !== 'null' && date !== 'undefined' && !isNaN(new Date(date).getTime());
};

const fetchData = async (reset = true) => {
  if (reset) {
    state.loading = true;
    state.page = 1;
    state.data = [];
  }
  try {
    const params = { page: state.page, limit: 25 };
    const response = await getSleepingMembers(params);
    if (reset) {
      state.data = response.data || [];
    } else {
      state.data.push(...(response.data || []));
    }
    state.hasMore = response.pagination?.hasMore || false;
    state.total = response.pagination?.total || state.data.length;
  } finally {
    state.loading = false;
  }
};

const loadMore = async () => {
  if (state.loadingMore || !state.hasMore) return;
  state.loadingMore = true;
  state.page++;
  try {
    await fetchData(false);
  } finally {
    state.loadingMore = false;
  }
};

const reload = () => fetchData(true);

onMounted(reload);

defineExpose({ reload });
</script>

<style scoped>
.tip {
  color: #909399;
  font-size: 14px;
  margin-bottom: 15px;
}
.pagination-section {
  padding: 20px;
  text-align: center;
  border-top: 1px solid #e4e7ed;
  background-color: #fafafa;
}
.load-more-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
.all-loaded {
  color: #909399;
  font-size: 14px;
  padding: 10px 0;
}
.text-muted {
  color: #909399;
}
</style>
