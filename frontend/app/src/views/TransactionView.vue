<template>
  <div class="page-content">
    <!-- 头部区域 -->
    <div class="page-header">
      <h2 class="page-title">结算中心</h2>
    </div>

    <!-- 主体布局 -->
    <el-row :gutter="20">
      <!-- 左侧：开单区域 -->
      <el-col :lg="14" :md="12" :xs="24" class="left-panel">
        <h3 class="panel-title">服务开单</h3>
        <el-form ref="formRef" :model="form" label-width="100px" label-position="top">
          <el-form-item label="选择会员">
      <el-autocomplete
        v-model="memberQuery"
        :fetch-suggestions="queryMembersAsync"
        placeholder="搜索姓名/手机号，或直接为非会员用户开单"
        @select="handleMemberSelect"
        clearable
        @clear="clearMember"
        size="large"
        style="width: 100%"
        popper-class="member-autocomplete-popper"
      >
        <template #default="{ item }">
          <div class="suggestion-item">
            <span class="suggestion-info">
              {{ item.name }} ({{ item.phone }})
            </span>
            <div class="suggestion-tags">
              <el-tag :type="statusTagType(item.status)" size="small" effect="plain">{{ statusText(item.status) }}</el-tag>
              
              <!-- 核心修改：根据 totalBalance 显示标签 -->
              <el-tag v-if="item.totalBalance > 0" type="warning" size="small" effect="plain">
                有卡 (余额: ¥{{ item.totalBalance.toFixed(2) }})
              </el-tag>
              <el-tag v-else type="info" size="small" effect="plain">无有效卡</el-tag>

            </div>
          </div>
        </template>
      </el-autocomplete>

            <el-tag v-if="form.memberId" type="success" style="margin-top: 10px;">
              当前会员: {{ selectedMember.name }} ({{ selectedMember.phone }})
            </el-tag>
          </el-form-item>
          
          <el-form-item label="选择服务">
            <el-select
              v-model="form.serviceIds"
              multiple
              filterable
              placeholder="请选择服务项目"
              size="large"
              style="width: 100%"
            >
              <el-option
                v-for="item in serviceList"
                :key="item.id"
                :label="`${item.name} (¥${item.standardPrice})`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="commissionableStaff.length > 0" label="服务员工">
            <el-select v-model="form.staffId" placeholder="请选择服务员工" size="large" style="width: 100%">
              <el-option
                v-for="item in commissionableStaff"
                :key="item.id"
                :label="`${item.name} (${item.position})`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="支付方式">
            <el-radio-group v-model="form.paymentMethod" size="large">
              <el-radio-button value="CASH">现金</el-radio-button>
              <el-radio-button value="WECHAT_PAY">微信</el-radio-button>
              <el-radio-button value="ALIPAY">支付宝</el-radio-button>
              <el-radio-button value="MEMBER_CARD" :disabled="!form.memberId">会员卡</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="form.paymentMethod === 'MEMBER_CARD'" label="会员卡支付模式">
            <el-radio-group v-model="cardPaymentMode" size="default">
              <el-radio-button value="auto">自动选择</el-radio-button>
              <el-radio-button value="manual">手动选择</el-radio-button>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item label="选择会员卡" v-if="form.paymentMethod === 'MEMBER_CARD' && cardPaymentMode === 'manual'">
            <el-select v-model="form.cardId" placeholder="请选择会员卡" size="large" style="width: 100%">
              <el-option
                v-for="card in availableCards"
                :key="card.id"
                :label="`${card.cardType.name} (余额: ¥${card.balance.toFixed(2)})`"
                :value="card.id"
              />
            </el-select>
          </el-form-item>
          
           <el-form-item label="备注">
            <el-input v-model="form.notes" type="textarea" placeholder="请输入备注信息" size="large" />
          </el-form-item>

        </el-form>
      </el-col>

      <!-- 右侧：订单预览和结算 -->
      <el-col :lg="10" :md="12" :xs="24" class="right-panel">
        <h3 class="panel-title-right">订单详情</h3>
        
        <div v-if="cartItems.length === 0" class="empty-cart">
          <el-empty description="请从左侧选择服务项目" />
        </div>

        <div v-else>
          <el-table :data="cartItems" style="width: 100%">
            <el-table-column prop="name" label="项目名称" />
            <el-table-column prop="standardPrice" label="价格" width="80" align="right">
               <template #default="{ row }">¥{{ row.standardPrice.toFixed(2) }}</template>
            </el-table-column>
          </el-table>
          <el-divider />

          <div class="summary">
            <div class="summary-item">
              <span>应付总额:</span>
              <span>¥{{ totalAmount.toFixed(2) }}</span>
            </div>
            
            <div class="summary-item" v-if="displayDiscountAmount > 0">
              <span class="discount-label">
                卡折扣
                <span class="discount-detail" v-if="averageDiscountRateText">
                  ({{ averageDiscountRateText }})
                </span>
              </span>
              <span class="discount-text">- ¥{{ displayDiscountAmount.toFixed(2) }}</span>
            </div>
            
            <div class="summary-item total">
              <span>实付金额:</span>
              <span class="total-price">¥{{ displayActualPaidAmount.toFixed(2) }}</span>
            </div>
          </div>
          <el-button 
            type="primary" 
            size="large" 
            style="width: 100%; margin-top: 20px;"
            @click="handleCheckout"
            :loading="isSubmitting"
            :disabled="!isCheckoutReady"
          >
            结 算
          </el-button>
        </div>
      </el-col>
    </el-row>
    
    <!-- 今日结算记录 -->
    <div class="today-records">
        <div class="page-header">
          <h2 class="page-title">今日结算记录</h2>
        </div>
        <div>
          <el-table :data="todayTransactions" stripe max-height="600" class="today-table">
            <el-table-column prop="member.name" label="姓名">
              <template #default="{ row }">{{ row.member?.name || '非会员用户' }}</template>
            </el-table-column>
            <el-table-column label="服务项目">
              <template #default="{ row }">{{ row.items.map(item => item.service.name).join(', ') }}</template>
            </el-table-column>
             <el-table-column prop="actualPaidAmount" label="实付金额" align="right">
              <template #default="{ row }">
                <span class="paid-amount">¥{{ row.actualPaidAmount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="transactionTime" label="时间" width="120" align="center">
              <template #default="{ row }">{{ formatCustomDateTime(row.transactionTime) }}</template>
            </el-table-column>
          </el-table>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useTransactionStore } from '@/stores/transaction'; // 引入 transaction store
import { getMembers } from '@/api/member.js';
import { getServiceList } from '@/api/service.js';
import { getStaffList } from '@/api/staff.js';
import { createTransaction, getTodayTransactions, createComboCheckout } from '@/api/transaction.js';

import Decimal from 'decimal.js';
import { ElMessage } from 'element-plus';

// --- 状态定义 ---
const formRef = ref(null);
const memberQuery = ref('');
const serviceList = ref([]);
const allStaff = ref([]);
const selectedMember = ref(null);
const isSubmitting = ref(false);
const todayTransactions = ref([]);
const cardPaymentMode = ref('auto');
const transactionStore = useTransactionStore(); // 实例化 store

// --- 表单数据 ---
const getInitialForm = () => ({
    appointmentId: null, // 新增：存储关联的预约ID

  memberId: null,
  serviceIds: [],
  staffId: null,
  paymentMethod: 'CASH',
  cardId: null,
  notes: '',
});
const form = reactive(getInitialForm());

// --- 核心修改：在 onMounted 中检查并消费数据 ---
onMounted(() => {
  // 检查是否存在从预约页传来的数据
  const appointmentData = transactionStore.consumeAppointmentToCheckout();
  
  if (appointmentData) {
    // 如果有数据，用它来填充表单
form.appointmentId = appointmentData.appointmentId;
form.serviceIds = appointmentData.serviceIds;
    
    // 触发会员选择逻辑，以自动加载会员信息和卡片
    if(appointmentData.memberId) {
      handleMemberSelect({
          id: appointmentData.memberId,
          name: appointmentData.customerName,
          phone: appointmentData.customerPhone,
      });
      memberQuery.value = `${appointmentData.customerName} (${appointmentData.customerPhone})`;
    }
  }

  // 继续执行原有的加载逻辑
  fetchServices();
  fetchStaff();
  fetchTodayTransactions();
});
// --- API 调用 ---
const fetchServices = async () => {
  // --- 核心修改：只获取上架的服务 ---
  serviceList.value = await getServiceList({ status: 'AVAILABLE' });
};
const fetchStaff = async () => {
  // --- 核心修改：只获取在职的员工 ---
  allStaff.value = await getStaffList({ status: 'ACTIVE' });
};

const fetchTodayTransactions = async () => { 
  const data = await getTodayTransactions();
  todayTransactions.value = data.map(tx => ({
    ...tx,
    items: tx.items.map(item => ({
      ...item,
      price: item.price !== null ? item.price : (item.service?.standardPrice || 0)
    }))
  }));
};

const queryMembersAsync = async (queryString, cb) => {
  if (!queryString) return cb([]);
  const { data } = await getMembers({ search: queryString, limit: 20, includeCards: true });
  cb(data.map(m => ({ ...m, value: `${m.name} (${m.phone})` }))); 
};

// --- 计算属性 ---
const commissionableStaff = computed(() => allStaff.value.filter(staff => staff.countsCommission));
const cartItems = computed(() => serviceList.value.filter(s => form.serviceIds.includes(s.id)));
const totalAmount = computed(() => new Decimal(cartItems.value.reduce((sum, item) => sum + item.standardPrice, 0)));

const availableCards = computed(() => {
  if (!selectedMember.value?.cards) return [];
  return selectedMember.value.cards
    .filter(card => card.status === 'ACTIVE' && card.balance > 0)
    .sort((a, b) => {
      if (a.cardType.discountRate !== b.cardType.discountRate) {
        return a.cardType.discountRate - b.cardType.discountRate;
      }
      return a.balance - b.balance;
    });
});

// 核心改动1：创建一个统一的、纯前端的支付计划计算属性
const paymentPlan = computed(() => {
  if (form.paymentMethod !== 'MEMBER_CARD' || cartItems.value.length === 0 || !selectedMember.value) {
    return {
      paymentDetails: [],
      actualPaidAmount: totalAmount.value,
      discountAmount: new Decimal(0),
      isPayable: cartItems.value.length > 0,
    };
  }

  // 手动模式
  if (cardPaymentMode.value === 'manual') {
    if (!form.cardId) return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
    const card = availableCards.value.find(c => c.id === form.cardId);
    if (!card) return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
    
    const actualPaid = totalAmount.value.times(card.cardType.discountRate);
    if (new Decimal(card.balance).lessThan(actualPaid)) {
        return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0), error: '余额不足' };
    }
    
    const discount = totalAmount.value.minus(actualPaid);
    return {
      paymentDetails: [{
        cardName: card.cardType.name,
        discountRate: card.cardType.discountRate,
        discountAmount: discount,
      }],
      actualPaidAmount: actualPaid,
      discountAmount: discount,
      isPayable: true,
    };
  }

  // 自动模式
  let remainingAmount = totalAmount.value;
  let totalPaid = new Decimal(0);
  const paymentDetails = [];
  
  for (const card of availableCards.value) {
    if (remainingAmount.isZero()) break;
    
    const cardBalance = new Decimal(card.balance);
    const discountRate = new Decimal(card.cardType.discountRate);
    const maxOriginalAmount = cardBalance.div(discountRate);
    const amountToCover = Decimal.min(remainingAmount, maxOriginalAmount);
    const deduction = amountToCover.times(discountRate);

    totalPaid = totalPaid.plus(deduction);
    remainingAmount = remainingAmount.minus(amountToCover);

    paymentDetails.push({
      cardName: card.cardType.name,
      discountRate: card.cardType.discountRate,
      discountAmount: amountToCover.minus(deduction),
    });
  }

  if (!remainingAmount.isZero()) {
    return { paymentDetails: [], actualPaidAmount: totalAmount.value, totalDiscount: 0, error: '余额不足' };
  }
  
  return {
    paymentDetails,
    actualPaidAmount: totalPaid,
    discountAmount: totalAmount.value.minus(totalPaid),
    isPayable: true,
  };
});

