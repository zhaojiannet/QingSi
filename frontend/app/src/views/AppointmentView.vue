<template>
  <div class="page-content">
    <!-- 头部区域 -->
    <div class="page-header">
      <h2 class="page-title">预约管理</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增预约</el-button>
    </div>

    <div class="filter-container">
      <el-form :inline="true" :model="filters" class="date-filter-form">
        <el-form-item label="选择日期">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="fetchAppointments"
          />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="quickDate" @change="handleQuickDateChange">
            <el-radio-button label="today">今日</el-radio-button>
            <el-radio-button label="this_week">本周</el-radio-button>
            <el-radio-button label="this_month">本月</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-container">
      <el-table :data="appointments" v-loading="loading" stripe size="large" :default-sort="{prop: 'appointmentTime', order: 'ascending'}">
        <el-table-column label="预约日期" prop="appointmentTime" width="140" sortable>
          <template #default="{ row }">
            {{ formatDateInAppTimeZone(row.appointmentTime) }}
          </template>
        </el-table-column>
        <el-table-column label="预约时间" prop="appointmentTime" width="120" sortable>
          <template #default="{ row }">
            {{ formatTimeInAppTimeZone(row.appointmentTime) }}
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
            <el-tag :type="appointmentStatusTagType(row.status)" effect="light">{{ appointmentStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
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
import { useSystemStore } from '@/stores/system';
import { getAppointments, updateAppointmentStatus } from '@/api/appointment.js';
import { ElMessage } from 'element-plus';
import { Plus, ArrowDown } from '@element-plus/icons-vue';
import AppointmentForm from '@/components/AppointmentForm.vue';
import { appointmentStatusText, appointmentStatusTagType } from '@/utils/formatters.js';
import { formatTimeInAppTimeZone, formatDateInAppTimeZone } from '@/utils/date.js';

// --- 状态定义 ---
const appointments = ref([]);
const loading = ref(false);
const formComponent = ref(null);
const router = useRouter();
const transactionStore = useTransactionStore();
const systemStore = useSystemStore();

const filters = reactive({
  dateRange: [],
});
const quickDate = ref('this_week');

// --- API 调用 ---
const fetchAppointments = async () => {
  if (!filters.dateRange || filters.dateRange.length !== 2) {
    appointments.value = [];
    return;
  }
  loading.value = true;
  try {
    const params = {
      startDate: filters.dateRange[0],
      endDate: filters.dateRange[1],
    };
    appointments.value = await getAppointments(params);
  } finally {
    loading.value = false;
  }
};

const handleQuickDateChange = (value) => {
  const today = new Date();
  let start, end;

  switch (value) {
    case 'today':
      start = today;
      end = today;
      break;
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start = new Date(today.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
  }

  const formatDate = (d) => d.toISOString().split('T')[0];
  filters.dateRange = [formatDate(start), formatDate(end)];

  fetchAppointments();
};

onMounted(() => {
  handleQuickDateChange('this_week');
});

// --- 事件处理 ---
const handleAdd = () => {
  const initialDate = filters.dateRange.length > 0 ? new Date(filters.dateRange[0]) : new Date();
  formComponent.value.open(initialDate);
};

const handleFormSuccess = () => {
  fetchAppointments();
  // 核心修改：在表单成功后，刷新今日预约数
  systemStore.fetchTodayAppointmentCount();
};

const handleStatusCommand = async (command, id) => {
  try {
    await updateAppointmentStatus(id, command);
    ElMessage.success('状态更新成功');
    fetchAppointments(); 
    // 核心修改：在状态改变后，也刷新今日预约数
    systemStore.fetchTodayAppointmentCount();
  } catch {
    // api/index.js 已处理
  }
};

const goToCheckout = (appointment) => {
  const checkoutData = {
    appointmentId: appointment.id,
    memberId: appointment.member?.id,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    serviceIds: appointment.services.map(s => s.id),
    assignedStaffId: appointment.staff?.id || null,
  };
  transactionStore.setAppointmentToCheckout(checkoutData);
  router.push('/transactions');
};
</script>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.filter-container { padding: 15px 20px; background-color: #fafafa; border-radius: 6px; }
.table-container { border: 1px solid #e4e7ed; border-radius: 4px; overflow: hidden; }

.date-filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
.date-filter-form .el-form-item {
  display: flex;
  align-items: center;
  margin-bottom: 0;
}
</style>