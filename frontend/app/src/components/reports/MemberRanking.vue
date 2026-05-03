<template>
  <div>
    <el-table :data="state.data" v-loading="state.loading" stripe style="width: 100%">
      <el-table-column type="index" label="排名" width="80" />
      <el-table-column prop="memberName" label="会员姓名">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.memberPhone"
            :content="`会员：${row.memberName} 手机号码：${row.memberPhone}`"
            placement="top"
          >
            <span>{{ row.memberName }}</span>
          </el-tooltip>
          <span v-else>{{ row.memberName }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="totalConsumption" label="消费总额(元)" align="right" sortable />
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
import { reactive, watch } from 'vue';
import { getMemberRanking } from '@/api/report.js';

const props = defineProps({
  dateRange: { type: Array, required: true }
});

const state = reactive({
  loading: false,
  loadingMore: false,
  data: [],
  page: 1,
  hasMore: false,
  total: 0
});

const fetchData = async (reset = true) => {
  if (reset) {
    state.loading = true;
    state.page = 1;
    state.data = [];
  }
  try {
    const params = {
      page: state.page,
      limit: 25,
      ...(props.dateRange && props.dateRange.length === 2 && {
        startDate: props.dateRange[0],
        endDate: props.dateRange[1]
      })
    };
    const response = await getMemberRanking(params);
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

watch(() => props.dateRange, reload, { immediate: true });

defineExpose({ reload });
</script>

<style scoped>
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
</style>
