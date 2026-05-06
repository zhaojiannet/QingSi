<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">收银 · 结算</h2>
    </div>

    <el-row :gutter="20">
      <!-- 左侧：开单区域 -->
      <el-col :lg="14" :md="12" :xs="24" class="left-panel">
        <h3 class="panel-title">请选择消费项目</h3>
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
                  <span class="suggestion-info">{{ item.name }} ({{ item.phone }})</span>
                  <div class="suggestion-tags">
                    <el-tag :type="memberStatusTagType(item.status)" size="small" effect="plain">
                      {{ memberStatusText(item.status) }}
                    </el-tag>
                    <el-tag v-if="item.totalBalance > 0" type="warning" size="small" effect="plain">
                      有卡 (余额: {{ formatCurrency(item.totalBalance) }})
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
              :model-value="uniqueServiceIds"
              multiple
              filterable
              placeholder="请选择服务项目"
              size="large"
              style="width: 100%"
              @change="handleServiceChange"
            >
              <template #tag>
                <el-tag
                  v-for="sid in uniqueServiceIds"
                  :key="sid"
                  closable
                  type="info"
                  disable-transitions
                  class="service-tag"
                  @close="removeServiceId(sid)"
                >
                  {{ serviceMap.get(sid)?.name }}
                  <span v-if="serviceQuantities[sid] > 1" class="service-tag-qty">
                    ×{{ serviceQuantities[sid] }}
                  </span>
                </el-tag>
              </template>
              <el-option
                v-for="item in sortedServiceList"
                :key="item.id"
                :label="`${item.name} (${formatCurrency(item.standardPrice)})`"
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
              <el-radio-button
                v-for="opt in CHECKOUT_PAYMENT_OPTIONS"
                :key="opt.value"
                :value="opt.value"
                :disabled="opt.requireMember && !form.memberId"
              >
                {{ opt.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-show="form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD" label="会员卡支付模式">
            <el-radio-group v-model="cardPaymentMode" size="default">
              <el-radio-button value="auto">自动选择</el-radio-button>
              <el-radio-button value="manual">手动选择</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-show="form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && cardPaymentMode === 'manual'" label="选择会员卡">
            <el-select v-model="form.cardId" placeholder="请选择会员卡" size="large" style="width: 100%">
              <el-option
                v-for="card in availableCards"
                :key="card.id"
                :label="`${getCardDisplayName(card)} (余额: ${formatCurrency(card.balance)}, ${formatDiscountRate(getCardDiscountRate(card))})`"
                :value="card.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="交易时间">
            <el-date-picker
              v-model="form.transactionTime"
              type="datetime"
              placeholder="默认为当前时间（可选择自定义）"
              size="large"
              style="width: 100%"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              @change="onTransactionTimeChange"
              clearable
            />
          </el-form-item>

          <el-form-item label="备注">
            <el-input v-model="form.notes" type="textarea" placeholder="请输入备注信息" size="large" />
          </el-form-item>
        </el-form>
      </el-col>

      <!-- 右侧：订单预览和结算 -->
      <el-col :lg="10" :md="12" :xs="24" class="right-panel">
        <h3 class="panel-title-right">消费详情</h3>

        <div v-if="cartItems.length === 0" class="empty-cart">
          <el-empty :image-size="100" description="先选择会员（可跳过）和服务项目，结算汇总会出现在这里" />
        </div>

        <div v-else>
          <el-table :data="cartItems" style="width: 100%">
            <el-table-column label="项目名称" min-width="220">
              <template #default="{ row }">
                <div class="service-item">
                  <span class="service-name">{{ row.name }}</span>
                  <div class="service-discount-info" v-if="form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && selectedMember">
                    <el-tag v-if="row.noDiscount" type="danger" size="small" class="discount-tag">
                      <el-icon><Warning /></el-icon> 无折扣 {{ formatCurrency(row.standardPrice) }}
                    </el-tag>
                    <el-tag v-else type="success" size="small" class="discount-tag">
                      {{ getServiceDiscountText(row) }}
                    </el-tag>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="120" align="center">
              <template #default="{ row }">
                <div class="quantity-control">
                  <el-button size="small" :icon="Minus" circle @click="decreaseQuantity(row.id)" :disabled="row.quantity <= 1" />
                  <span class="quantity-number" :class="{ 'quantity-highlight': row.quantity > 1 }">{{ row.quantity }}</span>
                  <el-button size="small" :icon="Plus" circle @click="increaseQuantity(row.id)" />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="standardPrice" label="价格" width="70" align="right">
              <template #default="{ row }">{{ formatCurrency(row.standardPrice) }}</template>
            </el-table-column>
          </el-table>
          <el-divider />

          <div class="summary">
            <div class="summary-item">
              <span>应付总额:</span>
              <span>¥{{ formatAmount(totalAmount) }}</span>
            </div>
            <div class="summary-item" v-if="displayDiscountAmount > 0">
              <span class="discount-label">总优惠:</span>
              <span class="discount-text">- ¥{{ formatAmount(displayDiscountAmount) }}</span>
            </div>
            <div class="summary-item total">
              <span>实付金额:</span>
              <div class="total-price-display">
                <span class="total-price">¥{{ formatAmount(displayActualPaidAmount) }}</span>
                <div class="price-adjustment-controls">
                  <el-button text size="small" type="warning" @click="openPriceAdjustmentDialog" class="adjustment-button">
                    价格调整
                    <el-icon style="margin-left: 4px;"><Edit /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && paymentPlan.paymentDetails.length > 0" class="payment-plan-preview">
            <el-divider content-position="left">支付方案预览</el-divider>
            <div v-for="(detail, index) in paymentPlan.paymentDetails" :key="index" class="plan-card-detail">
              <div class="plan-card-header">
                <span>
                  <el-icon><CreditCard /></el-icon>
                  {{ detail.cardName }} ({{ new Decimal(detail.discountRate).times(10).toFixed(1) }}折)
                </span>
              </div>
              <div class="plan-card-body">
                <span>原价: {{ formatCurrency(detail.originalAmountCovered) }}</span>
                <span>优惠: -{{ formatCurrency(detail.discountAmount) }}</span>
                <span class="deduction">实扣: {{ formatCurrency(detail.deduction) }}</span>
              </div>
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

    <!-- 当日结算记录 -->
    <TodayTransactionList
      :transactions="todayTransactions"
      :pagination="transactionPagination"
      :is-loading-more="isLoadingMore"
      :can-show-void-button="canShowVoidButton"
      @load-more="loadMoreTransactions"
      @void="openVoidDialog"
    />

    <!-- 价格调整对话框 -->
    <el-dialog
      v-model="priceAdjustmentDialog.visible"
      title="价格调整"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="priceAdjustmentDialog" label-width="100px">
        <el-form-item label="原实付金额">
          <el-input :value="formatCurrency(displayActualPaidAmount)" readonly />
        </el-form-item>
        <el-form-item label="调整后金额" required>
          <el-input-number
            v-model="priceAdjustmentDialog.newAmount"
            :precision="2"
            :min="0"
            :max="99999"
            size="large"
            style="width: 100%;"
            placeholder="请输入调整后的金额"
          />
        </el-form-item>
        <el-form-item label="差额">
          <el-input :value="adjustmentDifferenceText" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceAdjustmentDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="confirmPriceAdjustment">确认调整</el-button>
      </template>
    </el-dialog>

    <!-- 价格调整确认对话框 -->
    <el-dialog
      v-model="priceConfirmDialog.visible"
      title="确认价格调整"
      width="450px"
      :close-on-click-modal="false"
    >
      <div class="price-confirm-content">
        <el-alert type="warning" :closable="false" style="margin-bottom: 20px;">
          <template #title>
            <div>请确认价格调整信息：</div>
            <div style="margin-top: 10px;">
              原金额：{{ formatCurrency(displayActualPaidAmount) }} →
              调整后：{{ formatCurrency(priceConfirmDialog.newAmount) }}
            </div>
            <div style="color: #E6A23C; font-weight: bold;">{{ adjustmentDifferenceText }}</div>
          </template>
        </el-alert>
        <el-form :model="priceConfirmDialog" label-width="100px">
          <el-form-item label="调整原因" required>
            <el-input
              v-model="priceConfirmDialog.reason"
              type="textarea"
              :rows="3"
              placeholder="请输入价格调整的原因（必填）"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="priceConfirmDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          @click="applyPriceAdjustment"
          :disabled="!priceConfirmDialog.reason?.trim()"
        >
          确认调整
        </el-button>
      </template>
    </el-dialog>

    <!-- 撤销确认对话框 -->
    <el-dialog
      v-model="voidDialog.visible"
      title="确认撤销交易"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-alert type="warning" :closable="false" style="margin-bottom: 20px;">
        <template #title>
          <div style="font-weight: bold; color: #e6a23c;">
            撤销后将恢复会员卡余额，此操作不可逆！
          </div>
        </template>
      </el-alert>
      <div class="void-info" v-if="voidDialog.transaction">
        <div class="info-row">
          <span class="label">交易时间：</span>
          <span>{{ formatShortDateInAppTimeZone(voidDialog.transaction.transactionTime) }}</span>
        </div>
        <div class="info-row">
          <span class="label">会员：</span>
          <span>{{ voidDialog.transaction.member?.name || voidDialog.transaction.customerName || '非会员用户' }}</span>
        </div>
        <div class="info-row">
          <span class="label">消费项目：</span>
          <span>{{ formatServiceItems(voidDialog.transaction.items) || voidDialog.transaction.summary || '项目消费' }}</span>
        </div>
        <div class="info-row">
          <span class="label">消费金额：</span>
          <span class="amount">¥{{ formatAmount(voidDialog.transaction.actualPaidAmount) }}</span>
        </div>
        <div class="info-row" v-if="voidDialog.transaction.paymentMethod === PAYMENT_METHODS.MEMBER_CARD">
          <span class="label">支付方式：</span>
          <span style="color: #e6a23c;">会员卡支付（撤销后余额将恢复）</span>
        </div>
      </div>
      <el-form :model="voidDialog" label-width="100px" style="margin-top: 20px;">
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
      <template #footer>
        <el-button @click="voidDialog.visible = false">取消</el-button>
        <el-button
          type="danger"
          @click="handleConfirmVoid"
          :loading="voidDialog.loading"
          :disabled="!voidDialog.reason?.trim()"
        >
          确认撤销
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { useTransactionStore } from '@/stores/transaction';
import { useUserStore } from '@/stores/user';
import { getMembers } from '@/api/member.js';
import { getServiceList } from '@/api/service.js';
import { getStaffList } from '@/api/staff.js';
import { createTransaction, getTodayTransactions, createMultiCardTransaction } from '@/api/transaction.js';
import { getSystemConfig } from '@/api/config.js';
import { CreditCard, Plus, Minus, Edit, Warning } from '@element-plus/icons-vue';
import Decimal from 'decimal.js';
import { ElMessage } from 'element-plus';
import { formatAmount, formatCurrency, formatDiscountRate, toDecimal } from '@/utils/currency.js';
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';
import { formatShortDateInAppTimeZone } from '@/utils/date.js';
import { useVoidTransaction } from '@/composables/useVoidTransaction.js';
import { useTransactionFormatters } from '@/composables/useTransactionFormatters.js';
import { getCardDisplayName } from '@/utils/formatters.js';
import { PAYMENT_METHODS, CHECKOUT_PAYMENT_OPTIONS } from '@/constants/payment.js';
import TodayTransactionList from '@/components/transactions/TodayTransactionList.vue';

const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

// --- 状态定义 ---
const formRef = ref(null);
const memberQuery = ref('');
const serviceList = ref([]);
const allStaff = ref([]);
const selectedMember = ref(null);
const isSubmitting = ref(false);
const todayTransactions = ref([]);
const transactionPagination = ref({ page: 1, limit: 20, total: 0, hasMore: true });
const isLoadingMore = ref(false);
const cardPaymentMode = ref('auto');
const transactionStore = useTransactionStore();
const userStore = useUserStore();

// 撤销
const systemConfig = ref({ enableTransactionVoid: false });
const { voidDialog, openVoidDialog, confirmVoid } = useVoidTransaction();
const handleConfirmVoid = () => confirmVoid(() => fetchTodayTransactions());

// 价格调整
const priceAdjustmentDialog = reactive({ visible: false, newAmount: null });
const priceConfirmDialog = reactive({ visible: false, newAmount: null, reason: '' });
const manualPriceAdjustment = reactive({ isActive: false, adjustedAmount: null, reason: '' });

// 表单
const getInitialForm = () => ({
  appointmentId: null,
  memberId: null,
  customerName: null,
  serviceIds: [],
  staffId: null,
  paymentMethod: PAYMENT_METHODS.CASH,
  cardId: null,
  notes: '',
  transactionTime: null,
  isManualTime: false,
});
const form = reactive(getInitialForm());

// helper（撤销对话框需要的几个）
const { formatServiceItems } = useTransactionFormatters();

onMounted(() => {
  // systemConfig 不阻塞首屏，并发触发即可（仅影响撤销按钮显示）
  getSystemConfig()
    .then(c => { systemConfig.value = c; })
    .catch(e => console.error('获取系统配置失败:', e));

  const appointmentData = transactionStore.consumeAppointmentToCheckout();
  if (appointmentData) {
    form.appointmentId = appointmentData.appointmentId;
    form.serviceIds = appointmentData.serviceIds;
    if (appointmentData.memberId) {
      handleMemberSelect({
        id: appointmentData.memberId,
        name: appointmentData.customerName,
        phone: appointmentData.customerPhone,
      });
      memberQuery.value = `${appointmentData.customerName} (${appointmentData.customerPhone})`;
    }
  }

  fetchServices().then(() => {
    if (!appointmentData && form.serviceIds.length === 0) {
      const defaultService = serviceList.value.find(s => s.sortOrder === 0 && s.status === 'AVAILABLE');
      if (defaultService) {
        form.serviceIds = [defaultService.id];
        initializeServiceQuantity(defaultService.id);
      }
    }
  });
  fetchStaff().then(() => {
    if (!appointmentData && !form.staffId) {
      const defaultStaff = allStaff.value.find(s => s.sortOrder === 0 && s.countsCommission);
      if (defaultStaff) form.staffId = defaultStaff.id;
    }
  });
  fetchTodayTransactions();
});

// --- API 调用 ---
const fetchServices = async () => {
  serviceList.value = await getServiceList({ status: 'AVAILABLE' });
};
const fetchStaff = async () => {
  allStaff.value = await getStaffList({ status: 'ACTIVE' });
  return allStaff.value;
};
const fetchTodayTransactions = async (reset = true) => {
  try {
    if (reset) {
      transactionPagination.value.page = 1;
      todayTransactions.value = [];
    }
    const response = await getTodayTransactions({
      page: transactionPagination.value.page,
      limit: transactionPagination.value.limit
    });
    const formattedData = response.data.map(tx => ({
      ...tx,
      items: tx.items.map(item => ({
        ...item,
        price: item.price !== null ? item.price : (item.service?.standardPrice || 0)
      })),
      manualAdjustment: tx.notes && tx.notes.includes('价格调整：')
    }));
    if (reset) {
      todayTransactions.value = formattedData;
    } else {
      todayTransactions.value.push(...formattedData);
    }
    transactionPagination.value = {
      ...transactionPagination.value,
      total: response.pagination.total,
      hasMore: response.pagination.hasMore
    };
  } catch (error) {
    console.error('获取当日消费记录失败:', error);
    if (reset) todayTransactions.value = [];
  }
};

const queryMembersAsync = async (queryString, cb) => {
  if (!queryString) return cb([]);
  const { data } = await getMembers({ search: queryString, limit: 20, includeCards: true });
  cb(data.map(m => ({ ...m, value: `${m.name} (${m.phone})` })));
};

const loadMoreTransactions = async () => {
  if (isLoadingMore.value || !transactionPagination.value.hasMore) return;
  isLoadingMore.value = true;
  transactionPagination.value.page++;
  await fetchTodayTransactions(false);
  isLoadingMore.value = false;
};

// --- 计算属性 ---
const commissionableStaff = computed(() =>
  allStaff.value.filter(s => s.countsCommission).sort((a, b) => a.sortOrder - b.sortOrder)
);

const canShowVoidButton = computed(() => {
  return systemConfig.value?.enableTransactionVoid && ['ADMIN', 'MANAGER'].includes(userStore.userRole);
});

const sortedServiceList = computed(() => [...serviceList.value].sort((a, b) => a.sortOrder - b.sortOrder));

// O(1) 查找替代 Array.find — 多个 computed 都依赖此查找
const serviceMap = computed(() => new Map(serviceList.value.map(s => [s.id, s])));

// 服务数量
const serviceQuantities = reactive({});

const onTransactionTimeChange = (value) => {
  form.isManualTime = !!value;
};

const cartItems = computed(() => {
  const ids = [...new Set(form.serviceIds)];
  return ids.map(serviceId => {
    const service = serviceMap.value.get(serviceId);
    if (!service) return null;
    return { ...service, quantity: serviceQuantities[serviceId] || 1 };
  }).filter(Boolean);
});

const initializeServiceQuantity = (serviceId) => {
  if (!serviceQuantities[serviceId]) serviceQuantities[serviceId] = 1;
};

const increaseQuantity = (serviceId) => {
  if (!serviceQuantities[serviceId]) serviceQuantities[serviceId] = 1;
  serviceQuantities[serviceId]++;
  updateServiceIds();
};

const decreaseQuantity = (serviceId) => {
  if (serviceQuantities[serviceId] && serviceQuantities[serviceId] > 1) {
    serviceQuantities[serviceId]--;
    updateServiceIds();
  }
};

const updateServiceIds = () => {
  form.serviceIds = [];
  Object.keys(serviceQuantities).forEach(serviceId => {
    const quantity = serviceQuantities[serviceId] || 0;
    for (let i = 0; i < quantity; i++) form.serviceIds.push(serviceId);
  });
};

const handleServiceChange = (newValue) => {
  Object.keys(serviceQuantities).forEach(serviceId => {
    if (!newValue.includes(serviceId)) delete serviceQuantities[serviceId];
  });
  newValue.forEach(serviceId => initializeServiceQuantity(serviceId));
  updateServiceIds();
};

const removeServiceId = (sid) => {
  delete serviceQuantities[sid];
  updateServiceIds();
};

const uniqueServiceIds = computed(() => [...new Set(form.serviceIds)]);

const totalAmount = computed(() => form.serviceIds.reduce((sum, sid) => {
  const s = serviceMap.value.get(sid);
  return s ? sum.plus(new Decimal(s.standardPrice)) : sum;
}, new Decimal(0)));

const discountableAmount = computed(() => form.serviceIds.reduce((sum, sid) => {
  const s = serviceMap.value.get(sid);
  return (s && !s.noDiscount) ? sum.plus(new Decimal(s.standardPrice)) : sum;
}, new Decimal(0)));

const noDiscountAmount = computed(() => form.serviceIds.reduce((sum, sid) => {
  const s = serviceMap.value.get(sid);
  return (s && s.noDiscount) ? sum.plus(new Decimal(s.standardPrice)) : sum;
}, new Decimal(0)));

const availableCards = computed(() => {
  if (!selectedMember.value || !Array.isArray(selectedMember.value.cards)) return [];
  return selectedMember.value.cards
    .filter(c => c.status === 'ACTIVE' && new Decimal(c.balance).gt(0))
    .sort((a, b) => new Decimal(a.balance).minus(new Decimal(b.balance)).toNumber());
});

const getCardDiscountRate = (card) => {
  if (card.discountSource === 'custom' && card.customDiscountRate) {
    return toDecimal(card.customDiscountRate);
  }
  return toDecimal(card.cardType.discountRate);
};

const paymentPlan = computed(() => {
  if (cartItems.value.length === 0 || !selectedMember.value) {
    return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
  }
  if (form.paymentMethod !== PAYMENT_METHODS.MEMBER_CARD) {
    return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
  }

  if (cardPaymentMode.value === 'manual') {
    if (!form.cardId) return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
    const card = availableCards.value.find(c => c.id === form.cardId);
    if (!card) return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };

    const discountableDeduction = discountableAmount.value.times(card.cardType.discountRate);
    const totalDeduction = discountableDeduction.plus(noDiscountAmount.value);

    if (new Decimal(card.balance).lessThan(totalDeduction)) {
      return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0), error: '余额不足' };
    }

    const discountAmount = discountableAmount.value.minus(discountableDeduction);
    return {
      paymentDetails: [{
        cardName: getCardDisplayName(card),
        discountRate: getCardDiscountRate(card),
        originalAmountCovered: totalAmount.value,
        deduction: totalDeduction,
        discountAmount: discountAmount,
      }],
      actualPaidAmount: totalDeduction,
      discountAmount: discountAmount,
      isPayable: true,
    };
  }

  // 自动模式
  if (manualPriceAdjustment.isActive && manualPriceAdjustment.adjustedAmount !== null) {
    const targetAmount = new Decimal(manualPriceAdjustment.adjustedAmount);
    const totalBalance = availableCards.value.reduce((sum, card) => sum.plus(new Decimal(card.balance)), new Decimal(0));
    if (totalBalance.lessThan(targetAmount)) {
      return {
        paymentDetails: [],
        actualPaidAmount: targetAmount,
        discountAmount: new Decimal(0),
        error: `所有会员卡余额不足，总余额 ¥${totalBalance.toFixed(2)}，需支付 ¥${targetAmount.toFixed(2)}`
      };
    }
    return {
      paymentDetails: [{
        cardName: '多卡组合',
        discountRate: new Decimal(1),
        originalAmountCovered: targetAmount,
        deduction: targetAmount,
        discountAmount: new Decimal(0),
      }],
      actualPaidAmount: targetAmount,
      discountAmount: totalAmount.value.minus(targetAmount),
      isPayable: true,
    };
  }

  let remainingDiscountableAmount = discountableAmount.value;
  let remainingNoDiscountAmount = noDiscountAmount.value;
  let totalPaid = new Decimal(0);
  const paymentDetails = [];

  for (const card of availableCards.value) {
    if (remainingDiscountableAmount.isZero() && remainingNoDiscountAmount.isZero()) break;

    const cardBalance = new Decimal(card.balance);
    const discountRate = getCardDiscountRate(card);
    let cardUsed = new Decimal(0);
    let originalAmountCovered = new Decimal(0);
    let discountAmount = new Decimal(0);

    if (!remainingNoDiscountAmount.isZero()) {
      const noDiscountPayment = Decimal.min(remainingNoDiscountAmount, cardBalance);
      cardUsed = cardUsed.plus(noDiscountPayment);
      originalAmountCovered = originalAmountCovered.plus(noDiscountPayment);
      remainingNoDiscountAmount = remainingNoDiscountAmount.minus(noDiscountPayment);
    }

    if (!remainingDiscountableAmount.isZero() && cardUsed.lessThan(cardBalance)) {
      const remainingBalance = cardBalance.minus(cardUsed);
      const maxDiscountableAmount = remainingBalance.div(discountRate);
      const discountablePayment = Decimal.min(remainingDiscountableAmount, maxDiscountableAmount);
      const discountableDeduction = discountablePayment.times(discountRate);
      const roundedDeduction = new Decimal(roundToTwoDecimals(discountableDeduction.toNumber()));

      cardUsed = cardUsed.plus(roundedDeduction);
      originalAmountCovered = originalAmountCovered.plus(discountablePayment);
      discountAmount = discountAmount.plus(discountablePayment.minus(roundedDeduction));
      remainingDiscountableAmount = remainingDiscountableAmount.minus(discountablePayment);
    }

    if (originalAmountCovered.gt(0)) {
      totalPaid = totalPaid.plus(cardUsed);
      paymentDetails.push({
        cardName: getCardDisplayName(card),
        discountRate: discountRate,
        originalAmountCovered: originalAmountCovered,
        deduction: cardUsed,
        discountAmount: discountAmount,
      });
    }
  }

  if (!remainingDiscountableAmount.isZero() || !remainingNoDiscountAmount.isZero()) {
    const remaining = remainingDiscountableAmount.plus(remainingNoDiscountAmount);
    return { paymentDetails, actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0), error: `所有会员卡余额不足，仍有 ¥${remaining.toFixed(2)} 未支付` };
  }

  return {
    paymentDetails,
    actualPaidAmount: totalPaid,
    discountAmount: totalAmount.value.minus(totalPaid),
    isPayable: true,
  };
});