const displayActualPaidAmount = computed(() => new Decimal(paymentPlan.value.actualPaidAmount || 0));
const displayDiscountAmount = computed(() => new Decimal(paymentPlan.value.discountAmount || 0));

const averageDiscountRateText = computed(() => {
  if (displayDiscountAmount.value.isZero()) return '';
  if (cardPaymentMode.value === 'manual' && paymentPlan.value.paymentDetails.length > 0) {
      const detail = paymentPlan.value.paymentDetails[0];
      return `${detail.cardName} - ${(detail.discountRate * 10).toFixed(1)}折`;
  }
  if (cardPaymentMode.value === 'auto' && totalAmount.value.gt(0)) {
    const rate = displayActualPaidAmount.value.div(totalAmount.value);
    return `综合 ${(rate.times(10)).toFixed(1)}折`;
  }
  return '';
});

const isCheckoutReady = computed(() => {
  if (cartItems.value.length === 0) return false;
  if (commissionableStaff.value.length > 0 && !form.staffId) return false;
  if (form.paymentMethod === 'MEMBER_CARD' && paymentPlan.value.error) return false;
  return true;
});

// --- 事件处理 ---
const handleMemberSelect = (item) => {
  form.memberId = item.id;
  selectedMember.value = item;
  cardPaymentMode.value = 'auto'; 
  
  const hasActiveCard = availableCards.value.length > 0;
  if (hasActiveCard) {
    form.paymentMethod = 'MEMBER_CARD';
  } else {
    form.paymentMethod = 'CASH';
  }
  form.cardId = null; 
};

