<template>
  <el-dialog
    v-model="dialogVisible"
    :title="member ? `${member.name} 的详细信息` : '会员详情'"
    width="600px" 
    top="10vh"
    @open="onDialogOpen"
  >
    <div v-if="loading" v-loading="loading" style="height: 300px;"></div>
    <div v-else-if="member" class="detail-content">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="姓名">{{ member.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ member.phone }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ member.gender === 'MALE' ? '男' : (member.gender === 'FEMALE' ? '女' : '未知') }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(member.status)" size="small">{{ statusText(member.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="注册日期" :span="2">{{ new Date(member.registrationDate).toLocaleDateString() }}</el-descriptions-item>
        <el-descriptions-item label="生日">{{ member.birthday ? new Date(member.birthday).toLocaleDateString() : '未设置' }}</el-descriptions-item>
        <el-descriptions-item label="最后消费">{{ member.lastVisitDate ? new Date(member.lastVisitDate).toLocaleString() : '无记录' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ member.notes || '无' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider>名下会员卡</el-divider>
      
      <div v-if="member.cards && member.cards.length > 0">
        <div v-for="card in member.cards" :key="card.id" class="card-item">
          <div class="card-info">
            <span class="card-name">{{ card.cardType.name }}</span>
            <el-tag size="small" :type="cardStatusTagType(card.status)">{{ cardStatusText(card.status) }}</el-tag>
          </div>
          
          <!-- 核心改动1：将余额和办卡时间包裹在一个容器中，以便于右对齐 -->
          <div class="card-details-right">
            <div class="card-balance">
              余额: <span>¥{{ card.balance.toFixed(2) }}</span>
            </div>
            <!-- 核心改动2：新增办卡时间显示 -->
            <div class="card-issue-date">
              办卡: {{ new Date(card.issueDate).toLocaleString() }}
            </div>
          </div>
        </div>
        
        <div class="card-item total-balance">
          <span class="card-name">所有有效卡总余额</span>
          <div class="card-balance">
            <span>¥{{ totalActiveBalance.toFixed(2) }}</span>
          </div>
        </div>

      </div>
      <el-empty v-else description="暂无会员卡" />

      <el-divider>办理新卡</el-divider>
      <div class="issue-card-section">
        <el-select 
          v-model="selectedCardTypeId" 
          placeholder="选择要办理的卡类型" 
          style="width: 100%; margin-bottom: 10px;"
        >
          <el-option
            v-for="cardType in availableCardTypes"
            :key="cardType.id"
            :label="`${cardType.name} (售价: ¥${cardType.initialPrice.toFixed(2)})`"
            :value="cardType.id"
          />
        </el-select>
        <el-button 
          type="success" 
          style="width: 100%;" 
          @click="handleIssueCard" 
          :loading="isIssuing"
          :disabled="!selectedCardTypeId"
        >
          确认办理
        </el-button>
      </div>

    </div>
    <el-empty v-else description="无法加载会员信息" />
    
    <template #footer>
        <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
// --- script部分与您提供的完全一致，无需任何改动 ---
import { ref, computed } from 'vue';
import { getMemberById } from '@/api/member.js';
import { getCardTypeList } from '@/api/cardType.js';
import { issueCardWithTransaction } from '@/api/card.js';
import { ElMessage } from 'element-plus';

const dialogVisible = ref(false);
const loading = ref(false);
const isIssuing = ref(false);
const member = ref(null);
const allCardTypes = ref([]);
const selectedCardTypeId = ref('');

const statusText = (status) => {
  const map = { ACTIVE: '正常', INACTIVE: '停用', FROZEN: '冻结', DELETED: '已注销' };
  return map[status] || '未知';
};

const statusTagType = (status) => {
  const map = { ACTIVE: 'success', INACTIVE: 'info', FROZEN: 'warning', DELETED: 'danger' };
  return map[status] || 'info';
};

const cardStatusText = (status) => {
  const map = { ACTIVE: '有效', DEPLETED: '已用尽', EXPIRED: '已过期', FROZEN: '已冻结' };
  return map[status] || '未知';
};

const cardStatusTagType = (status) => {
  const map = { ACTIVE: 'success', DEPLETED: 'info', EXPIRED: 'warning', FROZEN: 'danger' };
  return map[status] || 'info';
};

const availableCardTypes = computed(() => {
  return allCardTypes.value.filter(ct => ct.status === 'AVAILABLE');
});

const onDialogOpen = async () => {
  if (!member.value?.id) return;
  loading.value = true;
  selectedCardTypeId.value = '';
  try {
    const [memberData, cardTypesData] = await Promise.all([
      getMemberById(member.value.id),
      getCardTypeList()
    ]);
    member.value = memberData;
    allCardTypes.value = cardTypesData;
  } catch {
    // API层已处理
  } finally {
    loading.value = false;
  }
};

const open = (memberId) => {
  member.value = { id: memberId };
  dialogVisible.value = true;
};

const handleIssueCard = async () => {
  if (!selectedCardTypeId.value) {
    ElMessage.warning('请先选择要办理的卡类型');
    return;
  }
  isIssuing.value = true;
  try {
    await issueCardWithTransaction({ 
      memberId: member.value.id, 
      cardTypeId: selectedCardTypeId.value 
    });
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
    return 0;
  }
  return member.value.cards
    .filter(card => card.status === 'ACTIVE')
    .reduce((sum, card) => sum + card.balance, 0);
});

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
  padding: 10px;
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

/* --- 核心改动3：新增的样式 --- */
.card-details-right {
  text-align: right;
}
.card-issue-date {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>