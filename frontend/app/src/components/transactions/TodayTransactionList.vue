<template>
  <div class="today-records">
    <div class="page-header">
      <h2 class="page-title">消费记录</h2>
      <el-popover placement="bottom-end" :width="140" trigger="click">
        <template #reference>
          <span class="column-filter-trigger">
            <el-icon><Operation /></el-icon>
          </span>
        </template>
        <div class="column-filter">
          <div class="column-filter-title">显示列</div>
          <el-checkbox-group v-model="visibleColumns">
            <el-checkbox v-for="col in columnOptions" :key="col.value" :value="col.value">
              {{ col.label }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </el-popover>
    </div>

    <div class="transaction-table-container">
      <el-table :data="transactions" stripe show-overflow-tooltip class="today-table" :class="{ 'auto-width': visibleColumns.length > 0 }" style="width: 100%">
        <el-table-column prop="member.name" label="姓名" width="90">
          <template #default="{ row }">{{ row.member?.name || row.customerName || '非会员用户' }}</template>
        </el-table-column>

        <el-table-column v-if="visibleColumns.includes('card')" label="会员卡" width="210">
          <template #default="{ row }">
            <div v-if="row.member && fmt.isMultiCardPayment(row)" class="multi-card-list">
              <div v-for="cardInfo in fmt.getMultiCardList(row)" :key="cardInfo.name" class="card-item">
                <el-tag type="warning" size="small">{{ cardInfo.name }}</el-tag>
              </div>
            </div>
            <el-tag v-else-if="row.member && row.cardUsed" type="primary" size="small">
              {{ row.cardDisplayName || row.cardUsed.cardType?.name || '会员卡' }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column label="服务项目" class-name="auto-width-column">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.transactionType === 'PENDING'"
              :content="row.summary"
              placement="top"
              effect="dark"
            >
              <span class="pending-record">{{ row.summary }}</span>
            </el-tooltip>
            <el-tooltip
              v-else-if="row.transactionType === 'PENDING_CLEAR'"
              :content="fmt.getBatchClearTooltip(row)"
              placement="top"
              :disabled="!fmt.isBatchClear(row)"
            >
              <span class="clear-record">{{ row.summary }}</span>
            </el-tooltip>
            <el-tooltip
              v-else
              :content="fmt.formatServiceItems(row.items) || row.summary || '项目消费'"
              placement="top"
              effect="dark"
            >
              <span class="service-items-text">
                {{ fmt.formatServiceItems(row.items) || row.summary || '项目消费' }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column v-if="visibleColumns.includes('quantity')" label="数量" width="60" align="center">
          <template #default="{ row }">
            <span v-if="row.items && row.items.length > 0">
              {{ row.items.reduce((sum, item) => sum + (item.quantity || 1), 0) }}
            </span>
            <span v-else>1</span>
          </template>
        </el-table-column>

        <el-table-column label="金额" width="115" align="center">
          <template #default="{ row }">
            <div class="amount-cell">
              <div class="amount-row sub">应付：{{ formatCurrency(row.totalAmount) }}</div>
              <div class="amount-row">
                <el-tooltip v-if="row.balanceSnapshot && row.balanceSnapshot.totalBalanceAfter !== undefined" placement="left">
                  <template #content>
                    <div class="snapshot-title">余额快照</div>
                    <div v-for="card in row.balanceSnapshot.cards" :key="card.cardId" class="card-balance-tip">
                      <span :class="{ 'used-card': card.isUsed }">{{ card.cardName }}: ¥{{ formatAmount(card.balanceBefore) }} → ¥{{ formatAmount(card.balanceAfter) }}</span>
                      <span v-if="card.isUsed" class="used-tag">✓</span>
                    </div>
                  </template>
                  <span :class="{ 'paid-amount': true, 'pending-amount': row.transactionType === 'PENDING', 'clear-amount': row.transactionType === 'PENDING_CLEAR', 'has-snapshot': true }">
                    实付：¥{{ formatAmount(row.actualPaidAmount) }}
                  </span>
                </el-tooltip>
                <el-tooltip v-else-if="row.balanceSnapshot && row.balanceSnapshot.totalBalance !== undefined" placement="left">
                  <template #content>
                    <div class="snapshot-title">余额快照</div>
                    <div v-for="card in row.balanceSnapshot.cards" :key="card.cardId" class="card-balance-tip">
                      <span :class="{ 'used-card': card.isUsed }">{{ card.cardName }}: ¥{{ formatAmount(card.balance) }}</span>
                      <span v-if="card.isUsed" class="used-tag">✓</span>
                    </div>
                  </template>
                  <span :class="{ 'paid-amount': true, 'pending-amount': row.transactionType === 'PENDING', 'clear-amount': row.transactionType === 'PENDING_CLEAR', 'has-snapshot': true }">
                    实付：¥{{ formatAmount(row.actualPaidAmount) }}
                  </span>
                </el-tooltip>
                <span v-else :class="{ 'paid-amount': true, 'pending-amount': row.transactionType === 'PENDING', 'clear-amount': row.transactionType === 'PENDING_CLEAR' }">
                  实付：¥{{ formatAmount(row.actualPaidAmount) }}
                </span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column v-if="visibleColumns.includes('discount')" label="折扣" width="85">
          <template #default="{ row }">
            <div class="discount-cell">
              <div v-if="row.manualAdjustment" class="discount-info">
                <span class="discount-rate warning">{{ fmt.getAdjustmentText(row) }}</span>
                <div class="adjustment-reason" v-if="fmt.getAdjustmentReason(row)">
                  {{ fmt.getAdjustmentReason(row) }}
                </div>
              </div>
              <div v-if="row.member && fmt.isMultiCardPayment(row)" class="discount-info" :class="{ 'mt-2': row.manualAdjustment }">
                <span class="discount-rate">多卡 {{ fmt.getAverageDiscountDisplay(row) }}折</span>
                <span class="discount-save">省 {{ formatCurrency(row.discountAmount) }}</span>
                <div class="multi-card-details">{{ fmt.getMultiCardDetails(row) }}</div>
              </div>
              <div v-else-if="row.member && parseFloat(row.discountAmount) > 0 && !row.manualAdjustment && !fmt.isMultiCardPayment(row)" class="discount-info">
                <template v-if="row.cardUsed">
                  <span class="discount-rate">{{ fmt.getCardDiscountDisplay(row.cardUsed.cardType?.discountRate) }}折</span>
                  <span class="discount-save">省 {{ formatCurrency(row.discountAmount) }}</span>
                </template>
                <template v-else>
                  <span class="discount-rate">{{ fmt.getSingleCardDiscountDisplay(row) }}</span>
                </template>
              </div>
              <span v-if="!row.manualAdjustment && (!row.member || parseFloat(row.discountAmount) <= 0)" class="no-discount">-</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column v-if="visibleColumns.includes('time')" prop="transactionTime" label="时间" width="105" align="center">
          <template #default="{ row }">
            <el-tooltip :content="fmt.getTimeTooltip(row)" placement="top" effect="dark">
              <span :class="{ 'manual-time': fmt.isManualTime(row) }">
                <el-icon v-if="fmt.isManualTime(row)" style="margin-right: 4px;"><Edit /></el-icon>
                {{ formatShortDateInAppTimeZone(row.transactionTime) }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column v-if="canShowVoidButton" label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip v-if="!canVoidTransaction(row)" content="超过7天无法撤销" placement="top">
              <el-button class="void-btn void-btn-disabled" size="small" link disabled>撤销</el-button>
            </el-tooltip>
            <el-button v-else class="void-btn" size="small" link @click="$emit('void', row)">撤销</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <div v-if="pagination.hasMore" class="load-more-container">
          <el-button
            @click="$emit('load-more')"
            :loading="isLoadingMore"
            type="primary"
            size="small"
            style="padding: 12px 24px; border-radius: 6px;"
          >
            {{ isLoadingMore ? '加载中...' : `加载更多 (已显示 ${transactions.length}/${pagination.total} 条)` }}
          </el-button>
        </div>
        <div v-else-if="transactions.length > 0" class="all-loaded">
          已显示全部 {{ pagination.total }} 条记录
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Edit, Operation } from '@element-plus/icons-vue';
import { formatAmount, formatCurrency } from '@/utils/currency.js';
import { formatShortDateInAppTimeZone } from '@/utils/date.js';
import { useTransactionFormatters } from '@/composables/useTransactionFormatters.js';

defineProps({
  transactions: { type: Array, required: true },
  pagination: { type: Object, required: true },
  isLoadingMore: { type: Boolean, default: false },
  canShowVoidButton: { type: Boolean, default: false }
});

defineEmits(['load-more', 'void']);

const fmt = useTransactionFormatters();

const columnOptions = [
  { label: '会员卡', value: 'card' },
  { label: '数量', value: 'quantity' },
  { label: '折扣', value: 'discount' },
  { label: '时间', value: 'time' }
];

const getDefaultColumns = () => {
  const width = window.innerWidth;
  if (width <= 480) return [];
  if (width <= 768) return ['card', 'discount'];
  return ['card', 'quantity', 'discount', 'time'];
};

const visibleColumns = ref(getDefaultColumns());

const canVoidTransaction = (transaction) => {
  const txTime = new Date(transaction.transactionTime);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return txTime >= sevenDaysAgo;
};
</script>

<style scoped>
.today-records { margin-top: 20px; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 15px;
}
.page-title { font-size: 22px; margin: 0; color: #303133; }

.transaction-table-container { width: 100%; }
.today-table :deep(thead) { color: #606266; font-weight: 500; }
.today-table :deep(th) { background-color: #fafafa !important; }
.today-table :deep(th .cell) { white-space: nowrap; }
.today-table.auto-width :deep(table) {
  table-layout: auto !important;
}
.today-table.auto-width :deep(.auto-width-column .cell) {
  white-space: nowrap;
}
.today-table :deep(.el-table__cell) { border: none; }
.today-table::before { display: none; }

.amount-cell { line-height: 1.6; white-space: nowrap; }
.amount-row { white-space: nowrap; font-size: 13px; }
.amount-row.sub {
  color: #a8abb2;
  font-size: 13px;
  text-decoration: line-through;
  text-decoration-color: #c0c4cc;
}
.paid-amount { font-size: 13px; font-weight: 600; color: #606266; }
.pending-amount { color: #e6a23c !important; }
.clear-amount { color: #67c23a !important; }
.pending-record { color: #f56c6c; }
.clear-record { color: #67c23a; }
.service-items-text {
  cursor: help;
}
.manual-time {
  color: #e6a23c !important;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}

.discount-cell { line-height: 1.5; }
.discount-info { display: flex; flex-direction: column; gap: 2px; }
.discount-rate { font-size: 13px; color: #606266; }
.discount-rate.warning { color: #e6a23c; font-weight: 500; }
.discount-save { font-size: 13px; color: #67c23a; font-weight: 500; }
.no-discount { color: #c0c4cc; }
.adjustment-reason {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
  line-height: 1.2;
}
.mt-2 { margin-top: 8px; }

.multi-card-list { display: flex; flex-direction: column; gap: 2px; }
.multi-card-list .card-item { display: flex; }
.multi-card-details {
  font-size: 10px;
  color: #909399;
  line-height: 1.2;
  margin-top: 2px;
}

.has-snapshot {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}
.snapshot-title {
  font-weight: 500;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.card-balance-tip {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 13px;
}
.card-balance-tip .used-card { color: #67c23a; font-weight: 500; }
.card-balance-tip .used-tag { color: #67c23a; margin-left: 4px; }

.column-filter-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #909399;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
  transition: all 0.2s;
}
.column-filter-trigger:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}
.column-filter-trigger .el-icon { font-size: 14px; }
.column-filter-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}
.column-filter .el-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.column-filter .el-checkbox { margin-right: 0; height: auto; }

.void-btn {
  color: #f56c6c !important;
  font-weight: 500;
  border: 1px solid #f56c6c !important;
  padding: 4px 10px !important;
  border-radius: 4px;
}
.void-btn:hover { color: #fff !important; background-color: #f56c6c !important; }
.void-btn-disabled {
  color: #c0c4cc !important;
  border-color: #e4e7ed !important;
  cursor: not-allowed;
}
.void-btn-disabled:hover { color: #c0c4cc !important; background-color: transparent !important; }

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
.all-loaded { color: #909399; font-size: 14px; padding: 10px 0; }

@media (max-width: 768px) {
  .transaction-table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .today-table :deep(.el-table__cell) {
    padding: 8px 6px;
    font-size: 13px;
  }
  .today-table :deep(.el-tag) {
    padding: 0 6px;
    font-size: 11px;
  }
}
</style>
