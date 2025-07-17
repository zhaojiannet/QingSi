<template>
  <div class="page-content">
    <!-- 头部区域 -->
    <div class="page-header">
      <h2 class="page-title">预约管理</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增预约</el-button>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-container">
      <el-form :inline="true" :model="filters">
        <el-form-item label="选择日期">
          <div class="date-selector-wrapper">
            <el-button :icon="DArrowLeft" link @click="changeDate(-1)" />
            <el-date-picker
              v-model="filters.date"
              type="date"
              placeholder="选择一天"
              value-format="YYYY-MM-DD"
              @change="fetchAppointments"
              class="custom-date-range-picker"
            />
            <el-button :icon="DArrowRight" link @click="changeDate(1)" />
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-container">
      <el-table :data="appointments" v-loading="loading" stripe size="large" :default-sort="{prop: 'appointmentTime', order: 'ascending'}">
        <el-table-column label="预约时间" prop="appointmentTime" width="160" sortable>
          <template #default="{ row }">
            {{ formatTime(row.appointmentTime) }}
          </template>
        </el-table-column>
        <el-table-column label="顾客信息" prop="customerName" width="200">
          <template #default="{ row }">
            <div>{{ row.customerName }}</div>
            <div>{{ row.customerPhone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="预约项目" prop="services">
          <template #default="{ row }">
            {{ row.services.map(s => s.name).join(', ') }}
          </template>
        </el-table-column>
        <el-table-column label="服务员工" prop="staff.name" width="120" />
        <el-table-column label="状态" prop="status" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <!-- --- 核心修改1：根据 transactionId 判断按钮状态 --- -->
            <el-button 
              v-if="row.transactionId"
              link 
              type="info"
              disabled
            >
              已结算
            </el-button>
            <el-button 
              v-else-if="['CONFIRMED', 'COMPLETED'].includes(row.status)"
              link 
              type="success"
              @click="goToCheckout(row)"
            >
              去结算
            </el-button>
             <el-dropdown trigger="click" @command="(cmd) => handleStatusCommand(cmd, row.id)">
                <el-button type="primary" link>
                  更改状态<el-icon class="el-icon--right"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="CONFIRMED" :disabled="row.status === 'CONFIRMED'">标记为已确认</el-dropdown-item>
                    <el-dropdown-item command="COMPLETED" :disabled="row.status === 'COMPLETED'">标记为已完成</el-dropdown-item>
                    <el-dropdown-item command="CANCELLED" :disabled="row.status === 'CANCELLED'">标记为已取消</el-dropdown-item>
                    <el-dropdown-item command="NO_SHOW" :disabled="row.status === 'NO_SHOW'">标记为未到店</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑表单 -->
    <AppointmentForm ref="formComponent" @success="handleFormSuccess" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTransactionStore } from '@/stores/transaction';
import { getAppointments, updateAppointmentStatus } from '@/api/appointment.js';
import { ElMessage } from 'element-plus';
import { Plus, ArrowDown, DArrowLeft, DArrowRight } from '@element-plus/icons-vue';
import AppointmentForm from '@/components/AppointmentForm.vue';

// --- 状态定义 ---
const appointments = ref([]);
const loading = ref(false);
const formComponent = ref(null);
// --- 核心修正：补全 router 和 store 的实例化 ---
const router = useRouter();
const transactionStore = useTransactionStore();

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const filters = reactive({
  date: getTodayDateString(),
});

// --- API 调用 ---
const fetchAppointments = async () => {
  loading.value = true;
  try {
    const params = {
      startDate: filters.date,
      endDate: filters.date,
    };
    appointments.value = await getAppointments(params);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAppointments();
});

// --- 事件处理 ---
const handleAdd = () => {
  formComponent.value.open(new Date(filters.date));
};

const handleFormSuccess = () => {
  fetchAppointments();
};

const handleStatusCommand = async (command, id) => {
  try {
    await updateAppointmentStatus(id, command);
    ElMessage.success('状态更新成功');
    fetchAppointments(); 
  } catch {
    // api/index.js 已处理
  }
};

const changeDate = (dayOffset) => {
  const currentDate = new Date(filters.date);
  currentDate.setDate(currentDate.getDate() + dayOffset);
  
  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getDate().toString().padStart(2, '0');
  
  filters.date = `${year}-${month}-${day}`;
  
  fetchAppointments();
};

// --- 核心修改2：在 goToCheckout 中传递 appointment.id ---
const goToCheckout = (appointment) => {
  const checkoutData = {
    appointmentId: appointment.id, // 新增：传递预约ID
    memberId: appointment.member?.id,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    serviceIds: appointment.services.map(s => s.id),
    assignedStaffId: appointment.staff?.id || null,
  };
  transactionStore.setAppointmentToCheckout(checkoutData);
  router.push('/transactions');
};



// --- 辅助函数 ---
const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const statusText = (status) => {
  const map = { PENDING: '待确认', CONFIRMED: '已确认', COMPLETED: '已完成', CANCELLED: '已取消', NO_SHOW: '未到店' };
  return map[status] || '未知';
};

const statusTagType = (status) => {
  const map = { PENDING: 'warning', CONFIRMED: 'primary', COMPLETED: 'success', CANCELLED: 'info', NO_SHOW: 'danger' };
  return map[status] || 'info';
};
</script>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.filter-container { padding: 15px 20px; background-color: #fafafa; border-radius: 6px; }
.table-container { border: 1px solid #e4e7ed; border-radius: 4px; overflow: hidden; }

.date-selector-wrapper {
  display: flex;
  align-items: center;
  background-color: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  padding: 1px;
  transition: all 0.3s;
}
.date-selector-wrapper:hover {
  border-color: var(--el-color-primary);
}
.date-selector-wrapper :deep(.el-date-editor.el-input) {
  border: none;
  width: 150px;
}
.date-selector-wrapper :deep(.el-date-editor.el-input .el-input__wrapper) {
  box-shadow: none !important;
}
.date-selector-wrapper .el-button {
  font-size: 16px;
  color: #909399;
}
</style>