const clearMember = () => {
  Object.assign(form, getInitialForm());
  memberQuery.value = '';
  selectedMember.value = null;
  cardPaymentMode.value = 'auto';
};

const resetForm = () => {
  clearMember();
  form.serviceIds = [];
  form.notes = '';
  fetchTodayTransactions();
  form.appointmentId = null;

};

const handleCheckout = async () => {
  if (!isCheckoutReady.value) {
    ElMessage.warning(paymentPlan.value.error || '请检查开单信息是否完整');
    return;
  }
  
  isSubmitting.value = true;
  try {
    const apiCall = (form.paymentMethod === 'MEMBER_CARD' && cardPaymentMode.value === 'auto')
      ? createComboCheckout(form)
      : createTransaction(form);
      
    await apiCall;
    ElMessage.success('结算成功！');
    resetForm();
  } finally {
    isSubmitting.value = false;
  }
};

// --- 辅助函数 ---
const statusText = (status) => {
  const map = { ACTIVE: '正常', INACTIVE: '停用', FROZEN: '冻结', DELETED: '已注销' };
  return map[status] || '未知';
};
const statusTagType = (status) => {
  const map = { ACTIVE: 'success', INACTIVE: 'info', FROZEN: 'warning', DELETED: 'danger' };
  return map[status] || 'info';
};
const formatCustomDateTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
};
</script>

