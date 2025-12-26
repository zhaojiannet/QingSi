<template>
  <el-dialog
    v-model="dialogVisible"
    :title="member ? `${member.name} 的详细信息` : '会员详情'"
    width="600px" 
    top="10vh"
    @open="onDialogOpen"
  >
    <el-skeleton v-if="loading" :rows="10" animated />
    
    <div v-else-if="member && !apiError" class="detail-content">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="姓名">{{ member.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ member.phone }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ member.gender === 'MALE' ? '男' : (member.gender === 'FEMALE' ? '女' : '未知') }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="memberStatusTagType(member.status)" size="small">{{ memberStatusText(member.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="注册日期" :span="2">{{ formatDateInAppTimeZone(member.registrationDate) }}</el-descriptions-item>
        <el-descriptions-item label="生日">{{ formatDateInAppTimeZone(member.birthday) }}</el-descriptions-item>
        <el-descriptions-item label="最后消费">
          <el-tooltip
            v-if="member.lastVisitDate"
            :content="formatFullDateTimeInAppTimeZone(member.lastVisitDate)"
            placement="top"
            effect="dark"
          >
            {{ formatShortDateInAppTimeZone(member.lastVisitDate) }}
          </el-tooltip>
          <span v-else>暂无消费记录</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ member.notes || '无' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider>名下会员卡</el-divider>
      
      <div v-if="member.cards && member.cards.length > 0">
        <!-- 显示当前可见的会员卡 -->
        <div v-for="card in visibleCards" :key="card.id" :class="['card-item', { 'depleted-card': toDecimal(card.balance).isZero() }]">
          <div class="card-info">
            <span class="card-name">{{ getCardDisplayName(card) }} <span class="discount-tag">{{ getCardDiscountDisplay(card) }}</span></span>
            <el-tag size="small" :type="getEffectiveCardStatusTagType(card)">{{ getEffectiveCardStatusText(card) }}</el-tag>
          </div>
          <div class="card-details-right">
            <div class="card-balance">
              余额: <span>{{ formatCurrency(card.balance) }}</span>
            </div>
            <div class="card-issue-date">
              办卡: <el-tooltip
                :content="formatFullDateTimeInAppTimeZone(card.issueDate)"
                placement="top"
                effect="dark"
              >
                {{ formatShortDateInAppTimeZone(card.issueDate) }}
              </el-tooltip>
            </div>
          </div>
        </div>
        
        <!-- 加载更多按钮 -->
        <div v-if="hasMoreDepletedCards" class="load-more-section">
          <el-button 
            type="primary" 
            plain
            style="width: 100%; margin: 15px 0;" 
            @click="loadMoreDepletedCards"
            :loading="loadingMoreCards"
          >
            加载更多会员卡 ({{ remainingDepletedCardsCount }} 张余额已用尽)
          </el-button>
        </div>
        
        <div class="card-item total-balance">
          <span class="card-name">所有有效卡总余额</span>
          <div class="card-balance">
            <span>{{ formatCurrency(totalActiveBalance) }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无会员卡" />

      <el-divider>办理新卡</el-divider>
      <div class="issue-card-section">
        <el-form :model="issueCardForm" label-position="top" class="compact-form">
          <!-- 办卡类型选择 -->
          <el-form-item label="办卡类型" class="card-type-selector">
            <el-radio-group v-model="issueCardForm.cardMode" @change="onCardModeChange" class="card-mode-group">
              <el-radio-button value="standard">标准会员卡</el-radio-button>
              <el-radio-button value="custom">自定义面值卡</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <!-- 统一的卡片配置区域 -->
          <div class="card-config-area">
            <!-- 标准卡配置 -->
            <div v-if="issueCardForm.cardMode === 'standard'" class="config-row">
              <div class="config-item">
                <label class="config-label">选择卡类型</label>
                <el-select v-model="issueCardForm.cardTypeId" placeholder="选择要办理的卡类型" class="config-select">
                  <el-option
                    v-for="cardType in availableCardTypes"
                    :key="cardType.id"
                    :label="`${cardType.name} (售价: ¥${new Decimal(cardType.initialPrice).toFixed(2)})`"
                    :value="cardType.id"
                  />
                </el-select>
              </div>
            </div>

            <!-- 自定义卡配置 -->
            <div v-if="issueCardForm.cardMode === 'custom'" class="custom-config">
              <div class="config-row">
                <div class="config-item">
                  <label class="config-label">自定义金额 <span class="required">*</span></label>
                  <el-input-number
                    v-model="issueCardForm.customAmount"
                    :min="1"
                    :max="10000"
                    :step="10"
                    :precision="2"
                    class="config-number"
                    placeholder="卡片面值"
                  />
                </div>
                <div class="config-item">
                  <label class="config-label">折扣模式 <span class="required">*</span></label>
                  <el-select v-model="issueCardForm.discountMode" placeholder="选择折扣模式" class="config-select">
                    <el-option value="existing" label="参照现有卡类型" />
                    <el-option value="custom" label="自定义折扣率" />
                  </el-select>
                </div>
              </div>

              <div v-if="issueCardForm.discountMode === 'existing'" class="config-row">
                <div class="config-item">
                  <label class="config-label">参照卡类型</label>
                  <el-select v-model="issueCardForm.existingDiscountCardTypeId" placeholder="选择折扣率参照" class="config-select">
                    <el-option
                      v-for="cardType in availableCardTypes"
                      :key="cardType.id"
                      :label="`${cardType.name} (${Math.round(cardType.discountRate * 10)}折)`"
                      :value="cardType.id"
                    />
                  </el-select>
                </div>
              </div>

              <div v-if="issueCardForm.discountMode === 'custom'" class="config-row">
                <div class="config-item">
                  <label class="config-label">自定义折扣率</label>
                  <el-input-number
                    v-model="issueCardForm.customDiscountRate"
                    :min="0.1"
                    :max="1.0"
                    :step="0.05"
                    :precision="2"
                    class="config-number"
                    placeholder="如：0.8 表示8折"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <!-- 服务员工和支付方式 -->
          <div class="service-config">
            <div class="config-row">
              <div v-if="commissionableStaff.length > 0" class="config-item">
                <label class="config-label">服务员工</label>
                <el-select v-model="issueCardForm.staffId" placeholder="选择服务员工" class="config-select" clearable>
                  <el-option
                    v-for="staff in commissionableStaff"
                    :key="staff.id"
                    :label="`${staff.name} (${staff.position})`"
                    :value="staff.id"
                  />
                </el-select>
              </div>
              <div class="config-item">
                <label class="config-label">支付方式 <span class="required">*</span></label>
                <el-select v-model="issueCardForm.paymentMethod" placeholder="选择支付方式" class="config-select">
                  <el-option value="CASH" label="现金" />
                  <el-option value="WECHAT_PAY" label="微信" />
                  <el-option value="ALIPAY" label="支付宝" />
                  <el-option value="DOUYIN" label="抖音" />
                  <el-option value="MEITUAN" label="美团" />
                </el-select>
              </div>
            </div>
          </div>
        </el-form>
        <el-button 
          type="success" 
          style="width: 100%; margin-top: 10px;" 
          @click="handleIssueCard" 
          :loading="isIssuing"
          :disabled="!isValidCardForm"
        >
          确认办理 {{ issueCardForm.cardMode === 'custom' ? '自定义面值卡' : '标准会员卡' }}
        </el-button>
      </div>

      <!-- 挂账/未结清款项 -->
      <el-divider>挂账/未结清款项</el-divider>
      <div class="pending-section">
        <!-- 挂账列表 -->
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
          
          <!-- 操作按钮行 -->
          <div class="pending-actions">
            <div class="pending-total">
              <span class="total-label">总挂账：</span>
              <span class="total-amount">¥{{ formatAmount(totalPendingAmount.toNumber()) }}</span>
            </div>
            <div class="action-buttons">
              <el-button type="success" size="small" @click="openClearAllDialog">
                全部清账
              </el-button>
              <el-button type="primary" size="small" @click="openPendingDialog">
                添加挂账
              </el-button>
            </div>
          </div>
        </div>
        
        <div v-else class="no-pending">
          <span>无挂账</span>
          <el-button type="primary" size="small" @click="openPendingDialog">
            添加挂账
          </el-button>
        </div>
      </div>
    </div>
    <el-result v-else-if="apiError" icon="error" title="加载失败" sub-title="获取会员详细信息失败，请检查网络或权限后重试。">
    </el-result>
    
    <template #footer>
        <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>

  <!-- 添加挂账对话框 -->
  <el-dialog
    v-model="showPendingDialog"
    title="添加挂账"
    width="450px"
    :close-on-click-modal="false"
  >
    <el-form :model="pendingForm" label-width="80px">
      <el-form-item label="挂账金额" required>
        <el-input
          v-model="pendingForm.amount"
          type="number"
          placeholder="请输入挂账金额"
          :min="0"
          step="0.01"
        >
          <template #prefix>¥</template>
        </el-input>
      </el-form-item>
      
      <el-form-item label="备注说明">
        <el-input
          v-model="pendingForm.description"
          type="textarea"
          :rows="2"
          placeholder="请输入挂账原因或备注（可选）"
        />
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
  <el-dialog 
    v-model="clearSingleDialog.visible" 
    title="确认清账" 
    width="500px"
    :close-on-click-modal="false"
  >
    <el-alert 
      :title="`清账金额：¥${formatAmount(clearSingleDialog.amount)}`"
      type="warning"
      :closable="false"
      style="margin-bottom: 20px"
    />
    
    <el-form :model="clearSingleDialog" label-width="100px">
      <el-form-item label="支付方式">
        <el-radio-group v-model="clearSingleDialog.paymentMethod">
          <el-radio value="MEMBER_CARD" :disabled="!hasAvailableCards">
            会员卡支付
          </el-radio>
          <el-radio value="CASH">现金结清</el-radio>
        </el-radio-group>
        <div v-if="!hasAvailableCards && clearSingleDialog.paymentMethod === 'MEMBER_CARD'" 
             class="no-cards-tip">
          该会员没有可用的会员卡
        </div>
      </el-form-item>
      
      <el-form-item 
        label="选择会员卡" 
        v-if="clearSingleDialog.paymentMethod === 'MEMBER_CARD' && hasAvailableCards"
      >
        <el-select 
          v-model="clearSingleDialog.cardId" 
          placeholder="请选择会员卡"
          @change="validateCardBalance"
          style="width: 100%"
        >
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
                <span v-if="card.balance < clearSingleDialog.amount" style="color: #F56C6C;">
                  - 余额不足
                </span>
              </div>
            </div>
          </el-option>
        </el-select>
        
        <!-- 余额不足警告 -->
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
  <el-dialog 
    v-model="clearAllDialog.visible" 
    title="确认批量清账" 
    width="500px"
    :close-on-click-modal="false"
  >
    <el-alert 
      :title="`总挂账金额：¥${formatAmount(totalPendingAmount.toNumber())}`"
      type="warning"
      :closable="false"
      style="margin-bottom: 20px"
    />
    
    <div class="pending-summary" style="margin-bottom: 20px;">
      <div style="font-size: 14px; color: #666;">
        共 {{ pendingPayments.length }} 笔挂账记录
      </div>
    </div>
    
    <el-form :model="clearAllDialog" label-width="100px">
      <el-form-item label="支付方式">
        <el-radio-group v-model="clearAllDialog.paymentMethod">
          <el-radio value="MEMBER_CARD" :disabled="!hasAvailableCards">
            会员卡支付
          </el-radio>
          <el-radio value="CASH">现金结清</el-radio>
        </el-radio-group>
        <div v-if="!hasAvailableCards && clearAllDialog.paymentMethod === 'MEMBER_CARD'" 
             class="no-cards-tip">
          该会员没有可用的会员卡
        </div>
      </el-form-item>
      
      <el-form-item 
        label="选择会员卡" 
        v-if="clearAllDialog.paymentMethod === 'MEMBER_CARD' && hasAvailableCards"
      >
        <el-select 
          v-model="clearAllDialog.cardId" 
          placeholder="请选择会员卡"
          @change="validateAllCardBalance"
          style="width: 100%"
        >
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
                <span v-if="card.balance < totalPendingAmount.toNumber()" style="color: #F56C6C;">
                  - 余额不足
                </span>
              </div>
            </div>
          </el-option>
        </el-select>
        
        <!-- 余额不足警告 -->
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
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { getMemberById, getPendingPayments, addPendingPayment, deletePendingPayment, clearAllPendingPayments } from '@/api/member.js';
import { getCardTypeList } from '@/api/cardType.js';
import { issueCardWithTransaction } from '@/api/card.js';
import { getStaffList } from '@/api/staff.js';
import { ElMessage } from 'element-plus';
import Decimal from 'decimal.js'; // 确保引入 Decimal.js
import { memberStatusText, memberStatusTagType, cardStatusText, cardStatusTagType } from '@/utils/formatters.js';
import { formatInAppTimeZone, formatDateInAppTimeZone, formatShortDateInAppTimeZone, formatFullDateTimeInAppTimeZone } from '@/utils/date.js';
import { formatAmount, formatCurrency, formatDiscountRate, toDecimal } from '@/utils/currency.js';

const dialogVisible = ref(false);
const loading = ref(false);
const isIssuing = ref(false);
const loadingMoreCards = ref(false);
const member = ref(null);
const allCardTypes = ref([]);
const allStaff = ref([]);
const apiError = ref(false);

// 分页状态
const depletedCardsOffset = ref(0);
const depletedCardsPageSize = 5;

// 挂账相关状态
const showPendingDialog = ref(false);
const pendingPayments = ref([]);
const isSubmittingPending = ref(false);
const pendingForm = reactive({
  amount: null,
  description: '',
  createdAt: null
});

const issueCardForm = reactive({
  cardTypeId: '',
  staffId: null,
  paymentMethod: 'CASH',
  // 自定义面值卡相关字段
  cardMode: 'standard', // 'standard' 或 'custom'
  customAmount: null,
  discountMode: 'existing', // 'existing' 或 'custom'
  existingDiscountCardTypeId: '',
  customDiscountRate: null
});

const availableCardTypes = computed(() => {
  return allCardTypes.value.filter(ct => ct.status === 'AVAILABLE');
});

const commissionableStaff = computed(() => {
    return allStaff.value.filter(s => s.status === 'ACTIVE' && s.countsCommission);
});

// 计算总挂账金额
const totalPendingAmount = computed(() => {
  return pendingPayments.value.reduce((sum, payment) => {
    return sum.plus(toDecimal(payment.amount));
  }, toDecimal(0));
});

// 清账对话框数据
const clearSingleDialog = reactive({
  visible: false,
  pendingId: null,
  amount: 0,
  paymentMethod: 'CASH',
  cardId: null,
  loading: false
});

const clearAllDialog = reactive({
  visible: false,
  paymentMethod: 'CASH',
  cardId: null,
  loading: false
});

// 可用会员卡列表
const availableCards = computed(() => {
  if (!member.value?.cards) return [];
  return member.value.cards.filter(card => 
    card.status === 'ACTIVE' && parseFloat(card.balance) > 0
  );
});

const hasAvailableCards = computed(() => availableCards.value.length > 0);

// 余额验证计算属性
const isSingleBalanceSufficient = computed(() => {
  if (clearSingleDialog.paymentMethod !== 'MEMBER_CARD') return true;
  if (!clearSingleDialog.cardId) return false;
  
  const card = availableCards.value.find(c => c.id === clearSingleDialog.cardId);
  return card && parseFloat(card.balance) >= clearSingleDialog.amount;
});

const isAllBalanceSufficient = computed(() => {
  if (clearAllDialog.paymentMethod !== 'MEMBER_CARD') return true;
  if (!clearAllDialog.cardId) return false;
  
  const card = availableCards.value.find(c => c.id === clearAllDialog.cardId);
  return card && parseFloat(card.balance) >= totalPendingAmount.value.toNumber();
});

// 确认按钮启用状态
const canConfirmSingleClear = computed(() => {
  if (clearSingleDialog.paymentMethod === 'CASH') {
    return true;
  }
  return isSingleBalanceSufficient.value;
});

const canConfirmAllClear = computed(() => {
  if (clearAllDialog.paymentMethod === 'CASH') {
    return true;
  }
  return isAllBalanceSufficient.value;
});

// 获取最优支付卡片（余额最接近但大于所需金额的卡片）
const getOptimalPaymentCard = (requiredAmount) => {
  if (!availableCards.value.length) return null;
  
  // 筛选出余额充足的卡片
  const sufficientCards = availableCards.value.filter(card => 
    parseFloat(card.balance) >= requiredAmount
  );
  
  if (!sufficientCards.length) return null;
  
  // 选择余额最接近所需金额的卡片（避免浪费大额卡）
  return sufficientCards.reduce((optimal, card) => {
    const cardBalance = parseFloat(card.balance);
    const optimalBalance = parseFloat(optimal.balance);
    return cardBalance < optimalBalance ? card : optimal;
  });
};

const onDialogOpen = async () => {
  if (!member.value?.id) return;
  loading.value = true;
  apiError.value = false;
  
  // 重置分页状态
  depletedCardsOffset.value = 0;
  
  // 重置表单
  issueCardForm.cardTypeId = '';
  issueCardForm.staffId = null;
  issueCardForm.paymentMethod = 'CASH';
  issueCardForm.cardMode = 'standard';
  issueCardForm.customAmount = null;
  issueCardForm.discountMode = 'existing';
  issueCardForm.existingDiscountCardTypeId = '';
  issueCardForm.customDiscountRate = null;

  try {
    const [memberData, cardTypesData, staffData, pendingData] = await Promise.all([
      getMemberById(member.value.id),
      getCardTypeList(),
      getStaffList(),
      getPendingPayments(member.value.id)
    ]);
    member.value = memberData;
    allCardTypes.value = cardTypesData;
    allStaff.value = staffData;
    pendingPayments.value = pendingData;
  } catch (error) {
    apiError.value = true;
    // Error fetching member details - handled silently
  } finally {
    loading.value = false;
  }
};

const open = (memberId) => {
  member.value = { id: memberId };
  dialogVisible.value = true;
};

// 添加卡模式切换处理函数
const onCardModeChange = (mode) => {
  if (mode === 'custom') {
    issueCardForm.cardTypeId = '';
    issueCardForm.customAmount = null;
    issueCardForm.discountMode = 'existing';
    issueCardForm.existingDiscountCardTypeId = '';
    issueCardForm.customDiscountRate = null;
  } else {
    // 切换到标准模式时，清除自定义相关字段
    issueCardForm.customAmount = null;
    issueCardForm.existingDiscountCardTypeId = '';
    issueCardForm.customDiscountRate = null;
  }
};

// 表单验证计算属性
const isValidCardForm = computed(() => {
  if (issueCardForm.cardMode === 'standard') {
    return !!issueCardForm.cardTypeId;
  } else {
    // 自定义面值卡验证
    const hasValidAmount = issueCardForm.customAmount && issueCardForm.customAmount > 0;
    const hasValidDiscount = issueCardForm.discountMode === 'existing' 
      ? !!issueCardForm.existingDiscountCardTypeId
      : issueCardForm.customDiscountRate && issueCardForm.customDiscountRate > 0;
    return hasValidAmount && hasValidDiscount;
  }
});

const handleIssueCard = async () => {
  if (issueCardForm.cardMode === 'standard' && !issueCardForm.cardTypeId) {
    ElMessage.warning('请先选择要办理的卡类型');
    return;
  }
  
  if (issueCardForm.cardMode === 'custom') {
    if (!issueCardForm.customAmount || issueCardForm.customAmount <= 0) {
      ElMessage.warning('请输入有效的自定义金额');
      return;
    }
    
    if (issueCardForm.discountMode === 'existing' && !issueCardForm.existingDiscountCardTypeId) {
      ElMessage.warning('请选择折扣率参照的卡类型');
      return;
    }
    
    if (issueCardForm.discountMode === 'custom' && (!issueCardForm.customDiscountRate || issueCardForm.customDiscountRate <= 0)) {
      ElMessage.warning('请输入有效的自定义折扣率');
      return;
    }
  }
  isIssuing.value = true;
  try {
    const payload = {
        memberId: member.value.id,
        paymentMethod: issueCardForm.paymentMethod,
        ...(issueCardForm.staffId && { staffId: issueCardForm.staffId }),
    };
    
    if (issueCardForm.cardMode === 'standard') {
      // 标准会员卡
      payload.cardTypeId = issueCardForm.cardTypeId;
    } else {
      // 自定义面值卡
      payload.isCustomCard = true;
      payload.customAmount = issueCardForm.customAmount;
      
      if (issueCardForm.discountMode === 'existing') {
        payload.discountSource = 'card_type';
        payload.cardTypeId = issueCardForm.existingDiscountCardTypeId;
      } else {
        payload.discountSource = 'custom';
        payload.customDiscountRate = issueCardForm.customDiscountRate;
        // 对于自定义折扣率，我们仍需要一个参考卡类型来获取其他属性
        payload.cardTypeId = availableCardTypes.value[0]?.id;
      }
    }
    await issueCardWithTransaction(payload);
    ElMessage.success('办卡成功，并已生成消费记录！');
    
    await onDialogOpen();
    emit('success');
  } finally {
    isIssuing.value = false;
  }
};

const emit = defineEmits(['success']);

const totalActiveBalance = computed(() => {
  if (!member.value || !member.value.cards) {
    return '0.00';
  }
  const sum = member.value.cards
    .filter(card => card.status === 'ACTIVE')
    .reduce((acc, card) => acc.plus(toDecimal(card.balance)), toDecimal(0));
  return sum.toFixed(2);
});

// 获取有效的会员卡状态文本（考虑余额）
const getEffectiveCardStatusText = (card) => {
  // 如果余额为0，优先显示"余额已用尽"
  if (toDecimal(card.balance).isZero()) {
    return '余额已用尽';
  }
  // 否则显示原始状态
  return cardStatusText(card.status);
};

// 获取有效的会员卡状态标签类型（考虑余额）
const getEffectiveCardStatusTagType = (card) => {
  // 如果余额为0，使用 info 类型
  if (toDecimal(card.balance).isZero()) {
    return 'info';
  }
  // 否则使用原始状态对应的类型
  return cardStatusTagType(card.status);
};

// 获取卡片显示名称（区分自定义面值卡）
const getCardDisplayName = (card) => {
  if (card.isCustomCard && card.customAmount) {
    return `自定义面值卡(¥${formatAmount(card.customAmount)})`;
  }
  return card.cardType.name;
};

// 获取卡片折扣信息显示
const getCardDiscountDisplay = (card) => {
  if (card.discountSource === 'custom' && card.customDiscountRate) {
    return formatDiscountRate(card.customDiscountRate);
  }
  return formatDiscountRate(card.cardType.discountRate);
};

// 计算属性：所有有效的会员卡（余额 > 0）
const activeCards = computed(() => {
  if (!member.value?.cards) return [];
  return member.value.cards.filter(card => 
    toDecimal(card.balance).greaterThan(0) && card.status === 'ACTIVE'
  );
});

// 计算属性：所有余额已用尽的会员卡（余额 = 0）
const depletedCards = computed(() => {
  if (!member.value?.cards) return [];
  return member.value.cards.filter(card => 
    toDecimal(card.balance).isZero()
  );
});

// 计算属性：当前可见的会员卡
const visibleCards = computed(() => {
  const visibleDepletedCards = depletedCards.value.slice(0, depletedCardsOffset.value);
  return [...activeCards.value, ...visibleDepletedCards];
});

// 计算属性：是否还有更多余额已用尽的会员卡可加载
const hasMoreDepletedCards = computed(() => {
  return depletedCardsOffset.value < depletedCards.value.length;
});

// 计算属性：剩余的余额已用尽会员卡数量
const remainingDepletedCardsCount = computed(() => {
  return depletedCards.value.length - depletedCardsOffset.value;
});

// 加载更多余额已用尽的会员卡
const loadMoreDepletedCards = async () => {
  loadingMoreCards.value = true;
  
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 增加偏移量，每次加载5张
  depletedCardsOffset.value = Math.min(
    depletedCardsOffset.value + depletedCardsPageSize,
    depletedCards.value.length
  );
  
  loadingMoreCards.value = false;
};

// 打开挂账对话框
const openPendingDialog = () => {
  // 设置默认时间为当前时间
  pendingForm.createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  showPendingDialog.value = true;
};

// 取消挂账对话框
const cancelPendingDialog = () => {
  pendingForm.amount = null;
  pendingForm.description = '';
  pendingForm.createdAt = null;
  showPendingDialog.value = false;
};

// 添加挂账
const handleAddPending = async () => {
  // 防止重复提交
  if (isSubmittingPending.value) {
    return;
  }

  try {
    const amount = parseFloat(pendingForm.amount);
    if (!amount || amount <= 0) {
      ElMessage.warning('请输入有效的挂账金额');
      return;
    }

    // 设置提交状态，防止重复点击
    isSubmittingPending.value = true;

    const data = {
      amount: amount,
      description: pendingForm.description || null,
      createdAt: pendingForm.createdAt || new Date().toISOString()
    };

    await addPendingPayment(member.value.id, data);
    ElMessage.success('挂账添加成功');
    
    // 重新加载挂账列表
    const updatedPendingData = await getPendingPayments(member.value.id);
    pendingPayments.value = updatedPendingData;
    
    // 重置表单并关闭对话框
    cancelPendingDialog();
    
    emit('success');
  } catch (error) {
    ElMessage.error('挂账添加失败');
  } finally {
    // 无论成功失败都重置提交状态
    isSubmittingPending.value = false;
  }
};

// 打开单个挂账清账对话框
const openClearSingleDialog = (pendingId, amount) => {
  clearSingleDialog.pendingId = pendingId;
  clearSingleDialog.amount = amount;
  clearSingleDialog.loading = false;
  
  // 智能选择支付方式和会员卡
  const optimalCard = getOptimalPaymentCard(amount);
  if (optimalCard) {
    clearSingleDialog.paymentMethod = 'MEMBER_CARD';
    clearSingleDialog.cardId = optimalCard.id;
  } else {
    clearSingleDialog.paymentMethod = 'CASH';
    clearSingleDialog.cardId = null;
  }
  
  clearSingleDialog.visible = true;
};

// 打开批量清账对话框
const openClearAllDialog = () => {
  clearAllDialog.loading = false;
  
  // 智能选择支付方式和会员卡
  const totalAmount = totalPendingAmount.value.toNumber();
  const optimalCard = getOptimalPaymentCard(totalAmount);
  if (optimalCard) {
    clearAllDialog.paymentMethod = 'MEMBER_CARD';
    clearAllDialog.cardId = optimalCard.id;
  } else {
    clearAllDialog.paymentMethod = 'CASH';
    clearAllDialog.cardId = null;
  }
  
  clearAllDialog.visible = true;
};

// 确认单个清账
const confirmClearSingle = async () => {
  if (!canConfirmSingleClear.value) return;
  
  clearSingleDialog.loading = true;
  try {
    const paymentData = {
      paymentMethod: clearSingleDialog.paymentMethod
    };
    
    if (clearSingleDialog.paymentMethod === 'MEMBER_CARD') {
      if (!clearSingleDialog.cardId) {
        ElMessage.error('请选择会员卡');
        return;
      }
      paymentData.cardId = clearSingleDialog.cardId;
    }
    
    const response = await deletePendingPayment(
      member.value.id, 
      clearSingleDialog.pendingId,
      paymentData
    );
    
    ElMessage.success(response.message || '挂账已清除');
    clearSingleDialog.visible = false;
    
    // 从本地列表中移除该记录
    pendingPayments.value = pendingPayments.value.filter(
      p => p.id !== clearSingleDialog.pendingId
    );
    
    // 重新加载会员数据以更新余额显示
    await onDialogOpen();
    emit('success');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '清账失败');
  } finally {
    clearSingleDialog.loading = false;
  }
};

// 确认批量清账
const confirmClearAll = async () => {
  if (!canConfirmAllClear.value) return;
  
  clearAllDialog.loading = true;
  try {
    const paymentData = {
      paymentMethod: clearAllDialog.paymentMethod
    };
    
    if (clearAllDialog.paymentMethod === 'MEMBER_CARD') {
      if (!clearAllDialog.cardId) {
        ElMessage.error('请选择会员卡');
        return;
      }
      paymentData.cardId = clearAllDialog.cardId;
    }
    
    const response = await clearAllPendingPayments(member.value.id, paymentData);
    
    ElMessage.success(response.message || '所有挂账已清除');
    clearAllDialog.visible = false;
    
    // 清空本地挂账列表
    pendingPayments.value = [];
    
    // 重新加载会员数据以更新余额显示
    await onDialogOpen();
    emit('success');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '批量清账失败');
  } finally {
    clearAllDialog.loading = false;
  }
};

// 验证会员卡余额
const validateCardBalance = () => {
  if (!isSingleBalanceSufficient.value) {
    ElMessage.warning('所选会员卡余额不足');
  }
};

const validateAllCardBalance = () => {
  if (!isAllBalanceSufficient.value) {
    ElMessage.warning('所选会员卡余额不足');
  }
};


// 获取会员卡选项标签
const getCardOptionLabel = (card) => {
  const name = getCardDisplayName(card);
  const balance = formatAmount(card.balance);
  return `${name} (余额: ¥${balance})`;
};

// 判断是否需要显示tooltip（备注过长时显示）
const shouldShowTooltip = (payment) => {
  return payment.description && payment.description.length > 15;
};

defineExpose({ open });
</script>

<style scoped>
.detail-content { padding: 0 10px; }
.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  background-color: #fafafa;
  margin-bottom: 10px;
}

/* 余额已用尽卡片的紧凑样式 */
.card-item.depleted-card {
  padding: 6px 10px;
  background-color: #f8f8f8;
  opacity: 0.6;
  margin-bottom: 3px;
  min-height: 36px;
  align-items: center;
}

.card-item.depleted-card .card-info {
  gap: 8px;
  flex-direction: row;
  align-items: center;
  flex: 1;
}

.card-item.depleted-card .card-name {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.card-item.depleted-card .card-details-right {
  font-size: 11px;
  line-height: 1.4;
  align-self: center;
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: center;
}

.card-item.depleted-card .card-balance {
  white-space: nowrap;
  color: #909399;
  font-size: 11px;
}

.card-item.depleted-card .card-balance span {
  color: #909399;
  font-weight: normal;
  font-size: 11px;
}

.card-item.depleted-card .card-issue-date {
  color: #909399;
  font-size: 11px;
  white-space: nowrap;
}

/* 清账对话框样式 */
.no-cards-tip {
  margin-top: 8px;
  color: #f56c6c;
  font-size: 12px;
}

.card-item.depleted-card .el-tag {
  transform: scale(0.85);
  margin-left: -2px;
}
.card-info { display: flex; align-items: center; gap: 10px; }
.card-name { font-weight: 500; }
.card-balance span { font-weight: bold; color: #E6A23C; }
.issue-card-section {
  padding: 16px;
  background-color: #f8f8f9;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-top: 20px;
}

.compact-form {
  --el-form-label-font-size: 13px;
}

.card-type-selector {
  margin-bottom: 16px;
}

.card-mode-group {
  width: 100%;
}

.card-config-area,
.service-config {
  background: #fff;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
}

.custom-config {
  border-left: 3px solid #409eff;
  padding-left: 12px;
}

.config-row {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.required {
  color: #f56c6c;
}

.config-select,
.config-number {
  width: 100%;
}
.total-balance {
  margin-top: 15px;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
}
.total-balance .card-name {
  font-weight: bold;
  color: #409EFF;
}
.total-balance .card-balance span {
  font-size: 1.1em;
}
.card-details-right {
  text-align: right;
}
.discount-tag {
  font-size: 12px;
  color: #E6A23C;
  font-weight: bold;
  margin-left: 8px;
}
.card-issue-date {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 挂账样式 */
.pending-section {
  padding: 10px;
  background-color: #f9f9f9;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-top: 10px;
}

.pending-list {
  margin-bottom: 10px;
}

.pending-col {
  margin-bottom: 6px;
}

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
</style>