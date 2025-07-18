<template>
  <div class="page-content">
    <!-- 头部区域 -->
    <div class="page-header">
      <h2 class="page-title">会员列表</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增会员</el-button>
    </div>

    <!-- 搜索与筛选区域 -->
    <div class="filter-container">
      <el-form :inline="true" :model="searchParams">
        <el-form-item>
  <el-input
    v-model="searchParams.search"
    placeholder="输入会员姓名或手机号进行搜索"
    clearable
    size="large"
    style="width: 360px;"
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
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="phone" label="手机号" width="150" />
        
        <el-table-column label="会员卡" width="120" align="center">
          <template #default="{ row }">
            <div @click.stop="handleCardManagement(row)" class="card-cell-content">
              <el-badge 
                :value="row._count.cards" 
                class="card-badge" 
                :hidden="row._count.cards === 0"
              >
                <el-tag :type="row._count.cards > 0 ? 'warning' : 'info'" class="card-tag">
                  {{ row._count.cards > 0 ? '有卡' : '无卡' }}
                </el-tag>
              </el-badge>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="gender" label="性别" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.gender === 'MALE'" type="primary" size="small">男</el-tag>
            <el-tag v-else-if="row.gender === 'FEMALE'" type="danger" size="small">女</el-tag>
            <el-tag v-else type="info" size="small">未知</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <!-- 优化点5: 使用通用格式化函数 -->
            <el-tag :type="memberStatusTagType(row.status)" size="small">{{ memberStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="registrationDate" label="注册日期" width="180">
          <template #default="{ row }">
            <!-- 优化点4: 使用统一时区处理函数 -->
            {{ formatInAppTimeZone(row.registrationDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="default" :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页区域 -->
    <div class="pagination-container">
       <el-pagination
        v-if="total > 0"
        :class="{ 'is-mobile': isMobile }"
        v-model:current-page="searchParams.page"
        v-model:page-size="searchParams.limit"
        :page-sizes="[10, 20, 50, 100]"
        :layout="paginationLayout"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 新增/编辑会员表单组件 -->
    <MemberForm ref="memberFormRef" @success="handleFormSuccess" />
    <MemberDetailDrawer ref="detailDrawerRef" @success="handleFormSuccess" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useBreakpoints } from '@vueuse/core';
import { getMembers } from '@/api/member.js';
import { Plus, Edit, Search } from '@element-plus/icons-vue'; 
import MemberForm from '@/components/MemberForm.vue';
import MemberDetailDrawer from '@/components/member/MemberDetailDrawer.vue';
// 优化点5: 引入通用格式化函数
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';
// 优化点4: 引入统一时区处理函数
import { formatInAppTimeZone } from '@/utils/date.js';

// --- 响应式状态 ---
const members = ref([]);
const loading = ref(false);
const total = ref(0);
const searchParams = reactive({
  page: 1,
  limit: 10,
  search: '',
});
const memberFormRef = ref(null);
const detailDrawerRef = ref(null);

// --- 数据获取与实时搜索 ---
const fetchMembers = async () => {
  loading.value = true;
  try {
    const res = await getMembers(searchParams);
    members.value = res.data;
    total.value = res.total;
  } catch(error) {
    console.error("获取会员列表失败:", error);
    members.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchMembers();
});

let debounceTimer = null;
watch(() => searchParams.search, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchParams.page = 1;
    fetchMembers();
  }, 500);
});

// --- 事件处理 ---
const handleSizeChange = (val) => {
  searchParams.limit = val;
  fetchMembers();
};

const handleCurrentChange = (val) => {
  searchParams.page = val;
  fetchMembers();
};

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

// --- 分页响应式布局 ---
const breakpoints = useBreakpoints({ mobile: 767 });
const isMobile = breakpoints.smaller('mobile');

const paginationLayout = computed(() => {
  return isMobile.value
    ? 'prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper';
});

// --- 辅助函数 (本地函数已移除, 改用通用函数) ---
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
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
.pagination-container .is-mobile {
  justify-content: center;
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
.card-badge {
  transform: translateY(-2px);
}
</style>