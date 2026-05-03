<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">统计报表</h2>
    </div>

    <!-- 全局日期筛选器 -->
    <div class="global-filter-container" v-show="isDateFilterRequired">
      <el-form :inline="true" class="date-filter-form" @submit.prevent>
        <el-form-item label="选择日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            popper-class="report-date-popper"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="quickDate" @change="handleQuickDateChange">
            <el-radio-button value="today">当日</el-radio-button>
            <el-radio-button value="this_week">当周</el-radio-button>
            <el-radio-button value="this_month">当月</el-radio-button>
            <el-radio-button value="this_quarter">当季</el-radio-button>
            <el-radio-button value="this_year">当年</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <el-tabs v-model="activeTab" class="report-tabs">
      <el-tab-pane label="营业概览" name="business">
        <BusinessOverview
          ref="businessRef"
          :date-range="dateRange"
          :can-show-void-button="canShowVoidButton"
          @void="openVoidDialog"
        />
      </el-tab-pane>

      <el-tab-pane label="支付统计" name="paymentSummary" lazy>
        <PaymentSummary :date-range="dateRange" />
      </el-tab-pane>

      <el-tab-pane label="会员卡统计" name="cardSalesSummary" lazy>
        <CardSalesSummary :date-range="dateRange" />
      </el-tab-pane>

      <el-tab-pane label="项目消费排行" name="serviceRanking" lazy>
        <ServiceRanking :date-range="dateRange" />
      </el-tab-pane>

      <el-tab-pane label="会员消费排行" name="memberRanking" lazy>
        <MemberRanking :date-range="dateRange" />
      </el-tab-pane>

      <el-tab-pane name="birthdayReminders" lazy>
        <template #label>
          <el-badge
            :value="systemStore.upcomingBirthdayCount"
            :hidden="systemStore.upcomingBirthdayCount === 0"
            type="warning"
          >
            生日提醒
          </el-badge>
        </template>
        <BirthdayReminders />
      </el-tab-pane>

      <el-tab-pane label="挂账统计" name="pendingStats" lazy>
        <PendingStatsTab />
      </el-tab-pane>

      <el-tab-pane label="沉睡会员" name="sleepingMembers" lazy>
        <SleepingMembers />
      </el-tab-pane>
    </el-tabs>

    <!-- 撤销确认对话框 -->
    <el-dialog
      v-model="voidDialog.visible"
      title="确认撤销交易"
      width="450px"
      :close-on-click-modal="false"
    >
      <div v-if="voidDialog.transaction" class="void-info">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="交易时间">
            {{ formatShortDateInAppTimeZone(voidDialog.transaction.transactionTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="会员">
            {{ voidDialog.transaction.member?.name || voidDialog.transaction.customerName || '非会员' }}
          </el-descriptions-item>
          <el-descriptions-item label="消费项目">
            {{ voidDialog.transaction.summary || formatVoidServiceItems(voidDialog.transaction.items) || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="支付金额">
            <span class="amount">¥{{ voidDialog.transaction.actualPaidAmount }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="voidDialog.transaction.member && voidDialog.transaction.paymentMethod === PAYMENT_METHODS.MEMBER_CARD"
          type="warning"
          :closable="false"
          show-icon
          style="margin-top: 16px;"
        >
          撤销后，会员卡余额将恢复扣除金额
        </el-alert>

        <el-form :model="voidDialog" label-width="100px" style="margin-top: 16px;">
          <el-form-item label="撤销原因" required>
            <el-input
              v-model="voidDialog.reason"
              type="textarea"
              :rows="2"
              placeholder="请输入撤销原因（必填）"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="voidDialog.visible = false">取消</el-button>
        <el-button
          type="danger"
          :loading="voidDialog.loading"
          @click="handleConfirmVoid"
          :disabled="!voidDialog.reason?.trim()"
        >
          确认撤销
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import { getSystemConfig } from '@/api/config.js';
import { useSystemStore } from '@/stores/system';
import { useUserStore } from '@/stores/user';
import { formatShortDateInAppTimeZone } from '@/utils/date.js';
import { useReportDateRange } from '@/composables/useReportDateRange.js';
import { useVoidTransaction } from '@/composables/useVoidTransaction.js';
import { useTransactionFormatters } from '@/composables/useTransactionFormatters.js';
import { PAYMENT_METHODS } from '@/constants/payment.js';
import BusinessOverview from '@/components/reports/BusinessOverview.vue';
import PaymentSummary from '@/components/reports/PaymentSummary.vue';
import CardSalesSummary from '@/components/reports/CardSalesSummary.vue';
import ServiceRanking from '@/components/reports/ServiceRanking.vue';
import MemberRanking from '@/components/reports/MemberRanking.vue';
import BirthdayReminders from '@/components/reports/BirthdayReminders.vue';
import PendingStatsTab from '@/components/reports/PendingStatsTab.vue';
import SleepingMembers from '@/components/reports/SleepingMembers.vue';

const systemStore = useSystemStore();
const userStore = useUserStore();

// --- 日期范围（全局状态） ---
const { dateRange, quickDate, applyQuickDate } = useReportDateRange();

// --- Tab 控制 ---
const activeTab = ref('business');
const dateFilterTabs = ['business', 'paymentSummary', 'cardSalesSummary', 'serviceRanking', 'memberRanking'];
const isDateFilterRequired = computed(() => dateFilterTabs.includes(activeTab.value));

// --- 撤销权限 ---
const systemConfig = ref({ enableTransactionVoid: false });

const canShowVoidButton = computed(() => {
  return systemConfig.value?.enableTransactionVoid && ['ADMIN', 'MANAGER'].includes(userStore.userRole);
});

// --- 撤销对话框 ---
const { voidDialog, openVoidDialog, confirmVoid } = useVoidTransaction();
const businessRef = useTemplateRef('businessRef');

const handleConfirmVoid = () => {
  confirmVoid(() => {
    // 撤销成功后刷新交易列表
    businessRef.value?.refreshTransactions?.();
  });
};

const { formatServiceItems: formatVoidServiceItems } = useTransactionFormatters();

// --- 日期切换 ---
const handleDateChange = () => {
  quickDate.value = '';
};

const handleQuickDateChange = (value) => {
  applyQuickDate(value);
};

onMounted(async () => {
  try {
    systemConfig.value = await getSystemConfig();
  } catch (e) {
    console.error('获取系统配置失败:', e);
  }
  applyQuickDate('today');
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
  margin-bottom: 0px;
}

.report-tabs {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.report-tabs :deep(.el-tabs__content) {
  flex-grow: 1;
  overflow-y: auto;
  padding-top: 20px;
}
.report-tabs :deep(th .cell) { white-space: nowrap; }
.report-tabs :deep(td .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

.void-info .amount {
  font-weight: bold;
  color: #f56c6c;
}

@media (max-width: 768px) {
  .global-filter-container {
    padding: 10px 12px;
    overflow: hidden;
  }
  .date-filter-form {
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  .date-filter-form :deep(.el-form-item) {
    width: 100% !important;
    margin-right: 0 !important;
    margin-bottom: 0 !important;
  }
  .date-filter-form :deep(.el-form-item__label) {
    display: none !important;
  }
  .date-filter-form :deep(.el-form-item__content) {
    width: 100% !important;
    flex: none !important;
  }
  .date-filter-form :deep(.el-date-editor.el-input__wrapper) {
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .date-filter-form :deep(.el-range-editor.el-input__wrapper) {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .date-filter-form :deep(.el-radio-group) {
    width: 100% !important;
    display: flex !important;
    flex-wrap: nowrap !important;
  }
  .date-filter-form :deep(.el-radio-button) {
    flex: 1 !important;
    min-width: 0 !important;
  }
  .date-filter-form :deep(.el-radio-button__inner) {
    width: 100% !important;
    padding: 8px 4px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }
}
</style>

<style>
/* 移动端日期范围选择器弹窗样式 - 必须是非scoped因为弹窗渲染在body */
@media (max-width: 768px) {
  .report-date-popper.el-popper {
    width: calc(100vw - 60px) !important;
    max-width: calc(100vw - 60px) !important;
    left: 30px !important;
    right: 30px !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
    overflow: hidden !important;
    border: none !important;
  }
  .report-date-popper .el-picker-panel.el-date-range-picker {
    width: 100% !important;
    max-width: 100% !important;
  }
  .report-date-popper .el-picker-panel__body-wrapper {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
  }
  .report-date-popper .el-picker-panel__body {
    width: 100% !important;
  }
  .report-date-popper .el-date-range-picker__content {
    display: block !important;
    width: 100% !important;
    padding: 12px 8px !important;
    box-sizing: border-box !important;
  }
  .report-date-popper .el-date-range-picker__content.is-left {
    border-right: none !important;
    border-bottom: 1px solid #f0f0f0 !important;
    padding-bottom: 16px !important;
  }
  .report-date-popper .el-date-range-picker__content.is-right {
    padding-top: 12px !important;
  }
  .report-date-popper .el-date-range-picker__header {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    padding: 4px 0 12px !important;
    gap: 8px !important;
  }
  .report-date-popper .el-date-range-picker__header button {
    padding: 6px 10px !important;
    border-radius: 8px !important;
    background: #f5f7fa !important;
    border: none !important;
  }
  .report-date-popper .el-date-range-picker__header div {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #303133 !important;
  }
  .report-date-popper .el-picker-panel__content {
    transform: scale(0.72) !important;
    transform-origin: top left !important;
    margin-right: -28% !important;
    margin-bottom: -80px !important;
  }
  .report-date-popper .el-date-table {
    width: 100% !important;
  }
  .report-date-popper .el-date-table th {
    font-size: 13px !important;
    font-weight: 500 !important;
    color: #909399 !important;
    padding: 8px 0 !important;
  }
  .report-date-popper .el-date-table td {
    padding: 3px 0 !important;
  }
  .report-date-popper .el-date-table-cell {
    height: 40px !important;
  }
  .report-date-popper .el-date-table-cell__text {
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    font-size: 15px !important;
    border-radius: 50% !important;
  }
  .report-date-popper .el-date-table td.in-range .el-date-table-cell {
    background-color: #e6f4ff !important;
  }
  .report-date-popper .el-date-table td.start-date .el-date-table-cell__text,
  .report-date-popper .el-date-table td.end-date .el-date-table-cell__text {
    background-color: #409eff !important;
    color: #fff !important;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4) !important;
  }
  .report-date-popper .el-date-table td.today .el-date-table-cell__text {
    color: #409eff !important;
    font-weight: 700 !important;
    border: 2px solid #409eff !important;
    line-height: 32px !important;
  }
}
</style>
