<template>
  <div class="void-log-manager">
    <!-- 功能开关区域 -->
    <div class="config-section">
      <el-form :inline="true" class="config-form">
        <el-form-item label="开启交易撤销功能">
          <el-switch
            v-model="config.enableTransactionVoid"
            @change="handleSwitchChange"
            :loading="configLoading"
          />
        </el-form-item>
        <span class="config-hint">
          开启后，管理员可撤销7天内的交易并恢复余额
          <template v-if="config.enableTransactionVoid && remainingTime > 0">
            <el-tag type="warning" size="small" style="margin-left: 12px;">
              剩余 {{ formatRemainingTime(remainingTime) }} 后自动关闭
            </el-tag>
          </template>
        </span>
      </el-form>
    </div>

    <!-- 日期筛选区域（报表样式） -->
    <div class="filter-section">
      <el-form :inline="true" class="date-filter-form" @submit.prevent>
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
            <el-radio-button value="today">当日</el-radio-button>
            <el-radio-button value="this_week">当周</el-radio-button>
            <el-radio-button value="this_month">当月</el-radio-button>
            <el-radio-button value="all">全部</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button :icon="Refresh" @click="loadVoidLogs">刷新</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table :data="voidLogs" stripe v-loading="loading" style="width: 100%">
      <el-table-column label="撤销时间" width="170">
        <template #default="{ row }">
          <el-tooltip :content="formatFullDateTimeInAppTimeZone(row.voidedAt)" placement="top">
            <span class="time-cell">{{ formatShortDateInAppTimeZone(row.voidedAt) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="原交易时间" width="170">
        <template #default="{ row }">
          <el-tooltip :content="formatFullDateTimeInAppTimeZone(row.originalTxTime)" placement="top">
            <span class="time-cell">{{ formatShortDateInAppTimeZone(row.originalTxTime) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="memberName" label="会员" width="100">
        <template #default="{ row }">
          {{ row.memberName || '非会员' }}
        </template>
      </el-table-column>
      <el-table-column prop="summary" label="消费项目" min-width="150" show-overflow-tooltip />
      <el-table-column label="支付方式" width="100" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="getPaymentMethodType(row.paymentMethod)">
            {{ getPaymentMethodLabel(row.paymentMethod) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="原金额" width="100" align="right">
        <template #default="{ row }">
          <span class="amount">¥{{ row.actualPaidAmount }}</span>
        </template>
      </el-table-column>
      <el-table-column label="余额恢复" width="150">
        <template #default="{ row }">
          <div v-if="row.balanceRestored && row.balanceRestored.length > 0">
            <div v-for="(item, index) in row.balanceRestored" :key="index" class="balance-item">
              <template v-if="item.warning">
                <el-text type="warning" size="small">{{ item.warning }}</el-text>
              </template>
              <template v-else-if="item.action === 'CARD_DELETED'">
                <el-text type="danger" size="small">{{ item.message }}</el-text>
              </template>
              <template v-else-if="item.action === 'PENDING_RESTORED'">
                <el-text type="success" size="small">{{ item.message }}</el-text>
              </template>
              <template v-else-if="item.amountRestored">
                <span class="restored-amount">+¥{{ item.amountRestored }}</span>
              </template>
            </div>
          </div>
          <span v-else class="no-restore">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="voidedByName" label="操作人" width="100" />
      <el-table-column prop="reason" label="撤销原因" min-width="120" show-overflow-tooltip />
    </el-table>

    <div class="pagination-wrapper" v-if="pagination.total > 0">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <el-empty v-if="!loading && voidLogs.length === 0" description="暂无撤销记录" />

    <!-- 密码验证对话框 -->
    <el-dialog
      v-model="passwordDialog.visible"
      title="安全验证"
      width="400px"
      :close-on-click-modal="false"
      @close="handlePasswordDialogClose"
    >
      <el-alert type="warning" :closable="false" style="margin-bottom: 20px;">
        <template #title>
          <div>开启交易撤销功能需要进行安全验证</div>
        </template>
      </el-alert>

      <el-form :model="passwordDialog" label-width="80px">
        <el-form-item label="验证密码">
          <el-input
            v-model="passwordDialog.password"
            type="password"
            placeholder="请输入安全验证密码"
            show-password
            @keyup.enter="confirmEnableVoid"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="passwordDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="passwordDialog.loading"
          :disabled="!passwordDialog.password"
          @click="confirmEnableVoid"
        >
          确认开启
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getVoidLogs } from '@/api/voidLog.js';
import { getSystemConfig, updateSystemConfig } from '@/api/config.js';
import { formatShortDateInAppTimeZone, formatFullDateTimeInAppTimeZone } from '@/utils/date.js';

const loading = ref(false);
const configLoading = ref(false);
const voidLogs = ref([]);
const dateRange = ref([]);
const quickDate = ref('all');
const remainingTime = ref(0);
let countdownTimer = null;

const config = ref({
  enableTransactionVoid: false,
  voidEnabledAt: null,
});

const passwordDialog = reactive({
  visible: false,
  password: '',
  loading: false,
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const paymentMethodMap = {
  CASH: { label: '现金', type: 'success' },
  WECHAT_PAY: { label: '微信', type: 'primary' },
  ALIPAY: { label: '支付宝', type: 'primary' },
  DOUYIN: { label: '抖音', type: 'warning' },
  MEITUAN: { label: '美团', type: 'warning' },
  CARD_SWIPE: { label: '刷卡', type: 'info' },
  MEMBER_CARD: { label: '会员卡', type: 'danger' },
  OTHER: { label: '其他', type: 'info' },
};

const getPaymentMethodLabel = (method) => paymentMethodMap[method]?.label || method;
const getPaymentMethodType = (method) => paymentMethodMap[method]?.type || 'info';

// 格式化剩余时间
const formatRemainingTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 计算剩余时间
const calculateRemainingTime = () => {
  if (!config.value.voidEnabledAt || !config.value.enableTransactionVoid) {
    return 0;
  }
  const enabledTime = new Date(config.value.voidEnabledAt).getTime();
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  const remaining = Math.max(0, Math.floor((enabledTime + tenMinutes - now) / 1000));
  return remaining;
};

// 启动倒计时
const startCountdown = () => {
  stopCountdown();
  remainingTime.value = calculateRemainingTime();

  if (remainingTime.value > 0) {
    countdownTimer = setInterval(() => {
      remainingTime.value = calculateRemainingTime();
      if (remainingTime.value <= 0) {
        stopCountdown();
        // 自动刷新配置
        loadConfig();
      }
    }, 1000);
  }
};

// 停止倒计时
const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

// 加载配置
const loadConfig = async () => {
  try {
    config.value = await getSystemConfig();
    if (config.value.enableTransactionVoid && config.value.voidEnabledAt) {
      startCountdown();
    } else {
      stopCountdown();
      remainingTime.value = 0;
    }
  } catch (e) {
    console.error('获取系统配置失败:', e);
  }
};

const loadVoidLogs = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    const res = await getVoidLogs(params);
    voidLogs.value = res.data;
    pagination.total = res.pagination.total;
  } finally {
    loading.value = false;
  }
};

const handleDateChange = () => {
  quickDate.value = '';
  pagination.page = 1;
  loadVoidLogs();
};

const handleQuickDateChange = (value) => {
  const today = new Date();
  let start, end;

  if (value === 'all') {
    dateRange.value = [];
    pagination.page = 1;
    loadVoidLogs();
    return;
  }

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
  pagination.page = 1;
  loadVoidLogs();
};

const handleSizeChange = () => {
  pagination.page = 1;
  loadVoidLogs();
};

const handlePageChange = () => {
  loadVoidLogs();
};

// 处理开关变化
const handleSwitchChange = async (value) => {
  if (value) {
    // 开启时需要密码验证
    config.value.enableTransactionVoid = false; // 先恢复开关状态
    passwordDialog.password = '';
    passwordDialog.visible = true;
  } else {
    // 关闭不需要验证
    configLoading.value = true;
    try {
      await updateSystemConfig({
        enableTransactionVoid: false,
      });
      config.value.enableTransactionVoid = false;
      config.value.voidEnabledAt = null;
      stopCountdown();
      remainingTime.value = 0;
      ElMessage.success('交易撤销功能已关闭');
    } catch {
      config.value.enableTransactionVoid = true;
    } finally {
      configLoading.value = false;
    }
  }
};

// 密码对话框关闭时
const handlePasswordDialogClose = () => {
  passwordDialog.password = '';
};

// 确认开启撤销功能
const confirmEnableVoid = async () => {
  if (!passwordDialog.password) {
    ElMessage.warning('请输入验证密码');
    return;
  }

  passwordDialog.loading = true;
  try {
    const result = await updateSystemConfig({
      enableTransactionVoid: true,
      password: passwordDialog.password,
    });
    config.value.enableTransactionVoid = true;
    config.value.voidEnabledAt = result.voidEnabledAt;
    passwordDialog.visible = false;
    startCountdown();
    ElMessage.success('交易撤销功能已开启，10分钟后将自动关闭');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '开启失败');
  } finally {
    passwordDialog.loading = false;
  }
};

onMounted(async () => {
  await loadConfig();
  loadVoidLogs();
});

onUnmounted(() => {
  stopCountdown();
});
</script>

<style scoped>
.void-log-manager {
  padding-top: 10px;
}

.config-section {
  padding: 16px 20px;
  background-color: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.config-form {
  display: flex;
  align-items: center;
  margin-bottom: 0;
}

.config-form .el-form-item {
  margin-bottom: 0;
  margin-right: 0;
}

.config-hint {
  color: #909399;
  font-size: 12px;
  margin-left: 12px;
  display: flex;
  align-items: center;
}

.filter-section {
  padding: 15px 20px;
  background-color: #fafafa;
  border-radius: 6px;
  margin-bottom: 20px;
}

.date-filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.date-filter-form .el-form-item {
  display: flex;
  align-items: center;
  margin-bottom: 0;
}

.amount {
  font-weight: 500;
  color: #f56c6c;
}

.balance-item {
  font-size: 12px;
  line-height: 1.5;
}

.restored-amount {
  color: #67c23a;
  font-weight: 500;
}

.no-restore {
  color: #909399;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.time-cell {
  cursor: help;
}
</style>
