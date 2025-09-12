<template>
  <div class="page-content">
    <!-- 头部区域 -->
    <div class="page-header">
      <h2 class="page-title">收银 · 结算</h2>
    </div>

    <!-- 主体布局 -->
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
            <span class="suggestion-info">
              {{ item.name }} ({{ item.phone }})
            </span>
            <div class="suggestion-tags">
              <el-tag :type="memberStatusTagType(item.status)" size="small" effect="plain">{{ memberStatusText(item.status) }}</el-tag>
              
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
              v-model="uniqueServiceIds"
              multiple
              filterable
              placeholder="请选择服务项目"
              size="large"
              style="width: 100%"
              @change="handleServiceChange"
              class="service-select-with-badge"
            >
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
              <el-radio-button value="CASH">现金</el-radio-button>
              <el-radio-button value="WECHAT_PAY">微信</el-radio-button>
              <el-radio-button value="ALIPAY">支付宝</el-radio-button>
              <el-radio-button value="DOUYIN">抖音</el-radio-button>
              <el-radio-button value="MEITUAN">美团</el-radio-button>
              <el-radio-button value="MEMBER_CARD" :disabled="!form.memberId">会员卡</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-show="form.paymentMethod === 'MEMBER_CARD'" label="会员卡支付模式">
            <el-radio-group v-model="cardPaymentMode" size="default">
              <el-radio-button value="auto">自动选择</el-radio-button>
              <el-radio-button value="manual">手动选择</el-radio-button>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item v-show="form.paymentMethod === 'MEMBER_CARD' && cardPaymentMode === 'manual'" label="选择会员卡">
            <el-select v-model="form.cardId" placeholder="请选择会员卡" size="large" style="width: 100%">
              <el-option
                v-for="card in availableCards"
                :key="card.id"
                :label="`${getCardDisplayName(card)} (余额: ${formatCurrency(card.balance)}, ${formatDiscountRate(getCardDiscountRate(card))})`"
                :value="card.id"
              />
            </el-select>
          </el-form-item>
          
          <!-- 交易时间选择 -->
          <el-form-item label="交易时间">
            <el-date-picker
              v-model="form.transactionTime"
              type="datetime"
              placeholder="选择交易时间"
              size="large"
              style="width: 100%"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              @change="onTransactionTimeChange"
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
          <el-empty description="请从左侧选择服务项目" />
        </div>

        <div v-else>
          <el-table :data="cartItems" style="width: 100%">
            <el-table-column label="项目名称" min-width="180">
              <template #default="{ row }">
                <div class="service-item">
                  <span class="service-name">{{ row.name }}</span>
                  <div class="service-discount-info" v-if="form.paymentMethod === 'MEMBER_CARD' && selectedMember">
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
                  <el-button
                    size="small"
                    :icon="Minus"
                    circle
                    @click="decreaseQuantity(row.id)"
                    :disabled="row.quantity <= 1"
                  />
                  <span 
                    class="quantity-number"
                    :class="{ 'quantity-highlight': row.quantity > 1 }"
                  >{{ row.quantity }}</span>
                  <el-button
                    size="small"
                    :icon="Plus"
                    circle
                    @click="increaseQuantity(row.id)"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="standardPrice" label="价格" width="80" align="right">
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
                  <el-button 
                    text
                    size="small" 
                    type="warning"
                    @click="openPriceAdjustmentDialog"
                    class="adjustment-button"
                  >
                    价格调整
                    <el-icon style="margin-left: 4px;"><Edit /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 核心修改1：支付方案预览UI更新 -->
          <div v-if="form.paymentMethod === 'MEMBER_CARD' && paymentPlan.paymentDetails.length > 0" class="payment-plan-preview">
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
<div class="today-records">
    <div class="page-header">
      <h2 class="page-title">消费记录</h2>
    </div>
    <div class="transaction-table-container">
      <el-table :data="todayTransactions" stripe class="today-table" style="width: 100%">
        <el-table-column prop="member.name" label="姓名" width="100">
          <template #default="{ row }">{{ row.member?.name || row.customerName || '非会员用户' }}</template>
        </el-table-column>
        
        <el-table-column label="会员卡" width="200">
          <template #default="{ row }">
            <!-- 多卡支付显示所有卡片 -->
            <div v-if="row.member && isMultiCardPayment(row)" class="multi-card-list">
              <div v-for="cardInfo in getMultiCardList(row)" :key="cardInfo.name" class="card-item">
                <el-tag type="warning" size="small">{{ cardInfo.name }}</el-tag>
              </div>
            </div>
            <!-- 单卡支付 -->
            <el-tag v-else-if="row.member && row.cardUsed" type="primary" size="small">
              {{ row.cardDisplayName || row.cardUsed.cardType?.name || '会员卡' }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="服务项目">
          <template #default="{ row }">
            <el-tooltip 
              v-if="row.transactionType === 'PENDING'"
              :content="row.summary"
              placement="top"
              effect="dark"
            >
              <span class="pending-record">
                {{ row.summary }}
              </span>
            </el-tooltip>
            <el-tooltip 
              v-else-if="row.transactionType === 'PENDING_CLEAR'" 
              :content="getBatchClearTooltip(row)" 
              placement="top"
              :disabled="!isBatchClear(row)"
            >
              <span class="clear-record">
                {{ row.summary }}
              </span>
            </el-tooltip>
            <el-tooltip
              v-else
              :content="formatServiceItems(row.items) || row.summary || '项目消费'"
              placement="top"
              effect="dark"
            >
              <span class="service-items-text">
                {{ formatServiceItems(row.items) || row.summary || '项目消费' }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column label="数量" width="60" align="center">
          <template #default="{ row }">
            <span v-if="row.items && row.items.length > 0">
              {{ row.items.reduce((sum, item) => sum + (item.quantity || 1), 0) }}
            </span>
            <span v-else>1</span>
          </template>
        </el-table-column>
        
        <el-table-column label="应付金额" width="90" align="right">
          <template #default="{ row }">{{ formatCurrency(row.totalAmount) }}</template>
        </el-table-column>
        
        <el-table-column label="折扣" width="180" align="left">
          <template #default="{ row }">
            <div>
              <!-- 价格调整信息（优先显示） -->
              <div v-if="row.manualAdjustment">
                <el-tag type="warning" size="small">{{ getAdjustmentText(row) }}</el-tag>
                <div class="adjustment-reason" v-if="getAdjustmentReason(row)">
                  {{ getAdjustmentReason(row) }}
                </div>
              </div>
              
              <!-- 多卡支付信息（与价格调整不互斥） -->
              <div v-if="row.member && isMultiCardPayment(row)" class="multi-card-payment" :class="{ 'mt-2': row.manualAdjustment }">
                <el-tag type="warning" size="small" class="multi-card-tag">
                  <el-icon><CreditCard /></el-icon>
                  多卡 {{ getAverageDiscountDisplay(row) }}折
                </el-tag>
                <div class="multi-card-details">
                  {{ getMultiCardDetails(row) }}
                </div>
              </div>
              
              <!-- 单卡支付（只在非多卡且非价格调整时显示） -->
              <div v-else-if="row.member && parseFloat(row.discountAmount) > 0 && !row.manualAdjustment && !isMultiCardPayment(row)">
                <!-- 单卡支付：有cardUsed信息 -->
                <div v-if="row.cardUsed">
                  <el-tag type="primary" size="small">
                    {{ getCardDiscountDisplay(row.cardUsed.cardType?.discountRate) }}折 {{ formatCurrency(row.discountAmount) }}
                  </el-tag>
                </div>
                <!-- 单卡支付：通过智能接口但没有cardUsed信息 -->
                <div v-else>
                  <el-tag type="primary" size="small">
                    {{ getSingleCardDiscountDisplay(row) }}
                  </el-tag>
                </div>
              </div>
              
              <!-- 无折扣信息时显示 -->
              <span v-if="!row.manualAdjustment && (!row.member || parseFloat(row.discountAmount) <= 0)">-</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="实付金额" width="90" align="right">
          <template #default="{ row }">
            <span 
              :class="{
                'paid-amount': true,
                'pending-amount': row.transactionType === 'PENDING',
                'clear-amount': row.transactionType === 'PENDING_CLEAR'
              }"
            >
              ¥{{ formatAmount(row.actualPaidAmount) }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="transactionTime" label="时间" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip
              :content="getTimeTooltip(row)"
              placement="top"
              effect="dark"
            >
              <span :class="{ 'manual-time': isManualTime(row) }">
                <el-icon v-if="isManualTime(row)" style="margin-right: 4px;"><Edit /></el-icon>
                {{ formatShortDateInAppTimeZone(row.transactionTime) }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页加载更多区域 -->
      <div class="pagination-section">
        <div v-if="transactionPagination.hasMore" class="load-more-container">
          <el-button 
            @click="loadMoreTransactions" 
            :loading="isLoadingMore"
            type="primary"
            size="small"
            style="padding: 12px 24px; border-radius: 6px;"
          >
            {{ isLoadingMore ? '加载中...' : `加载更多 (已显示 ${todayTransactions.length}/${transactionPagination.total} 条)` }}
          </el-button>
        </div>
        <div v-else-if="todayTransactions.length > 0" class="all-loaded">
          已显示全部 {{ transactionPagination.total }} 条记录
        </div>
      </div>
    </div>
</div>

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
            <div style="color: #E6A23C; font-weight: bold;">
              {{ adjustmentDifferenceText }}
            </div>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { useTransactionStore } from '@/stores/transaction';
import { getMembers } from '@/api/member.js';
import { getServiceList } from '@/api/service.js';
import { getStaffList } from '@/api/staff.js';
import { createTransaction, getTodayTransactions, createComboCheckout, createMultiCardTransaction } from '@/api/transaction.js';
import { CreditCard, Plus, Minus, Edit } from '@element-plus/icons-vue';
import Decimal from 'decimal.js';
import { ElMessage } from 'element-plus';
import { formatAmount, formatCurrency, formatDiscountRate, toDecimal } from '@/utils/currency.js';

// 四舍五入到两位小数的工具函数
const roundToTwoDecimals = (value) => {
  return Math.round(value * 100) / 100;
};

// 格式化服务项目名称，添加数量标记，使用顿号分隔
const formatServiceItems = (items) => {
  if (!items || items.length === 0) return '';
  
  return items.map(item => {
    const quantity = item.quantity || 1;
    const serviceName = item.service.name;
    // 如果数量大于1，添加*n标记
    return quantity > 1 ? `${serviceName}*${quantity}` : serviceName;
  }).join('、'); // 使用顿号分隔
};
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';
import { formatInAppTimeZone, formatShortDateInAppTimeZone, formatFullDateTimeInAppTimeZone } from '@/utils/date.js';

// --- 状态定义 ---
const formRef = ref(null);
const memberQuery = ref('');
const serviceList = ref([]);
const allStaff = ref([]);
const selectedMember = ref(null);
const isSubmitting = ref(false);
const todayTransactions = ref([]);
const transactionPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  hasMore: true
});
const isLoadingMore = ref(false);
const cardPaymentMode = ref('auto');
const transactionStore = useTransactionStore();

// 价格调整对话框状态
const priceAdjustmentDialog = reactive({
  visible: false,
  newAmount: null
});

// 价格调整确认对话框状态
const priceConfirmDialog = reactive({
  visible: false,
  newAmount: null,
  reason: ''
});

// 手动价格调整状态
const manualPriceAdjustment = reactive({
  isActive: false,
  adjustedAmount: null,
  reason: ''
});

// --- 表单数据 ---
const getInitialForm = () => ({
    appointmentId: null,
    memberId: null,
    customerName: null,
    serviceIds: [],
    staffId: null,
    paymentMethod: 'CASH',
    cardId: null,
    notes: '',
    transactionTime: new Date().toISOString().slice(0, 19).replace('T', ' '), // 默认当前时间，格式化为YYYY-MM-DD HH:mm:ss
    isManualTime: false, // 标记是否手动选择了时间
});
const form = reactive(getInitialForm());

onMounted(() => {
  const appointmentData = transactionStore.consumeAppointmentToCheckout();
  if (appointmentData) {
    form.appointmentId = appointmentData.appointmentId;
    form.serviceIds = appointmentData.serviceIds;
    if(appointmentData.memberId) {
      handleMemberSelect({
          id: appointmentData.memberId,
          name: appointmentData.customerName,
          phone: appointmentData.customerPhone,
      });
      memberQuery.value = `${appointmentData.customerName} (${appointmentData.customerPhone})`;
    }
  }

  fetchServices().then(() => {
    // 设置默认选中排序为0的服务
    if (!appointmentData && form.serviceIds.length === 0) {
      const defaultService = serviceList.value.find(service => service.sortOrder === 0 && service.status === 'AVAILABLE');
      if (defaultService) {
        form.serviceIds = [defaultService.id];
        initializeServiceQuantity(defaultService.id);
      }
    }
    // 等待服务列表加载完成后更新角标
    updateTagBadges();
  });
  fetchStaff().then(() => {
    // 设置默认选中排序为0的员工
    if (!appointmentData && !form.staffId) {
      const defaultStaff = allStaff.value.find(staff => staff.sortOrder === 0 && staff.countsCommission);
      if (defaultStaff) {
        form.staffId = defaultStaff.id;
      }
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
      // 检测是否为手动调整：notes包含"价格调整："
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
    
  } catch(error) {
    console.error("获取当日消费记录失败:", error);
    if (reset) {
      todayTransactions.value = [];
    }
  }
};
const queryMembersAsync = async (queryString, cb) => {
  if (!queryString) return cb([]);
  const { data } = await getMembers({ search: queryString, limit: 20, includeCards: true });
  cb(data.map(m => ({ ...m, value: `${m.name} (${m.phone})` }))); 
};

// 加载更多交易记录
const loadMoreTransactions = async () => {
  if (isLoadingMore.value || !transactionPagination.value.hasMore) return;
  
  isLoadingMore.value = true;
  transactionPagination.value.page++;
  await fetchTodayTransactions(false);
  isLoadingMore.value = false;
};

// --- 计算属性 ---
const commissionableStaff = computed(() => 
  allStaff.value
    .filter(staff => staff.countsCommission)
    .sort((a, b) => a.sortOrder - b.sortOrder)
);

// 排序后的服务列表
const sortedServiceList = computed(() => {
  return [...serviceList.value].sort((a, b) => {
    // 按sortOrder从小到大排序
    return a.sortOrder - b.sortOrder;
  });
});
// 服务数量映射
const serviceQuantities = reactive({});

// 时间变化处理函数
const onTransactionTimeChange = (value) => {
  // 判断是否手动选择了时间（与当前时间相差超过1分钟即认为是手动选择）
  const now = new Date();
  const selectedTime = new Date(value);
  const timeDifference = Math.abs(now - selectedTime);
  form.isManualTime = timeDifference > 60000; // 1分钟 = 60000毫秒
};

const cartItems = computed(() => {
  const uniqueServiceIds = [...new Set(form.serviceIds)];
  return uniqueServiceIds.map(serviceId => {
    const service = serviceList.value.find(s => s.id === serviceId);
    if (service) {
      const quantity = serviceQuantities[serviceId] || 1;
      return {
        ...service,
        quantity: quantity
      };
    }
    return null;
  }).filter(Boolean);
});

// 初始化服务数量
const initializeServiceQuantity = (serviceId) => {
  if (!serviceQuantities[serviceId]) {
    serviceQuantities[serviceId] = 1;
  }
};

// 增加服务数量
const increaseQuantity = (serviceId) => {
  if (!serviceQuantities[serviceId]) {
    serviceQuantities[serviceId] = 1;
  }
  serviceQuantities[serviceId]++;
  updateServiceIds();
};

// 减少服务数量
const decreaseQuantity = (serviceId) => {
  if (serviceQuantities[serviceId] && serviceQuantities[serviceId] > 1) {
    serviceQuantities[serviceId]--;
    updateServiceIds();
  }
};

// 根据数量更新serviceIds数组（用于后端接口）
const updateServiceIds = () => {
  form.serviceIds = [];
  Object.keys(serviceQuantities).forEach(serviceId => {
    const quantity = serviceQuantities[serviceId] || 0;
    for (let i = 0; i < quantity; i++) {
      form.serviceIds.push(serviceId);
    }
  });
};

// 处理下拉框选择变化
const handleServiceChange = (newValue) => {
  // 移除未选中的服务
  Object.keys(serviceQuantities).forEach(serviceId => {
    if (!newValue.includes(serviceId)) {
      delete serviceQuantities[serviceId];
    }
  });
  
  // 初始化新选中的服务
  newValue.forEach(serviceId => {
    initializeServiceQuantity(serviceId);
  });
  
  updateServiceIds();
};

// 当前选中的唯一服务ID列表
const uniqueServiceIds = computed(() => {
  return [...new Set(form.serviceIds)];
});

// 获取服务名称
const getServiceName = (serviceId) => {
  const service = serviceList.value.find(s => s.id === serviceId);
  return service ? service.name : '';
};

// 获取服务数量
const getServiceQuantity = (serviceId) => {
  return serviceQuantities[serviceId] || 1;
};

// 更新标签角标
const updateTagBadges = async () => {
  await nextTick();
  
  // 移除已有的角标
  document.querySelectorAll('.service-quantity-badge').forEach(badge => {
    badge.remove();
  });
  
  // 为每个选中的标签添加角标
  const selectedItems = document.querySelectorAll('.service-select-with-badge .el-select__selected-item');
  
  selectedItems.forEach((item, index) => {
    const serviceId = uniqueServiceIds.value[index];
    if (serviceId) {
      const quantity = getServiceQuantity(serviceId);
      if (quantity > 1) {
        const badge = document.createElement('span');
        badge.className = 'service-quantity-badge';
        badge.textContent = quantity;
        badge.style.cssText = `
          position: absolute;
          top: -8px;
          right: -8px;
          background-color: #f56c6c;
          color: white;
          border-radius: 10px;
          padding: 0 6px;
          font-size: 12px;
          line-height: 20px;
          height: 20px;
          min-width: 20px;
          text-align: center;
          z-index: 10;
          font-weight: bold;
        `;
        item.style.position = 'relative';
        item.appendChild(badge);
      }
    }
  });
};

// 监听数量变化
watch(serviceQuantities, () => {
  updateTagBadges();
}, { deep: true });

// 监听服务选择变化
watch(uniqueServiceIds, () => {
  updateTagBadges();
});

const totalAmount = computed(() => {
  return form.serviceIds.reduce((sum, serviceId) => {
    const service = serviceList.value.find(s => s.id === serviceId);
    return service ? sum.plus(new Decimal(service.standardPrice)) : sum;
  }, new Decimal(0));
});

// 计算可折扣金额（排除无折扣服务）
const discountableAmount = computed(() => {
  return form.serviceIds.reduce((sum, serviceId) => {
    const service = serviceList.value.find(s => s.id === serviceId);
    return (service && !service.noDiscount) ? sum.plus(new Decimal(service.standardPrice)) : sum;
  }, new Decimal(0));
});

// 计算无折扣金额
const noDiscountAmount = computed(() => {
  return form.serviceIds.reduce((sum, serviceId) => {
    const service = serviceList.value.find(s => s.id === serviceId);
    return (service && service.noDiscount) ? sum.plus(new Decimal(service.standardPrice)) : sum;
  }, new Decimal(0));
});

const availableCards = computed(() => {
  if (!selectedMember.value || !Array.isArray(selectedMember.value.cards)) {
    return [];
  }
  return selectedMember.value.cards
    .filter(card => card.status === 'ACTIVE' && new Decimal(card.balance).gt(0))
    .sort((a, b) => {
      // 新逻辑：按余额从小到大排序（优先清空小余额卡）
      return new Decimal(a.balance).minus(new Decimal(b.balance)).toNumber();
    });
});

// 获取卡片显示名称（区分自定义面值卡）
const getCardDisplayName = (card) => {
  if (card.isCustomCard && card.customAmount) {
    return `自定义面值卡(¥${formatAmount(card.customAmount)})`;
  }
  return card.cardType.name;
};

// 获取卡片有效折扣率
const getCardDiscountRate = (card) => {
  if (card.discountSource === 'custom' && card.customDiscountRate) {
    return toDecimal(card.customDiscountRate);
  }
  return toDecimal(card.cardType.discountRate);
};

// --- 核心修改2：paymentPlan 计算属性增强 ---
const paymentPlan = computed(() => {
  if (cartItems.value.length === 0 || !selectedMember.value) {
    return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
  }
  
  if (form.paymentMethod !== 'MEMBER_CARD') {
    return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
  }

  if (cardPaymentMode.value === 'manual') {
    if (!form.cardId) return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
    const card = availableCards.value.find(c => c.id === form.cardId);
    if (!card) return { paymentDetails: [], actualPaidAmount: totalAmount.value, discountAmount: new Decimal(0) };
    
    // 只对可折扣的服务应用折扣，无折扣服务保持原价
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

  // 自动模式 - 先处理无折扣服务，再处理可折扣服务
  // 检查是否有手动价格调整
  let targetAmount = totalAmount.value;
  if (manualPriceAdjustment.isActive && manualPriceAdjustment.adjustedAmount !== null) {
    targetAmount = new Decimal(manualPriceAdjustment.adjustedAmount);
    // 如果有价格调整，直接检查总余额是否足够
    const totalBalance = availableCards.value.reduce((sum, card) => sum.plus(new Decimal(card.balance)), new Decimal(0));
    if (totalBalance.lessThan(targetAmount)) {
      return { 
        paymentDetails: [], 
        actualPaidAmount: targetAmount, 
        discountAmount: new Decimal(0), 
        error: `所有会员卡余额不足，总余额 ¥${totalBalance.toFixed(2)}，需支付 ¥${targetAmount.toFixed(2)}` 
      };
    }
    
    // 余额足够，返回简化的支付方案
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
    
    // 先支付无折扣服务（原价）
    if (!remainingNoDiscountAmount.isZero()) {
      const noDiscountPayment = Decimal.min(remainingNoDiscountAmount, cardBalance);
      cardUsed = cardUsed.plus(noDiscountPayment);
      originalAmountCovered = originalAmountCovered.plus(noDiscountPayment);
      remainingNoDiscountAmount = remainingNoDiscountAmount.minus(noDiscountPayment);
    }
    
    // 再支付可折扣服务（打折价）
    if (!remainingDiscountableAmount.isZero() && cardUsed.lessThan(cardBalance)) {
      const remainingBalance = cardBalance.minus(cardUsed);
      const maxDiscountableAmount = remainingBalance.div(discountRate);
      const discountablePayment = Decimal.min(remainingDiscountableAmount, maxDiscountableAmount);
      const discountableDeduction = discountablePayment.times(discountRate);
      
      // 四舍五入处理
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
  // 如果有手动价格调整，使用调整后的金额
  if (manualPriceAdjustment.isActive && manualPriceAdjustment.adjustedAmount !== null) {
    return new Decimal(manualPriceAdjustment.adjustedAmount);
  }
  
  // 会员卡支付时，显示应付金额（折扣后），而不是实际扣款金额
  if (form.paymentMethod === 'MEMBER_CARD' && selectedMember.value) {
    // 计算理论上的折扣后应付金额
    if (availableCards.value.length > 0) {
      // 使用选中的卡片或第一张卡片
      const card = form.cardId 
        ? availableCards.value.find(c => c.id === form.cardId)
        : availableCards.value[0];
      if (card) {
        const discountRate = getCardDiscountRate(card);
        const discountableDeduction = discountableAmount.value.times(discountRate);
        return discountableDeduction.plus(noDiscountAmount.value);
      }
    }
  }
  
  return new Decimal(paymentPlan.value.actualPaidAmount || 0);
});
const displayDiscountAmount = computed(() => {
  // 会员卡支付时，计算理论上的折扣金额
  if (form.paymentMethod === 'MEMBER_CARD' && selectedMember.value && availableCards.value.length > 0) {
    const card = form.cardId 
      ? availableCards.value.find(c => c.id === form.cardId)
      : availableCards.value[0];
    if (card) {
      const discountRate = getCardDiscountRate(card);
      const discountableOriginalAmount = discountableAmount.value;
      const discountableDiscountedAmount = discountableOriginalAmount.times(discountRate);
      return discountableOriginalAmount.minus(discountableDiscountedAmount);
    }
  }
  
  return new Decimal(paymentPlan.value.discountAmount || 0);
});

// 计算价格调整差额
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

const averageDiscountRateText = computed(() => {
  if (displayDiscountAmount.value.isZero()) return '';
  if (cardPaymentMode.value === 'manual' && paymentPlan.value.paymentDetails.length > 0) {
      const detail = paymentPlan.value.paymentDetails[0];
      return `${detail.cardName} - ${detail.discountRate.times(10).toFixed(1)}折`;
  }
  if (cardPaymentMode.value === 'auto' && totalAmount.value.gt(0)) {
    if (paymentPlan.value.paymentDetails.length === 1) {
      const detail = paymentPlan.value.paymentDetails[0];
      return `${detail.cardName} - ${detail.discountRate.times(10).toFixed(1)}折`;
    }
    const rate = displayActualPaidAmount.value.div(totalAmount.value);
    return `综合 ${rate.times(10).toFixed(1)}折`;
  }
  return '';
});

const isCheckoutReady = computed(() => {
  if (cartItems.value.length === 0) return false;
  
  // 会员卡支付时的检查
  if (form.paymentMethod === 'MEMBER_CARD') {
    // 必须选择了会员
    if (!selectedMember.value) return false;
    
    // 如果有手动价格调整，检查调整后金额
    if (manualPriceAdjustment.isActive && manualPriceAdjustment.adjustedAmount !== null) {
      // 手动模式：检查选中卡片余额
      if (cardPaymentMode.value === 'manual' && form.cardId) {
        const card = availableCards.value.find(c => c.id === form.cardId);
        return card && manualPriceAdjustment.adjustedAmount <= parseFloat(card.balance);
      }
      // 自动模式：检查总余额
      const totalBalance = availableCards.value.reduce((sum, card) => sum + parseFloat(card.balance), 0);
      return manualPriceAdjustment.adjustedAmount <= totalBalance;
    }
    
    // 正常情况下，如果有错误（余额不足）则不能结算
    if (paymentPlan.value.error) return false;
  }
  
  return true;
});

// --- 事件处理 ---
const handleMemberSelect = (item) => {
  form.memberId = item.id;
  selectedMember.value = item;
  
  if (availableCards.value.length > 0) {
    form.paymentMethod = 'MEMBER_CARD';
  } else {
    form.paymentMethod = 'CASH';
  }
};

const clearMember = () => {
  Object.assign(form, getInitialForm());
  memberQuery.value = '';
  selectedMember.value = null;
  cardPaymentMode.value = 'auto';
};

// --- 价格调整方法 ---
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
  
  // 应用价格调整
  manualPriceAdjustment.isActive = true;
  manualPriceAdjustment.adjustedAmount = priceConfirmDialog.newAmount;
  manualPriceAdjustment.reason = priceConfirmDialog.reason.trim();
  
  // 关闭对话框
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
  form.transactionTime = new Date().toISOString().slice(0, 19).replace('T', ' '); // 重置为当前时间
  form.isManualTime = false; // 重置手动时间标记
  
  // 重置价格调整状态
  manualPriceAdjustment.isActive = false;
  manualPriceAdjustment.adjustedAmount = null;
  manualPriceAdjustment.reason = '';
  
  // 清空服务数量映射
  Object.keys(serviceQuantities).forEach(key => {
    delete serviceQuantities[key];
  });
  
  // 重新设置默认选中排序为0的服务
  const defaultService = serviceList.value.find(service => service.sortOrder === 0 && service.status === 'AVAILABLE');
  if (defaultService) {
    form.serviceIds = [defaultService.id];
    initializeServiceQuantity(defaultService.id);
  }
  
  // 重新设置默认选中排序为0的员工
  const defaultStaff = allStaff.value.find(staff => staff.sortOrder === 0 && staff.countsCommission);
  if (defaultStaff) {
    form.staffId = defaultStaff.id;
  }
  
  await fetchTodayTransactions();
};

// 获取调整差额文本
const getAdjustmentText = (row) => {
  if (!row.manualAdjustment) return '';
  
  const totalAmount = parseFloat(row.totalAmount);
  const adjustedAmount = parseFloat(row.actualPaidAmount);
  const difference = adjustedAmount - totalAmount;
  
  if (difference > 0) return `+¥ ${difference.toFixed(2)}`;
  if (difference < 0) return `¥ ${difference.toFixed(2)}`;
  return '价格调整';
};

// 获取调整原因
const getAdjustmentReason = (row) => {
  if (!row.manualAdjustment || !row.notes) return '';
  
  const match = row.notes.match(/价格调整：(.+?)(?:\s*\||$)/);
  return match ? match[1].trim() : '';
};

// 获取会员卡折扣显示
const getCardDiscountDisplay = (discountRate) => {
  if (!discountRate) return 10;
  
  // 处理Decimal对象或字符串类型的discountRate
  const rate = typeof discountRate === 'object' ? parseFloat(discountRate.toString()) : parseFloat(discountRate);
  // discountRate 0.8 表示打8折，所以直接乘以10
  const discount = rate * 10;
  
  // 处理小数点，如6.5折
  return discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
};

// 获取单卡支付的折扣显示（用于智能支付接口）
const getSingleCardDiscountDisplay = (transaction) => {
  // 计算折扣率：实付金额 / 应付金额
  const totalAmount = parseFloat(transaction.totalAmount);
  const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
  
  if (totalAmount > 0 && actualPaidAmount > 0) {
    const discountRate = actualPaidAmount / totalAmount;
    const discount = discountRate * 10;
    const discountDisplay = discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
    return `${discountDisplay}折 ¥${formatAmount(transaction.discountAmount)}`;
  }
  
  return `会员卡 ¥${formatAmount(transaction.discountAmount)}`;
};

// 已通过 currency.js 提供 formatAmount 函数

// 获取单个服务的折扣信息文本
const getServiceDiscountText = (service) => {
  if (!selectedMember.value || form.paymentMethod !== 'MEMBER_CARD') {
    return '原价 ¥' + new Decimal(service.standardPrice).toFixed(2);
  }
  
  if (service.noDiscount) {
    return '无折扣 ¥' + new Decimal(service.standardPrice).toFixed(2);
  }
  
  // 获取最优惠的会员卡折扣率
  const bestCard = availableCards.value.length > 0 ? availableCards.value[0] : null;
  if (bestCard) {
    const discountRate = new Decimal(bestCard.cardType.discountRate);
    const discountedPrice = new Decimal(service.standardPrice).times(discountRate);
    const discountText = getCardDiscountDisplay(bestCard.cardType.discountRate);
    return `${discountText}折 ¥${discountedPrice.toFixed(2)}`;
  }
  
  return '原价 ¥' + new Decimal(service.standardPrice).toFixed(2);
};

// 检测是否为多卡支付
const isMultiCardPayment = (transaction) => {
  return transaction.notes && transaction.notes.includes('多卡联合支付:');
};

// 获取平均折扣率显示
const getAverageDiscountDisplay = (transaction) => {
  const totalAmount = parseFloat(transaction.totalAmount);
  const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
  
  // 对于自定义项目（totalAmount为0），尝试从notes中解析原价和折后价
  if (totalAmount <= 0 && transaction.notes) {
    const match = transaction.notes.match(/¥(\d+(?:\.\d+)?)\s*折后\s*¥(\d+(?:\.\d+)?)/);
    if (match) {
      const originalPrice = parseFloat(match[1]);
      const discountedPrice = parseFloat(match[2]);
      if (originalPrice > 0) {
        const discountRate = discountedPrice / originalPrice;
        const discount = discountRate * 10;
        return discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
      }
    }
    return '7.0'; // 默认7折显示
  }
  
  const avgDiscountRate = actualPaidAmount / totalAmount;
  const avgDiscount = avgDiscountRate * 10;
  
  return avgDiscount % 1 === 0 ? Math.round(avgDiscount) : avgDiscount.toFixed(1);
};

// 获取多卡支付详情
const getMultiCardDetails = (transaction) => {
  if (!transaction.notes) return '';
  
  // 从notes中提取多卡支付信息
  const match = transaction.notes.match(/多卡联合支付:\s*(.+?)(?:\s*\||$)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return '多卡组合支付';
};

// 获取多卡支付的卡片列表
const getMultiCardList = (transaction) => {
  if (!transaction.notes) return [];
  
  // 从notes中提取多卡支付信息：300元储值卡¥12 + 500元储值卡¥3.5
  const match = transaction.notes.match(/多卡联合支付:\s*(.+?)(?:\s*\||$)/);
  if (match && match[1]) {
    const cardsText = match[1].trim();
    // 按 + 分割，提取卡片名称
    const cardParts = cardsText.split(' + ');
    return cardParts.map(part => {
      // 提取卡片名称（处理自定义面值卡格式：自定义面值卡(¥100.00)¥100.00）
      // 对于自定义面值卡，我们需要找到最后一个¥符号作为分割点
      const lastYenIndex = part.lastIndexOf('¥');
      if (lastYenIndex > 0) {
        return {
          name: part.substring(0, lastYenIndex).trim()
        };
      } else {
        return {
          name: part.trim()
        };
      }
    });
  }
  
  return [];
};

const handleCheckout = async () => {
  if (!isCheckoutReady.value) {
    ElMessage.warning(paymentPlan.value.error || '请检查开单信息是否完整');
    return;
  }
  
  isSubmitting.value = true;
  try {
    // 准备提交数据，包含价格调整信息
    const submitData = { ...form };
    
    // 如果没有会员，但有输入姓名，保存为散客姓名
    if (!form.memberId && memberQuery.value && memberQuery.value.trim()) {
      submitData.customerName = memberQuery.value.trim();
    }
    
    // 添加自定义交易时间
    if (form.transactionTime) {
      submitData.customTransactionTime = form.transactionTime;
      // 如果是手动选择的时间，在备注中添加标记
      if (form.isManualTime) {
        submitData.notes = `[手动设置时间] ${submitData.notes || ''}`.trim();
      }
    }
    
    // 如果有价格调整，添加相关信息
    if (manualPriceAdjustment.isActive) {
      submitData.manualPriceAdjustment = {
        adjustedAmount: manualPriceAdjustment.adjustedAmount,
        reason: manualPriceAdjustment.reason
      };
    }
    
    // 根据支付方式选择API
    let apiCall;
    if (form.paymentMethod === 'MEMBER_CARD' && cardPaymentMode.value === 'auto') {
      // 使用新的多卡联合支付API（优先清空小余额卡）
      apiCall = createMultiCardTransaction(submitData);
    } else {
      // 使用原有API（手动选卡或其他支付方式）
      apiCall = createTransaction(submitData);
    }
      
    await apiCall;
    ElMessage.success('结算成功！');
    await resetForm();
    await fetchTodayTransactions(); // 刷新消费记录
  } catch (error) {
    console.error("结算失败:", error);
    ElMessage.error('结算失败，请重试');
  } finally {
    isSubmitting.value = false;
  }
};

// --- 批量清账提示相关方法 ---
const isBatchClear = (transaction) => {
  return transaction.transactionType === 'PENDING_CLEAR' && 
         transaction.summary && 
         transaction.summary.includes('批量清账') &&
         transaction.notes;
};

const getBatchClearTooltip = (transaction) => {
  if (!isBatchClear(transaction)) return '';
  
  // 如果summary已经包含详细信息，直接显示
  if (transaction.summary && transaction.summary.includes('(¥')) {
    return transaction.summary.replace(/、/g, '\n• ').replace('批量清账：', '批量清账明细：\n• ');
  }
  
  return transaction.summary;
};

// 判断是否为手动设置的时间
const isManualTime = (row) => {
  // 通过备注中是否包含[手动设置时间]标记来判断
  return row.notes && row.notes.includes('[手动设置时间]');
};

// 获取时间tooltip内容
const getTimeTooltip = (row) => {
  const fullTime = formatFullDateTimeInAppTimeZone(row.transactionTime);
  if (isManualTime(row)) {
    return `${fullTime} (此交易时间为手动设置)`;
  }
  return fullTime;
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

.service-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-name {
  font-weight: 500;
}

.service-discount-info {
  display: flex;
  align-items: center;
}

.discount-tag {
  font-size: 11px;
  border-radius: 4px;
}

.multi-card-payment {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.multi-card-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.multi-card-details {
  font-size: 10px;
  color: #909399;
  line-height: 1.2;
  margin-top: 2px;
}

.multi-card-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.multi-card-list .card-item {
  display: flex;
}
.total { font-weight: bold; font-size: 18px; }
.total-price { color: #e6a23c; font-size: 22px; }
.today-records { margin-top: 20px; }
.today-table :deep(thead) { color: #606266; font-weight: 500; }
.today-table :deep(th) { background-color: #fafafa !important; }
.today-table :deep(.el-table__cell) { border: none; }
.today-table::before { display: none; }
.paid-amount { font-weight: 500; color: #E6A23C; }

.total-price-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.price-adjustment-controls {
  display: flex;
  justify-content: flex-end;
}

.adjustment-button {
  font-size: 12px;
}

.adjustment-reason {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
  line-height: 1.2;
}

.mt-2 {
  margin-top: 8px;
}

.price-confirm-content .el-alert {
  margin-bottom: 20px;
}
.suggestion-item { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.suggestion-info { flex-grow: 1; }
.suggestion-tags { display: flex; gap: 5px; flex-shrink: 0; margin-left: 15px; }
.discount-label {
  color: #303133;
}
.discount-detail {
  color: #f56c6c;
  margin-left: 5px;
}
@media (max-width: 992px) {
  .right-panel { margin-top: 20px; }
}
.payment-plan-preview {
  margin-top: 20px;
  font-size: 14px;
}
/* 核心修改3：支付方案预览新样式 */
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

/* 数量控制样式 */
.quantity-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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

/* 数量角标样式 */
.service-quantity-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: #f56c6c;
  color: white;
  border-radius: 10px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  height: 20px;
  min-width: 20px;
  text-align: center;
  z-index: 10;
  font-weight: bold;
}

/* 分页加载样式 */
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

.transaction-table-container {
  width: 100%;
}

/* 挂账和清账记录特殊样式 */
.pending-record {
  color: #f56c6c;
}

.clear-record {
  color: #67c23a;
}

.pending-amount {
  color: #f56c6c !important;
}

.clear-amount {
  color: #67c23a !important;
}

/* 服务项目文字显示样式 */
.service-items-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

/* 手动设置时间的样式 */
.manual-time {
  color: #e6a23c !important; /* 橙色，表示需要注意 */
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}
</style>