const displayActualPaidAmount = computed(() => {
  if (manualPriceAdjustment.isActive && manualPriceAdjustment.adjustedAmount !== null) {
    return new Decimal(manualPriceAdjustment.adjustedAmount);
  }
  if (form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && selectedMember.value && availableCards.value.length > 0) {
    const card = form.cardId ? availableCards.value.find(c => c.id === form.cardId) : availableCards.value[0];
    if (card) {
      const discountRate = getCardDiscountRate(card);
      return discountableAmount.value.times(discountRate).plus(noDiscountAmount.value);
    }
  }
  return new Decimal(paymentPlan.value.actualPaidAmount || 0);
});

const displayDiscountAmount = computed(() => {
  if (form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && selectedMember.value && availableCards.value.length > 0) {
    const card = form.cardId ? availableCards.value.find(c => c.id === form.cardId) : availableCards.value[0];
    if (card) {
      const discountRate = getCardDiscountRate(card);
      return discountableAmount.value.minus(discountableAmount.value.times(discountRate));
    }
  }
  return new Decimal(paymentPlan.value.discountAmount || 0);
});

const adjustmentDifferenceText = computed(() => {
  const dialogAmount = priceAdjustmentDialog.newAmount || priceConfirmDialog.newAmount;
  if (!dialogAmount) return '';
  const originalAmount = new Decimal(paymentPlan.value.actualPaidAmount || 0);
  const newAmount = new Decimal(dialogAmount);
  const difference = newAmount.minus(originalAmount);
  if (difference.isZero()) return '无变化';
  if (difference.isPositive()) return `增加 ¥${difference.toFixed(2)}`;
  return `减少 ¥${difference.abs().toFixed(2)}`;
});

