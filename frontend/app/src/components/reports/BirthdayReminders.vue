<template>
  <div>
    <div class="tip">未来15天内过生日的会员</div>
    <el-table :data="state.data" v-loading="state.loading" stripe max-height="600">
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
      <el-table-column prop="birthday" label="生日日期">
        <template #default="{ row }">{{ new Date(row.birthday).toLocaleDateString([], { month: '2-digit', day: '2-digit' }) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="会员状态">
        <template #default="{ row }">
          <el-tag :type="memberStatusTagType(row.status)">{{ memberStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
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
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { getBirthdayReminders } from '@/api/report.js';
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';

const state = reactive({ loading: false, data: [] });

const reload = async () => {
  state.loading = true;
  try {
    state.data = await getBirthdayReminders();
  } finally {
    state.loading = false;
  }
};

onMounted(reload);

defineExpose({ reload });
</script>

<style scoped>
.tip {
  color: #909399;
  font-size: 14px;
  margin-bottom: 15px;
}
</style>