<style>
.el-autocomplete-suggestion.member-autocomplete-popper ul {
  padding: 0;
}
</style>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.panel-title { font-size: 18px; margin: 0 0 20px 0; color: #303133; }
.panel-title-right { font-size: 18px; margin: 0 0 20px 0; color: #303133; }
.right-panel { background-color: #fafafa; padding: 20px; border-radius: 6px; }
.summary { display: flex; flex-direction: column; gap: 15px; font-size: 16px; }
.summary-item { display: flex; justify-content: space-between; }
.discount-text { color: #f56c6c; }
.total { font-weight: bold; font-size: 18px; }
.total-price { color: #e6a23c; font-size: 22px; }
.today-records { margin-top: 20px; }
.today-table :deep(thead) { color: #606266; font-weight: 500; }
.today-table :deep(th) { background-color: #fafafa !important; }
.today-table :deep(.el-table__cell) { border: none; }
.today-table::before { display: none; }
.paid-amount { font-weight: 500; }
.suggestion-item { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.suggestion-info { flex-grow: 1; }
.suggestion-tags { display: flex; gap: 5px; flex-shrink: 0; margin-left: 15px; }
.combo-preview {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e4e7ed;
}
.combo-preview-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
  font-weight: 500;
}
@media (max-width: 992px) {
  .right-panel { margin-top: 20px; }
}
.discount-label {
  color: #303133; /* 标签文字改为黑色 */
}
.discount-detail {
  color: #f56c6c; /* 折扣详情文字改为与金额一样的颜色 */
  margin-left: 5px;
}
</style>