const isCheckoutReady = computed(() => {
  if (cartItems.value.length === 0) return false;
  if (form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD) {
    if (!selectedMember.value) return false;
    if (manualPriceAdjustment.isActive && manualPriceAdjustment.adjustedAmount !== null) {
      if (cardPaymentMode.value === 'manual' && form.cardId) {
        const card = availableCards.value.find(c => c.id === form.cardId);
        return card && manualPriceAdjustment.adjustedAmount <= parseFloat(card.balance);
      }
      const totalBalance = availableCards.value.reduce((sum, card) => sum + parseFloat(card.balance), 0);
      return manualPriceAdjustment.adjustedAmount <= totalBalance;
    }
    if (paymentPlan.value.error) return false;
  }
  return true;
});

// --- 事件 ---
const handleMemberSelect = (item) => {
  form.memberId = item.id;
  selectedMember.value = item;
  form.paymentMethod = availableCards.value.length > 0 ? PAYMENT_METHODS.MEMBER_CARD : PAYMENT_METHODS.CASH;
};

const clearMember = () => {
  Object.assign(form, getInitialForm());
  memberQuery.value = '';
  selectedMember.value = null;
  cardPaymentMode.value = 'auto';
};

// --- 价格调整 ---
const openPriceAdjustmentDialog = () => {
  priceAdjustmentDialog.visible = true;
  priceAdjustmentDialog.newAmount = parseFloat(displayActualPaidAmount.value.toFixed(2));
};

