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
                :label="`${card.cardType.name} (余额: ¥${new Decimal(card.balance).toFixed(2)}, ${Math.round(card.cardType.discountRate * 10)}折)`"
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
                      <el-icon><Warning /></el-icon> 无折扣 ¥{{ new Decimal(row.standardPrice).toFixed(2) }}
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
               <template #default="{ row }">¥{{ new Decimal(row.standardPrice).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
          <el-divider />

          <div class="summary">
            <div class="summary-item">
              <span>应付总额:</span>
              <span>¥{{ totalAmount.toFixed(2) }}</span>
            </div>
            
            <div class="summary-item" v-if="displayDiscountAmount > 0">
              <span class="discount-label">总优惠:</span>
              <span class="discount-text">- ¥{{ displayDiscountAmount.toFixed(2) }}</span>
            </div>
            
            <div class="summary-item total">
              <span>实付金额:</span>
              <div class="total-price-display">
                <span class="total-price">¥{{ displayActualPaidAmount.toFixed(2) }}</span>
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
                <span>原价: ¥{{ detail.originalAmountCovered.toFixed(2) }}</span>
                <span>优惠: -¥{{ detail.discountAmount.toFixed(2) }}</span>
                <span class="deduction">实扣: ¥{{ detail.deduction.toFixed(2) }}</span>
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
    <div>
      <el-table :data="todayTransactions" stripe max-height="600" class="today-table">
        <el-table-column prop="member.name" label="姓名" width="100">
          <template #default="{ row }">{{ row.member?.name || '非会员用户' }}</template>
        </el-table-column>
        
        <el-table-column label="会员卡" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.member && row.cardUsed" type="primary" size="small">
              {{ row.cardUsed.cardType?.name || '会员卡' }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="服务项目">
          <template #default="{ row }">
            {{ row.items?.map(item => item.service.name).join(', ') || row.summary || '项目消费' }}
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
          <template #default="{ row }">¥{{ row.totalAmount }}</template>
        </el-table-column>
        
        <el-table-column label="折扣" width="180" align="left">
          <template #default="{ row }">
            <div v-if="row.manualAdjustment">
              <el-tag type="warning" size="small">{{ getAdjustmentText(row) }}</el-tag>
              <div class="adjustment-reason" v-if="getAdjustmentReason(row)">
                {{ getAdjustmentReason(row) }}
              </div>
            </div>
            <div v-else-if="row.member && row.cardUsed && parseFloat(row.discountAmount) > 0">
              <el-tag type="primary" size="small">
                {{ getCardDiscountDisplay(row.cardUsed.cardType?.discountRate) }}折 ¥ {{ row.discountAmount }}
              </el-tag>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="实付金额" width="90" align="right">
          <template #default="{ row }">
            <span class="paid-amount">¥{{ row.actualPaidAmount }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="transactionTime" label="时间" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip
              :content="formatFullDateTimeInAppTimeZone(row.transactionTime)"
              placement="top"
              effect="dark"
            >
              {{ formatShortDateInAppTimeZone(row.transactionTime) }}
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
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
          <el-input :value="`¥${displayActualPaidAmount.toFixed(2)}`" readonly />
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
              原金额：¥{{ displayActualPaidAmount.toFixed(2) }} → 
              调整后：¥{{ priceConfirmDialog.newAmount?.toFixed(2) }}
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
import { createTransaction, getTodayTransactions, createComboCheckout } from '@/api/transaction.js';
import { CreditCard, Plus, Minus, Edit } from '@element-plus/icons-vue';
import Decimal from 'decimal.js';
import { ElMessage } from 'element-plus';
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
    serviceIds: [],
    staffId: null,
    paymentMethod: 'CASH',
    cardId: null,
    notes: '',
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
const fetchTodayTransactions = async () => { 
  try {
    const data = await getTodayTransactions();
    todayTransactions.value = data.map(tx => ({
      ...tx,
      items: tx.items.map(item => ({
        ...item,
        price: item.price !== null ? item.price : (item.service?.standardPrice || 0)
      })),
      // 检测是否为手动调整：notes包含"价格调整："
      manualAdjustment: tx.notes && tx.notes.includes('价格调整：')
    }));
  } catch(error) {
    console.error("获取当日流水失败:", error);
    todayTransactions.value = [];
  }
};
const queryMembersAsync = async (queryString, cb) => {
  if (!queryString) return cb([]);
  const { data } = await getMembers({ search: queryString, limit: 20, includeCards: true });
  cb(data.map(m => ({ ...m, value: `${m.name} (${m.phone})` }))); 
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
      const discountRateA = new Decimal(a.cardType.discountRate);
      const discountRateB = new Decimal(b.cardType.discountRate);
      if (!discountRateA.equals(discountRateB)) {
        return discountRateA.minus(discountRateB).toNumber();
      }
      return new Decimal(a.balance).minus(new Decimal(b.balance)).toNumber();
    });
});

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
        cardName: card.cardType.name,
        discountRate: new Decimal(card.cardType.discountRate),
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
  let remainingDiscountableAmount = discountableAmount.value;
  let remainingNoDiscountAmount = noDiscountAmount.value;
  let totalPaid = new Decimal(0);
  const paymentDetails = [];
  
  for (const card of availableCards.value) {
    if (remainingDiscountableAmount.isZero() && remainingNoDiscountAmount.isZero()) break;
    
    const cardBalance = new Decimal(card.balance);
    const discountRate = new Decimal(card.cardType.discountRate);
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
      
      cardUsed = cardUsed.plus(discountableDeduction);
      originalAmountCovered = originalAmountCovered.plus(discountablePayment);
      discountAmount = discountablePayment.minus(discountableDeduction);
      remainingDiscountableAmount = remainingDiscountableAmount.minus(discountablePayment);
    }

    if (originalAmountCovered.gt(0)) {
      totalPaid = totalPaid.plus(cardUsed);
      paymentDetails.push({
        cardName: card.cardType.name,
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
  return new Decimal(paymentPlan.value.actualPaidAmount || 0);
});
const displayDiscountAmount = computed(() => new Decimal(paymentPlan.value.discountAmount || 0));

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
  if (form.paymentMethod === 'MEMBER_CARD' && paymentPlan.value.error) return false;
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

const handleCheckout = async () => {
  if (!isCheckoutReady.value) {
    ElMessage.warning(paymentPlan.value.error || '请检查开单信息是否完整');
    return;
  }
  
  isSubmitting.value = true;
  try {
    // 准备提交数据，包含价格调整信息
    const submitData = { ...form };
    
    // 如果有价格调整，添加相关信息
    if (manualPriceAdjustment.isActive) {
      submitData.manualPriceAdjustment = {
        adjustedAmount: manualPriceAdjustment.adjustedAmount,
        reason: manualPriceAdjustment.reason
      };
    }
    
    const apiCall = (form.paymentMethod === 'MEMBER_CARD' && cardPaymentMode.value === 'auto')
      ? createComboCheckout(submitData)
      : createTransaction(submitData);
      
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
</style>