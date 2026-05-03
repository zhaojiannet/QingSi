<template>
  <div>
    <!-- 挂账列表 -->
    <div class="pending-section">
      <div v-if="pendingPayments.length > 0" class="pending-list">
        <el-row :gutter="8">
          <el-col
            v-for="payment in pendingPayments"
            :key="payment.id"
            :xs="24"
            :sm="12"
            :md="8"
            class="pending-col"
          >
            <div class="pending-item">
              <div class="pending-info">
                <span class="pending-amount">¥{{ formatAmount(payment.amount) }}</span>
                <el-tooltip
                  v-if="payment.description"
                  :content="payment.description"
                  :disabled="!shouldShowTooltip(payment)"
                  placement="top"
                  effect="dark"
                >
                  <span class="pending-description">{{ payment.description }}</span>
                </el-tooltip>
                <span class="pending-date">{{ formatDateInAppTimeZone(payment.createdAt) }}</span>
              </div>
              <el-button
                type="danger"
                size="small"
                plain
                @click="openClearSingleDialog(payment.id, payment.amount)"
                class="delete-btn"
              >
                删除
              </el-button>
            </div>
          </el-col>
        </el-row>

        <div class="pending-actions">
          <div class="pending-total">
            <span class="total-label">总挂账：</span>
            <span class="total-amount">¥{{ formatAmount(totalPendingAmount.toNumber()) }}</span>
          </div>
          <div class="action-buttons">
            <el-button type="success" size="small" @click="openClearAllDialog">全部清账</el-button>
            <el-button type="primary" size="small" @click="openPendingDialog">添加挂账</el-button>
          </div>
        </div>
      </div>

      <div v-else class="no-pending">
        <span>无挂账</span>
        <el-button type="primary" size="small" @click="openPendingDialog">添加挂账</el-button>
      </div>
    </div>

    <!-- 添加挂账对话框 -->
    <el-dialog
      v-model="showPendingDialog"
      title="添加挂账"
      width="450px"
      :close-on-click-modal="false"
    >
      <el-form :model="pendingForm" label-width="80px">
        <el-form-item label="挂账金额" required>
          <el-input v-model="pendingForm.amount" type="number" placeholder="请输入挂账金额" :min="0" step="0.01">
            <template #prefix>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注说明">
          <el-input v-model="pendingForm.description" type="textarea" :rows="2" placeholder="请输入挂账原因或备注（可选）" />
        </el-form-item>
        <el-form-item label="挂账时间">
          <el-date-picker
            v-model="pendingForm.createdAt"
            type="datetime"
            placeholder="默认为当前时间，可手动修改"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelPendingDialog">取消</el-button>
          <el-button
            type="primary"
            @click="handleAddPending"
            :loading="isSubmittingPending"
            :disabled="!pendingForm.amount || parseFloat(pendingForm.amount) <= 0 || isSubmittingPending"
          >
            {{ isSubmittingPending ? '提交中...' : '确认添加' }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 单个挂账清账对话框 -->
    <el-dialog v-model="clearSingleDialog.visible" title="确认清账" width="500px" :close-on-click-modal="false">
      <el-alert :title="`清账金额：¥${formatAmount(clearSingleDialog.amount)}`" type="warning" :closable="false" style="margin-bottom: 20px" />
      <el-form :model="clearSingleDialog" label-width="100px">
        <el-form-item label="支付方式">
          <el-radio-group v-model="clearSingleDialog.paymentMethod">
            <el-radio :value="PAYMENT_METHODS.MEMBER_CARD" :disabled="!hasAvailableCards">会员卡支付</el-radio>
            <el-radio :value="PAYMENT_METHODS.CASH">现金结清</el-radio>
          </el-radio-group>
          <div v-if="!hasAvailableCards && clearSingleDialog.paymentMethod === PAYMENT_METHODS.MEMBER_CARD" class="no-cards-tip">
            该会员没有可用的会员卡
          </div>
        </el-form-item>
        <el-form-item
          label="选择会员卡"
          v-if="clearSingleDialog.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && hasAvailableCards"
        >
          <el-select v-model="clearSingleDialog.cardId" placeholder="请选择会员卡" @change="validateCardBalance" style="width: 100%">
            <el-option
              v-for="card in availableCards"
              :key="card.id"
              :label="getCardOptionLabel(card)"
              :value="card.id"
              :disabled="card.balance < clearSingleDialog.amount"
            >
              <div :style="{ color: card.balance < clearSingleDialog.amount ? '#F56C6C' : '' }">
                <div>{{ getCardDisplayName(card) }}</div>
                <div style="font-size: 12px;">
                  余额: ¥{{ formatAmount(card.balance) }}
                  <span v-if="card.balance < clearSingleDialog.amount" style="color: #F56C6C;">- 余额不足</span>
                </div>
              </div>
            </el-option>
          </el-select>
          <el-alert
            v-if="clearSingleDialog.cardId && !isSingleBalanceSufficient"
            title="所选会员卡余额不足，无法完成清账"
            type="error"
            :closable="false"
            style="margin-top: 10px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clearSingleDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          @click="confirmClearSingle"
          :disabled="!canConfirmSingleClear"
          :loading="clearSingleDialog.loading"
        >
          {{ clearSingleDialog.loading ? '处理中...' : '确认清账' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 批量清账对话框 -->
    <el-dialog v-model="clearAllDialog.visible" title="确认批量清账" width="500px" :close-on-click-modal="false">
      <el-alert :title="`总挂账金额：¥${formatAmount(totalPendingAmount.toNumber())}`" type="warning" :closable="false" style="margin-bottom: 20px" />
      <div class="pending-summary" style="margin-bottom: 20px;">
        <div style="font-size: 14px; color: #666;">共 {{ pendingPayments.length }} 笔挂账记录</div>
      </div>
      <el-form :model="clearAllDialog" label-width="100px">
        <el-form-item label="支付方式">
          <el-radio-group v-model="clearAllDialog.paymentMethod">
            <el-radio :value="PAYMENT_METHODS.MEMBER_CARD" :disabled="!hasAvailableCards">会员卡支付</el-radio>
            <el-radio :value="PAYMENT_METHODS.CASH">现金结清</el-radio>
          </el-radio-group>
          <div v-if="!hasAvailableCards && clearAllDialog.paymentMethod === PAYMENT_METHODS.MEMBER_CARD" class="no-cards-tip">
            该会员没有可用的会员卡
          </div>
        </el-form-item>
        <el-form-item
          label="选择会员卡"
          v-if="clearAllDialog.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && hasAvailableCards"
        >
          <el-select v-model="clearAllDialog.cardId" placeholder="请选择会员卡" @change="validateAllCardBalance" style="width: 100%">
            <el-option
              v-for="card in availableCards"
              :key="card.id"
              :label="getCardOptionLabel(card)"
              :value="card.id"
              :disabled="card.balance < totalPendingAmount.toNumber()"
            >
              <div :style="{ color: card.balance < totalPendingAmount.toNumber() ? '#F56C6C' : '' }">
                <div>{{ getCardDisplayName(card) }}</div>
                <div style="font-size: 12px;">
                  余额: ¥{{ formatAmount(card.balance) }}
                  <span v-if="card.balance < totalPendingAmount.toNumber()" style="color: #F56C6C;">- 余额不足</span>
                </div>
              </div>
            </el-option>
          </el-select>
          <el-alert
            v-if="clearAllDialog.cardId && !isAllBalanceSufficient"
            title="所选会员卡余额不足，无法完成批量清账"
            type="error"
            :closable="false"
            style="margin-top: 10px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clearAllDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          @click="confirmClearAll"
          :disabled="!canConfirmAllClear"
          :loading="clearAllDialog.loading"
        >
          {{ clearAllDialog.loading ? '处理中...' : '确认批量清账' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { addPendingPayment, deletePendingPayment, clearAllPendingPayments } from '@/api/member.js';
import { formatAmount, toDecimal } from '@/utils/currency.js';
import { formatDateInAppTimeZone } from '@/utils/date.js';
import { getCardDisplayName } from '@/utils/formatters.js';
import { PAYMENT_METHODS } from '@/constants/payment.js';

const props = defineProps({
  memberId: { type: String, required: true },
  pendingPayments: { type: Array, required: true },
  availableCards: { type: Array, default: () => [] }
});

const emit = defineEmits(['changed']);

// --- 状态 ---
const showPendingDialog = ref(false);
const isSubmittingPending = ref(false);

const pendingForm = reactive({
  amount: null,
  description: '',
  createdAt: null
});

const clearSingleDialog = reactive({
  visible: false,
  pendingId: null,
  amount: 0,
  paymentMethod: PAYMENT_METHODS.CASH,
  cardId: null,
  loading: false
});

const clearAllDialog = reactive({
  visible: false,
  paymentMethod: PAYMENT_METHODS.CASH,
  cardId: null,
  loading: false
});

// --- 计算属性 ---
const hasAvailableCards = computed(() => props.availableCards.length > 0);

const totalPendingAmount = computed(() =>
  props.pendingPayments.reduce((sum, p) => sum.plus(toDecimal(p.amount)), toDecimal(0))
);

const isSingleBalanceSufficient = computed(() => {
  if (clearSingleDialog.paymentMethod !== PAYMENT_METHODS.MEMBER_CARD) return true;
  if (!clearSingleDialog.cardId) return false;
  const card = props.availableCards.find(c => c.id === clearSingleDialog.cardId);
  return card && parseFloat(card.balance) >= clearSingleDialog.amount;
});

const isAllBalanceSufficient = computed(() => {
  if (clearAllDialog.paymentMethod !== PAYMENT_METHODS.MEMBER_CARD) return true;
  if (!clearAllDialog.cardId) return false;
  const card = props.availableCards.find(c => c.id === clearAllDialog.cardId);
  return card && parseFloat(card.balance) >= totalPendingAmount.value.toNumber();
});

const canConfirmSingleClear = computed(() => {
  if (clearSingleDialog.paymentMethod === PAYMENT_METHODS.CASH) return true;
  return isSingleBalanceSufficient.value;
});

const canConfirmAllClear = computed(() => {
  if (clearAllDialog.paymentMethod === PAYMENT_METHODS.CASH) return true;
  return isAllBalanceSufficient.value;
});

// --- helpers ---
const getCardOptionLabel = (card) => {
  return `${getCardDisplayName(card)} (余额: ¥${formatAmount(card.balance)})`;
};

const shouldShowTooltip = (payment) => payment.description && payment.description.length > 15;

const getOptimalPaymentCard = (requiredAmount) => {
  if (!props.availableCards.length) return null;
  const sufficientCards = props.availableCards.filter(c => parseFloat(c.balance) >= requiredAmount);
  if (!sufficientCards.length) return null;
  return sufficientCards.reduce((optimal, card) => {
    return parseFloat(card.balance) < parseFloat(optimal.balance) ? card : optimal;
  });
};

// --- 添加挂账 ---
const openPendingDialog = () => {
  pendingForm.createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  showPendingDialog.value = true;
};

const cancelPendingDialog = () => {
  pendingForm.amount = null;
  pendingForm.description = '';
  pendingForm.createdAt = null;
  showPendingDialog.value = false;
};

const handleAddPending = async () => {
  if (isSubmittingPending.value) return;
  try {
    const amount = parseFloat(pendingForm.amount);
    if (!amount || amount <= 0) {
      ElMessage.warning('请输入有效的挂账金额');
      return;
    }
    isSubmittingPending.value = true;
    await addPendingPayment(props.memberId, {
      amount,
      description: pendingForm.description || null,
      createdAt: pendingForm.createdAt || new Date().toISOString()
    });
    ElMessage.success('挂账添加成功');
    cancelPendingDialog();
    emit('changed');
  } catch {
    ElMessage.error('挂账添加失败');
  } finally {
    isSubmittingPending.value = false;
  }
};

// --- 单笔清账 ---
const openClearSingleDialog = (pendingId, amount) => {
  clearSingleDialog.pendingId = pendingId;
  clearSingleDialog.amount = amount;
  clearSingleDialog.loading = false;

  const optimalCard = getOptimalPaymentCard(amount);
  if (optimalCard) {
    clearSingleDialog.paymentMethod = PAYMENT_METHODS.MEMBER_CARD;
    clearSingleDialog.cardId = optimalCard.id;
  } else {
    clearSingleDialog.paymentMethod = PAYMENT_METHODS.CASH;
    clearSingleDialog.cardId = null;
  }
  clearSingleDialog.visible = true;
};

const confirmClearSingle = async () => {
  if (!canConfirmSingleClear.value) return;
  clearSingleDialog.loading = true;
  try {
    const paymentData = { paymentMethod: clearSingleDialog.paymentMethod };
    if (clearSingleDialog.paymentMethod === PAYMENT_METHODS.MEMBER_CARD) {
      if (!clearSingleDialog.cardId) {
        ElMessage.error('请选择会员卡');
        return;
      }
      paymentData.cardId = clearSingleDialog.cardId;
    }
    const response = await deletePendingPayment(props.memberId, clearSingleDialog.pendingId, paymentData);
    ElMessage.success(response.message || '挂账已清除');
    clearSingleDialog.visible = false;
    emit('changed');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '清账失败');
  } finally {
    clearSingleDialog.loading = false;
  }
};

// --- 批量清账 ---
const openClearAllDialog = () => {
  clearAllDialog.loading = false;
  const totalAmount = totalPendingAmount.value.toNumber();
  const optimalCard = getOptimalPaymentCard(totalAmount);
  if (optimalCard) {
    clearAllDialog.paymentMethod = PAYMENT_METHODS.MEMBER_CARD;
    clearAllDialog.cardId = optimalCard.id;
  } else {
    clearAllDialog.paymentMethod = PAYMENT_METHODS.CASH;
    clearAllDialog.cardId = null;
  }
  clearAllDialog.visible = true;
};

const confirmClearAll = async () => {
  if (!canConfirmAllClear.value) return;
  clearAllDialog.loading = true;
  try {
    const paymentData = { paymentMethod: clearAllDialog.paymentMethod };
    if (clearAllDialog.paymentMethod === PAYMENT_METHODS.MEMBER_CARD) {
      if (!clearAllDialog.cardId) {
        ElMessage.error('请选择会员卡');
        return;
      }
      paymentData.cardId = clearAllDialog.cardId;
    }
    const response = await clearAllPendingPayments(props.memberId, paymentData);
    ElMessage.success(response.message || '所有挂账已清除');
    clearAllDialog.visible = false;
    emit('changed');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '批量清账失败');
  } finally {
    clearAllDialog.loading = false;
  }
};

const validateCardBalance = () => {
  if (!isSingleBalanceSufficient.value) ElMessage.warning('所选会员卡余额不足');
};
const validateAllCardBalance = () => {
  if (!isAllBalanceSufficient.value) ElMessage.warning('所选会员卡余额不足');
};
</script>

<style scoped>
.pending-section {
  padding: 10px;
  background-color: #f9f9f9;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-top: 10px;
}
.pending-list { margin-bottom: 10px; }
.pending-col { margin-bottom: 6px; }

.pending-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  border-radius: 3px;
  min-height: 50px;
}
.pending-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.pending-amount {
  font-size: 14px;
  font-weight: bold;
  color: #f56c6c;
  line-height: 1.2;
}
.pending-description {
  font-size: 12px;
  color: #606266;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pending-date {
  font-size: 11px;
  color: #909399;
  line-height: 1.1;
}
.delete-btn {
  flex-shrink: 0;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 11px;
  height: 24px;
}

.pending-actions {
  margin-top: 10px;
  padding: 8px 10px;
  background-color: #f0f9ff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.pending-total {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}
.total-label {
  font-size: 13px;
  color: #606266;
}
.total-amount {
  font-size: 14px;
  font-weight: bold;
  color: #409eff;
}
.action-buttons {
  display: flex;
  gap: 8px;
}

.no-pending {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.no-pending span {
  color: #909399;
  font-style: italic;
  font-size: 13px;
}

.no-cards-tip {
  margin-top: 8px;
  color: #f56c6c;
  font-size: 12px;
}
</style>
