<template>
  <div>
    <div class="tip">会员挂账明细统计</div>
    <div class="pending-summary">
      <el-row :gutter="20" v-loading="state.loading" class="stats-cards">
        <el-col :span="6" :xs="12">
          <el-statistic title="总挂账金额 (元)" :value="state.summary.totalAmount" />
        </el-col>
        <el-col :span="6" :xs="12">
          <el-statistic title="挂账会员数" :value="state.summary.memberCount" />
        </el-col>
        <el-col :span="6" :xs="12">
          <el-statistic title="挂账记录数" :value="state.summary.recordCount" />
        </el-col>
        <el-col :span="6" :xs="12">
          <el-statistic title="平均挂账金额 (元)" :value="state.summary.averageAmount" />
        </el-col>
      </el-row>
    </div>

    <el-table :data="state.data" v-loading="state.loading" stripe style="width: 100%">
      <el-table-column prop="name" label="会员姓名" width="120">
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
      <el-table-column label="挂账总额" width="120" align="right">
        <template #default="{ row }">
          <span class="pending-amount">{{ formatCurrency(row.totalPending) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="记录数" width="80" align="center">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.recordCount }}条</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="200">
        <template #default="{ row }">
          <div class="notes-list">
            <div v-for="(payment, index) in row.payments.slice(0, 2)" :key="payment.id" class="note-item">
              <span v-if="payment.description" class="note-desc">{{ payment.description }}</span>
              <span v-else class="no-desc">-</span>
            </div>
            <div v-if="row.payments.length > 2" class="more-notes">
              ...还有 {{ row.payments.length - 2 }} 条
            </div>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="state.hasMore" class="load-more-container" style="margin-top: 20px;">
      <el-button
        @click="loadMore"
        :loading="state.loadingMore"
        type="primary"
        size="small"
        style="padding: 12px 24px; border-radius: 6px;"
      >
        {{ state.loadingMore ? '加载中...' : `加载更多 (已显示 ${state.data.length}/${state.total} 条)` }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { getPendingStats } from '@/api/report.js';
import { formatCurrency } from '@/utils/currency.js';

const state = reactive({
  loading: false,
  loadingMore: false,
  data: [],
  page: 1,
  hasMore: false,
  total: 0,
  summary: { totalAmount: 0, memberCount: 0, recordCount: 0, averageAmount: 0 }
});

const fetchData = async (reset = true) => {
  if (reset) {
    state.loading = true;
    state.page = 1;
    state.data = [];
  } else {
    state.loadingMore = true;
  }
  try {
    const params = { page: state.page, limit: 25 };
    const response = await getPendingStats(params);
    if (reset) {
      state.data = response.data || [];
      state.summary = response.summary || { totalAmount: 0, memberCount: 0, recordCount: 0, averageAmount: 0 };
    } else {
      state.data.push(...(response.data || []));
    }
    state.total = response.total || 0;
    state.hasMore = response.hasMore || false;
  } catch {
    if (reset) {
      state.data = [];
      state.summary = { totalAmount: 0, memberCount: 0, recordCount: 0, averageAmount: 0 };
    }
  } finally {
    state.loading = false;
    state.loadingMore = false;
  }
};

const loadMore = async () => {
  if (state.loadingMore || !state.hasMore) return;
  state.page++;
  await fetchData(false);
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
.stats-cards {
  padding: 20px;
  background-color: #fafafa;
  border-radius: 6px;
}
.pending-summary {
  margin-bottom: 20px;
}
.pending-amount {
  font-weight: bold;
  color: #f56c6c;
}
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.note-item {
  font-size: 12px;
  line-height: 1.2;
}
.note-desc {
  color: #606266;
}
.no-desc {
  color: #C0C4CC;
  font-style: italic;
}
.more-notes {
  color: #909399;
  font-size: 11px;
  font-style: italic;
  margin-top: 2px;
}
.load-more-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