const confirmPriceAdjustment = () => {
  if (!priceAdjustmentDialog.newAmount || priceAdjustmentDialog.newAmount < 0) {
    ElMessage.error('请输入有效的调整金额');
    return;
  }
  priceAdjustmentDialog.visible = false;
  priceConfirmDialog.visible = true;
  priceConfirmDialog.newAmount = priceAdjustmentDialog.newAmount;
  priceConfirmDialog.reason = '';
};

const applyPriceAdjustment = () => {
  if (!priceConfirmDialog.reason?.trim()) {
    ElMessage.error('请输入价格调整原因');
    return;
  }
  manualPriceAdjustment.isActive = true;
  manualPriceAdjustment.adjustedAmount = priceConfirmDialog.newAmount;
  manualPriceAdjustment.reason = priceConfirmDialog.reason.trim();
  priceConfirmDialog.visible = false;

  const originalAmount = new Decimal(paymentPlan.value.actualPaidAmount || 0);
  const newAmount = new Decimal(priceConfirmDialog.newAmount);
  const difference = newAmount.minus(originalAmount);

  if (difference.isPositive()) {
    ElMessage.success(`价格已调整，增加 ¥${difference.toFixed(2)}`);
  } else if (difference.isNegative()) {
    ElMessage.success(`价格已调整，减少 ¥${difference.abs().toFixed(2)}`);
  } else {
    ElMessage.info('价格无变化');
  }
};

