<template>
  <div class="page-content">
    <!-- 头部区域 -->
    <div class="page-header">
      <h2 class="page-title">会员列表</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增会员</el-button>
    </div>

    <!-- 搜索与筛选区域 -->
    <div class="filter-container">
      <el-form :inline="true" :model="searchParams" @submit.prevent>
        <el-form-item>
  <el-input
    v-model="searchParams.search"
    placeholder="输入会员姓名或手机号进行搜索"
    clearable
    size="large"
    style="width: 360px;"
    @input="handleSearchDebounced"
  >
    <template #prefix>
      <el-icon><Search /></el-icon>
    </template>
  </el-input>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-container">
      <el-table :data="members" v-loading="loading" style="width: 100%" stripe size="large">
        <!-- 1. 姓名 -->
        <el-table-column prop="name" label="姓名" width="100" />
        
        <!-- 2. 性别 -->
        <el-table-column prop="gender" label="性别" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.gender === 'MALE'" type="primary" size="small">男</el-tag>
            <el-tag v-else-if="row.gender === 'FEMALE'" type="danger" size="small">女</el-tag>
            <el-tag v-else type="info" size="small">未知</el-tag>
          </template>
        </el-table-column>
        
        <!-- 3. 手机号 -->
        <el-table-column prop="phone" label="手机号" width="150" />
        
        <!-- 4. 会员卡 -->
        <el-table-column label="会员卡" width="120" align="center">
          <template #default="{ row }">
            <div @click.stop="handleCardManagement(row)" class="card-cell-content">
              <div v-if="getCardStats(row).totalCount > 0" class="card-display">
                <el-icon class="card-icon"><CreditCard /></el-icon>
                <el-tag type="warning" size="small" class="card-tag">
                  有卡 <span class="active-count">{{ getCardStats(row).activeCount }}</span> / <span class="total-count">{{ getCardStats(row).totalCount }}</span>
                </el-tag>
              </div>
              <div v-else class="card-display">
                <el-icon class="card-icon"><CreditCard /></el-icon>
                <el-tag type="info" size="small" class="card-tag">
                  无卡
                </el-tag>
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 5. 状态 -->
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="memberStatusTagType(row.status)" size="small">{{ memberStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        
        <!-- 6. 余额 -->
        <el-table-column label="余额" width="120" align="right">
          <template #default="{ row }">
            <span :class="['balance-amount', { 'zero-balance': row.totalBalance === 0 }]">
              {{ formatCurrency(row.totalBalance || 0) }}
            </span>
          </template>
        </el-table-column>
        
        <!-- 7. 挂账 -->
        <el-table-column label="挂账" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.totalPending && row.totalPending > 0" class="pending-amount">
              {{ formatCurrency(row.totalPending) }}
            </span>
            <span v-else class="no-pending">-</span>
          </template>
        </el-table-column>
        
        <!-- 8. 注册日期 -->
        <el-table-column prop="registrationDate" label="注册日期" width="120">
          <template #default="{ row }">
            <el-tooltip
              :content="formatFullDateTimeInAppTimeZone(row.registrationDate)"
              placement="top"
              effect="dark"
            >
              {{ formatShortDateInAppTimeZone(row.registrationDate) }}
            </el-tooltip>
          </template>
        </el-table-column>
        
        <!-- 9. 备注 -->
        <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
        
        <!-- 10. 操作 -->
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="default" :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页加载更多区域 -->
    <div class="pagination-section">
      <div v-if="hasMore" class="load-more-container">
        <el-button 
          @click="loadMoreMembers" 
          :loading="isLoadingMore"
          type="primary"
          size="small"
          style="padding: 12px 24px; border-radius: 6px;"
        >
          {{ isLoadingMore ? '加载中...' : `加载更多 (已显示 ${members.length}/${total} 条)` }}
        </el-button>
      </div>
      <div v-else-if="members.length > 0" class="all-loaded">
        已显示全部 {{ total }} 条记录
      </div>
    </div>

    <!-- 新增/编辑会员表单组件 -->
    <MemberForm ref="memberFormRef" @success="handleFormSuccess" />
    <MemberDetailDrawer ref="detailDrawerRef" @success="handleFormSuccess" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { getMembers } from '@/api/member.js';
import { Plus, Edit, Search, CreditCard } from '@element-plus/icons-vue'; 
import MemberForm from '@/components/MemberForm.vue';
import MemberDetailDrawer from '@/components/member/MemberDetailDrawer.vue';
// 优化点5: 引入通用格式化函数
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';
// 优化点4: 引入统一时区处理函数
import { formatInAppTimeZone, formatShortDateInAppTimeZone, formatFullDateTimeInAppTimeZone } from '@/utils/date.js';
// 引入货币格式化函数
import { formatCurrency } from '@/utils/currency.js';
// 性能优化工具
import { debounce } from '@/utils/performance.js';

// --- 响应式状态 ---
const members = ref([]);
const loading = ref(false);
const total = ref(0);
const searchParams = reactive({
  page: 1,
  limit: 20,
  search: '',
});
const isLoadingMore = ref(false);
const hasMore = ref(true);
const memberFormRef = ref(null);
const detailDrawerRef = ref(null);

// --- 数据获取与实时搜索 ---
const fetchMembers = async (reset = true) => {
  if (reset) {
    loading.value = true;
    searchParams.page = 1;
    members.value = [];
  } else {
    isLoadingMore.value = true;
  }
  
  try {
    const res = await getMembers(searchParams);
    
    if (reset) {
      members.value = res.data;
    } else {
      members.value.push(...res.data);
    }
    
    total.value = res.total;
    hasMore.value = members.value.length < res.total;
  } catch(error) {
    // Error fetching members - handled silently
    if (reset) {
      members.value = [];
      total.value = 0;
    }
  } finally {
    loading.value = false;
    isLoadingMore.value = false;
  }
};

onMounted(() => {
  fetchMembers();
});

// 使用防抖优化搜索
const handleSearchDebounced = debounce(() => {
  fetchMembers(true);
}, 500);

// 加载更多会员
const loadMoreMembers = async () => {
  if (isLoadingMore.value || !hasMore.value) return;
  
  searchParams.page++;
  await fetchMembers(false);
};

// --- 事件处理 ---

const handleAdd = () => {
  memberFormRef.value.open();
};

const handleFormSuccess = () => {
  fetchMembers();
};

const handleEdit = (row) => {
  memberFormRef.value.open(row);
};

const handleCardManagement = (row) => {
  detailDrawerRef.value.open(row.id);
};

// --- 已移除传统分页逻辑 ---

// --- 辅助函数 ---
const getCardStats = (member) => {
  if (!member._count || !member.cards) {
    return { activeCount: 0, totalCount: 0 };
  }
  
  // 计算有效卡数量（余额 > 0 且状态为 ACTIVE）
  const activeCount = member.cards.filter(card => 
    card.status === 'ACTIVE' && parseFloat(card.balance) > 0
  ).length;
  
  return {
    activeCount,
    totalCount: member._count.cards
  };
};
</script>

<style scoped>
.page-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 15px;
}
.page-title {
  font-size: 22px;
  margin: 0;
  color: #303133;
}
.filter-container {
  padding: 15px 20px;
  background-color: #fafafa;
  border-radius: 6px;
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
.table-container :deep(.el-table .el-table__cell) {
  overflow: visible; 
  padding-top: 12px;
}
.table-container :deep(.el-table .cell) {
  overflow: visible;
}
.card-cell-content {
  cursor: pointer;
}
.card-display {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.card-tag {
  font-size: 12px;
  border-radius: 4px;
}
.card-icon {
  font-size: 16px;
  color: #E6A23C;
}
.active-count {
  color: inherit;
  font-weight: bold;
}
.total-count {
  color: inherit;
  font-weight: normal;
}

/* 余额和挂账列样式 */
.balance-amount {
  font-weight: bold;
  color: #E6A23C;
}

.balance-amount.zero-balance {
  color: #C0C4CC;
  font-weight: normal;
}

.pending-amount {
  font-weight: bold;
  color: #f56c6c;
}

.no-pending {
  color: #C0C4CC;
  font-style: italic;
}
</style>