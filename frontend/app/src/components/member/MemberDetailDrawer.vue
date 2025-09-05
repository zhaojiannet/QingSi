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

      <el-divider>办理新卡</el-divider>
      <div class="issue-card-section">
        <el-form :model="issueCardForm" label-position="top">
          <el-form-item label="选择卡类型">
            <el-select v-model="issueCardForm.cardTypeId" placeholder="选择要办理的卡类型" style="width: 100%;">
              <el-option
                v-for="cardType in availableCardTypes"
                :key="cardType.id"
                :label="`${cardType.name} (售价: ¥${new Decimal(cardType.initialPrice).toFixed(2)})`"
                :value="cardType.id"
              />
            </el-select>
          </el-form-item>
          
          <el-form-item v-if="commissionableStaff.length > 0" label="服务员工 (可选)">
            <el-select v-model="issueCardForm.staffId" placeholder="选择服务员工" style="width: 100%;" clearable>
                <el-option
                    v-for="staff in commissionableStaff"
                    :key="staff.id"
                    :label="`${staff.name} (${staff.position})`"
                    :value="staff.id"
                />
            </el-select>
          </el-form-item>

          <el-form-item label="支付方式">
            <el-radio-group v-model="issueCardForm.paymentMethod">
              <el-radio-button value="CASH">现金</el-radio-button>
              <el-radio-button value="WECHAT_PAY">微信</el-radio-button>
              <el-radio-button value="ALIPAY">支付宝</el-radio-button>
              <el-radio-button value="DOUYIN">抖音</el-radio-button>
              <el-radio-button value="MEITUAN">美团</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <el-button 
          type="success" 
          style="width: 100%; margin-top: 10px;" 
          @click="handleIssueCard" 
          :loading="isIssuing"
          :disabled="!issueCardForm.cardTypeId"
        >
          确认办理
        </el-button>
      </div>

      <el-divider>名下会员卡</el-divider>
      
      <div v-if="member.cards && member.cards.length > 0">
        <!-- 显示当前可见的会员卡 -->
        <div v-for="card in visibleCards" :key="card.id" class="card-item">
          <div class="card-info">
            <span class="card-name">{{ card.cardType.name }}</span>
            <el-tag size="small" :type="getEffectiveCardStatusTagType(card)">{{ getEffectiveCardStatusText(card) }}</el-tag>
          </div>
          <div class="card-details-right">
            <div class="card-balance">
              <!-- 核心修复点：对所有金额进行类型转换 -->
              余额: <span>¥{{ new Decimal(card.balance).toFixed(2) }}</span>
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
            <span>¥{{ totalActiveBalance.toFixed(2) }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无会员卡" />
    </div>
    <el-result v-else-if="apiError" icon="error" title="加载失败" sub-title="获取会员详细信息失败，请检查网络或权限后重试。">
    </el-result>
    
    <template #footer>
        <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { getMemberById } from '@/api/member.js';
import { getCardTypeList } from '@/api/cardType.js';
import { issueCardWithTransaction } from '@/api/card.js';
import { getStaffList } from '@/api/staff.js';
import { ElMessage } from 'element-plus';
import Decimal from 'decimal.js'; // 确保引入 Decimal.js
import { memberStatusText, memberStatusTagType, cardStatusText, cardStatusTagType } from '@/utils/formatters.js';
import { formatInAppTimeZone, formatDateInAppTimeZone, formatShortDateInAppTimeZone, formatFullDateTimeInAppTimeZone } from '@/utils/date.js';

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

const issueCardForm = reactive({
  cardTypeId: '',
  staffId: null,
  paymentMethod: 'CASH',
});

const availableCardTypes = computed(() => {
  return allCardTypes.value.filter(ct => ct.status === 'AVAILABLE');
});

const commissionableStaff = computed(() => {
    return allStaff.value.filter(s => s.status === 'ACTIVE' && s.countsCommission);
});

const onDialogOpen = async () => {
  if (!member.value?.id) return;
  loading.value = true;
  apiError.value = false;
  
  // 重置分页状态
  depletedCardsOffset.value = 0;
  
  issueCardForm.cardTypeId = '';
  issueCardForm.staffId = null;
  issueCardForm.paymentMethod = 'CASH';

  try {
    const [memberData, cardTypesData, staffData] = await Promise.all([
      getMemberById(member.value.id),
      getCardTypeList(),
      getStaffList()
    ]);
    member.value = memberData;
    allCardTypes.value = cardTypesData;
    allStaff.value = staffData;
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

const handleIssueCard = async () => {
  if (!issueCardForm.cardTypeId) {
    ElMessage.warning('请先选择要办理的卡类型');
    return;
  }
  isIssuing.value = true;
  try {
    const payload = {
        memberId: member.value.id,
        cardTypeId: issueCardForm.cardTypeId,
        paymentMethod: issueCardForm.paymentMethod,
        ...(issueCardForm.staffId && { staffId: issueCardForm.staffId }),
    };
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
    return new Decimal(0);
  }
  return member.value.cards
    .filter(card => card.status === 'ACTIVE')
    .reduce((sum, card) => sum.plus(new Decimal(card.balance)), new Decimal(0));
});

// 获取有效的会员卡状态文本（考虑余额）
const getEffectiveCardStatusText = (card) => {
  // 如果余额为0，优先显示"余额已用尽"
  if (new Decimal(card.balance).isZero()) {
    return '余额已用尽';
  }
  // 否则显示原始状态
  return cardStatusText(card.status);
};

// 获取有效的会员卡状态标签类型（考虑余额）
const getEffectiveCardStatusTagType = (card) => {
  // 如果余额为0，使用 info 类型
  if (new Decimal(card.balance).isZero()) {
    return 'info';
  }
  // 否则使用原始状态对应的类型
  return cardStatusTagType(card.status);
};

// 计算属性：所有有效的会员卡（余额 > 0）
const activeCards = computed(() => {
  if (!member.value?.cards) return [];
  return member.value.cards.filter(card => 
    new Decimal(card.balance).greaterThan(0) && card.status === 'ACTIVE'
  );
});

// 计算属性：所有余额已用尽的会员卡（余额 = 0）
const depletedCards = computed(() => {
  if (!member.value?.cards) return [];
  return member.value.cards.filter(card => 
    new Decimal(card.balance).isZero()
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
.card-info { display: flex; align-items: center; gap: 10px; }
.card-name { font-weight: 500; }
.card-balance span { font-weight: bold; color: #E6A23C; }
.issue-card-section {
  padding: 15px;
  background-color: #f8f8f9;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-top: 20px;
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
.card-issue-date {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>