const resetForm = async () => {
  clearMember();
  form.serviceIds = [];
  form.notes = '';
  form.appointmentId = null;
  form.transactionTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  form.isManualTime = false;
  manualPriceAdjustment.isActive = false;
  manualPriceAdjustment.adjustedAmount = null;
  manualPriceAdjustment.reason = '';
  Object.keys(serviceQuantities).forEach(key => delete serviceQuantities[key]);
  const defaultService = serviceList.value.find(s => s.sortOrder === 0 && s.status === 'AVAILABLE');
  if (defaultService) {
    form.serviceIds = [defaultService.id];
    initializeServiceQuantity(defaultService.id);
  }
  const defaultStaff = allStaff.value.find(s => s.sortOrder === 0 && s.countsCommission);
  if (defaultStaff) form.staffId = defaultStaff.id;
  await fetchTodayTransactions();
};

const getServiceDiscountText = (service) => {
  if (!selectedMember.value || form.paymentMethod !== PAYMENT_METHODS.MEMBER_CARD) {
    return '原价 ¥' + new Decimal(service.standardPrice).toFixed(2);
  }
  if (service.noDiscount) {
    return '无折扣 ¥' + new Decimal(service.standardPrice).toFixed(2);
  }
  const bestCard = availableCards.value.length > 0 ? availableCards.value[0] : null;
  if (bestCard) {
    const discountRate = new Decimal(bestCard.cardType.discountRate);
    const discountedPrice = new Decimal(service.standardPrice).times(discountRate);
    const rate = parseFloat(bestCard.cardType.discountRate) * 10;
    const display = rate % 1 === 0 ? Math.round(rate) : rate.toFixed(1);
    return `${display}折 ¥${discountedPrice.toFixed(2)}`;
  }
  return '原价 ¥' + new Decimal(service.standardPrice).toFixed(2);
};

const handleCheckout = async () => {
  if (!isCheckoutReady.value) {
    ElMessage.warning(paymentPlan.value.error || '请检查开单信息是否完整');
    return;
  }
  isSubmitting.value = true;
  try {
    const submitData = { ...form };
    if (!form.memberId && memberQuery.value && memberQuery.value.trim()) {
      submitData.customerName = memberQuery.value.trim();
    }
    if (form.transactionTime && form.isManualTime) {
      submitData.customTransactionTime = form.transactionTime;
      submitData.notes = `[手动设置时间] ${submitData.notes || ''}`.trim();
    }
    if (manualPriceAdjustment.isActive) {
      submitData.manualPriceAdjustment = {
        adjustedAmount: manualPriceAdjustment.adjustedAmount,
        reason: manualPriceAdjustment.reason
      };
    }

    let apiCall;
    if (form.paymentMethod === PAYMENT_METHODS.MEMBER_CARD && cardPaymentMode.value === 'auto') {
      apiCall = createMultiCardTransaction(submitData);
    } else {
      apiCall = createTransaction(submitData);
    }
    await apiCall;
    ElMessage.success('结算成功！');
    await resetForm();
    await fetchTodayTransactions();
  } catch (error) {
    console.error('结算失败:', error);
    ElMessage.error('结算失败，请重试');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style>
/* 全局：会员搜索下拉框样式（弹窗渲染在 body） */
.member-autocomplete-popper {
  overflow: hidden !important;
}
.member-autocomplete-popper ul { padding: 0 !important; }
.member-autocomplete-popper li { overflow: hidden !important; }
.member-autocomplete-popper .suggestion-item {
  max-width: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}
.member-autocomplete-popper .suggestion-info {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.member-autocomplete-popper .suggestion-tags {
  flex-shrink: 1 !important;
  flex-wrap: wrap !important;
  overflow: hidden !important;
}
@media (max-width: 768px) {
  .member-autocomplete-popper li {
    padding: 10px 12px !important;
    margin: 0 !important;
    position: relative !important;
    line-height: 1.4 !important;
  }
  .member-autocomplete-popper li:not(:last-child)::after {
    content: '' !important;
    position: absolute !important;
    left: 12px !important;
    right: 12px !important;
    bottom: 0 !important;
    height: 1px !important;
    background: linear-gradient(to right, transparent, #e4e7ed, transparent) !important;
  }
  .member-autocomplete-popper .suggestion-item {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 4px !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .member-autocomplete-popper .suggestion-info,
  .member-autocomplete-popper .suggestion-tags {
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 15px;
}
.page-title { font-size: 22px; margin: 0; color: #303133; }
.panel-title { font-size: 18px; margin: 0 0 20px 0; color: #303133; }
.panel-title-right { font-size: 18px; margin: 0 0 20px 0; color: #303133; }
.right-panel { background-color: #fafafa; padding: 20px; border-radius: 6px; }

.summary { display: flex; flex-direction: column; gap: 15px; font-size: 16px; }
.summary-item { display: flex; justify-content: space-between; }
.discount-text { color: #f56c6c; }
.discount-label { color: #303133; }

.service-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.service-name { font-weight: 500; }
.service-discount-info { display: flex; align-items: center; }
.discount-tag { font-size: 11px; border-radius: 4px; }

.total { font-weight: bold; font-size: 18px; }
.total-price { color: #e6a23c; font-size: 22px; }

.total-price-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.price-adjustment-controls { display: flex; justify-content: flex-end; }
.adjustment-button { font-size: 12px; }

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.suggestion-info { flex-grow: 1; }
.suggestion-tags { display: flex; gap: 5px; flex-shrink: 0; margin-left: 15px; }

.payment-plan-preview {
  margin-top: 20px;
  font-size: 14px;
}
.plan-card-detail {
  padding: 10px;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 10px;
}
.plan-card-header {
  display: flex;
  align-items: center;
  font-weight: 500;
  color: #303133;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e4e7ed;
  margin-bottom: 8px;
}
.plan-card-header .el-icon {
  margin-right: 6px;
  color: var(--el-color-primary);
}
.plan-card-body {
  display: flex;
  justify-content: space-between;
  color: #909399;
  font-size: 13px;
}
.plan-card-body .deduction {
  font-weight: 500;
  color: #f56c6c;
}

.quantity-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.service-tag {
  margin: 2px 4px 2px 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.service-tag-qty {
  background-color: #f56c6c;
  color: #fff;
  border-radius: 8px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 16px;
  font-weight: bold;
}
.quantity-number {
  min-width: 24px;
  text-align: center;
  font-weight: 500;
  color: #303133;
}
.quantity-highlight {
  color: #f56c6c !important;
  font-weight: bold;
}

/* 撤销对话框样式 */
.void-info {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
}
.void-info .info-row {
  display: flex;
  margin-bottom: 8px;
}
.void-info .info-row:last-child { margin-bottom: 0; }
.void-info .label {
  color: #909399;
  width: 80px;
  flex-shrink: 0;
}
.void-info .amount {
  font-weight: 600;
  color: #f56c6c;
}

@media (max-width: 992px) {
  .right-panel { margin-top: 20px; }
}
@media (max-width: 768px) {
  :deep(.el-radio-group) {
    display: flex !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
  }
  :deep(.el-radio-group .el-radio-button) {
    flex: 1 !important;
    min-width: 0 !important;
    margin: 0 !important;
  }
  :deep(.el-radio-group .el-radio-button__inner) {
    width: 100% !important;
    padding: 8px 2px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }
}
</style>
