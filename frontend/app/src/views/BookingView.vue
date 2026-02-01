<template>
  <div class="booking-page">
    <!-- 头部 -->
    <header class="booking-header">
      <img :src="appConfig.logo" alt="Logo" class="header-logo" />
      <div class="header-text">
        <span class="header-title">{{ appConfig.brandName }}</span>
        <span class="header-subtitle">在线预约</span>
      </div>
    </header>

    <!-- 内容区域 -->
    <main class="booking-main">
      <!-- 无效链接 -->
      <div v-if="pageState === 'invalid'" class="result-card">
        <el-icon class="result-icon error"><WarningFilled /></el-icon>
        <h2>链接无效或已过期</h2>
        <p>请联系店铺获取有效的预约链接</p>
      </div>

      <!-- 加载中 -->
      <div v-else-if="pageState === 'loading'" class="result-card">
        <el-icon class="result-icon loading is-loading"><Loading /></el-icon>
        <p>加载中...</p>
      </div>

      <!-- 预约成功 -->
      <div v-else-if="pageState === 'success'" class="result-card">
        <el-icon class="result-icon success"><CircleCheckFilled /></el-icon>
        <h2>预约成功</h2>
        <p>我们会尽快与您确认，请保持手机畅通</p>
      </div>

      <!-- 预约表单 -->
      <div v-else class="form-card">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" hide-required-asterisk>
          <el-form-item label="姓名" prop="customerName">
            <el-input v-model="form.customerName" placeholder="请输入您的姓名" maxlength="20" clearable size="large" />
          </el-form-item>

          <el-form-item label="手机号" prop="customerPhone">
            <el-input v-model="form.customerPhone" placeholder="请输入手机号" maxlength="11" clearable size="large" />
          </el-form-item>

          <div class="form-row">
            <el-form-item label="预约日期" prop="appointmentDate" class="form-col">
              <el-date-picker
                v-model="form.appointmentDate"
                type="date"
                placeholder="选择日期"
                :disabled-date="disabledDate"
                size="large"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item label="预约时段" prop="appointmentHour" class="form-col">
              <el-select v-model="form.appointmentHour" placeholder="选择时段" size="large" style="width: 100%">
                <el-option v-for="slot in timeSlots" :key="slot.value" :label="slot.label" :value="slot.value" />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item label="服务项目" prop="serviceIds">
            <el-select v-model="form.serviceIds" multiple placeholder="选择服务项目" size="large" style="width: 100%">
              <el-option v-for="s in options.services" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="指定员工（可选）">
            <el-select v-model="form.assignedStaffId" placeholder="不指定" clearable size="large" style="width: 100%">
              <el-option v-for="s in options.staff" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="留言（可选）">
            <el-input v-model="form.notes" type="textarea" :rows="4" placeholder="请在此留言" maxlength="200" />
          </el-form-item>

          <el-button type="primary" size="large" round :loading="submitting" @click="handleSubmit" class="submit-btn">
            提交预约
          </el-button>
        </el-form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { WarningFilled, CircleCheckFilled, Loading } from '@element-plus/icons-vue';
import { getBookingOptions, createBooking } from '@/api/booking.js';
import appConfig from '@/config/app.js';

const route = useRoute();
const formRef = ref(null);
const pageState = ref('loading');
const submitting = ref(false);
const bookingCode = ref('');

const options = reactive({ services: [], staff: [] });

const form = reactive({
  customerName: '',
  customerPhone: '',
  appointmentDate: null,
  appointmentHour: '',
  serviceIds: [],
  assignedStaffId: '',
  notes: ''
});

const rules = {
  customerName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  customerPhone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  appointmentDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
  appointmentHour: [{ required: true, message: '请选择时段', trigger: 'change' }],
  serviceIds: [{ required: true, message: '请选择服务', trigger: 'change', type: 'array', min: 1 }]
};

const timeSlots = computed(() => {
  const slots = [];
  for (let h = 8; h < 22; h++) {
    const hour = String(h).padStart(2, '0');
    const nextHour = String(h + 1).padStart(2, '0');
    slots.push({ value: `${hour}:00`, label: `${hour}:00 - ${hour}:30` });
    slots.push({ value: `${hour}:30`, label: `${hour}:30 - ${nextHour}:00` });
  }
  return slots;
});

const disabledDate = (time) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time.getTime() < today.getTime();
};

onMounted(async () => {
  document.title = `在线预约 - ${appConfig.brandName}`;
  bookingCode.value = route.params.code || '';

  if (!bookingCode.value) {
    pageState.value = 'invalid';
    return;
  }

  try {
    const data = await getBookingOptions(bookingCode.value);
    options.services = data.services;
    options.staff = data.staff;
    pageState.value = 'form';
  } catch {
    pageState.value = 'invalid';
  }
});

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const date = new Date(form.appointmentDate);
      const [h, m] = form.appointmentHour.split(':');
      date.setHours(parseInt(h), parseInt(m), 0, 0);

      await createBooking(bookingCode.value, {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        appointmentTime: date.toISOString(),
        serviceIds: form.serviceIds,
        assignedStaffId: form.assignedStaffId || undefined,
        notes: form.notes || undefined
      });
      pageState.value = 'success';
    } catch (err) {
      ElMessage.error(err.response?.data?.error || '提交失败，请稍后重试');
    } finally {
      submitting.value = false;
    }
  });
};

</script>

<style scoped>
.booking-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding-bottom: env(safe-area-inset-bottom);
}

.booking-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 16px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header-logo {
  height: 44px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 22px;
  font-weight: 600;
  color: #25686c;
}

.header-subtitle {
  font-size: 13px;
  color: #909399;
}

.booking-main {
  padding: 16px;
  max-width: 500px;
  margin: 0 auto;
}

.result-card,
.form-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.result-card {
  text-align: center;
  padding: 48px 24px;
}

.result-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.result-icon.error { color: #f56c6c; }
.result-icon.success { color: #67c23a; }
.result-icon.loading { color: #25686c; }

.result-card h2 {
  font-size: 20px;
  color: #303133;
  margin: 0 0 8px;
}

.result-card p {
  color: #909399;
  margin: 0 0 24px;
  font-size: 14px;
}

.form-card :deep(.el-form-item) {
  margin-bottom: 18px;
}

.form-card :deep(.el-form-item__label) {
  font-weight: 500;
  color: #303133;
  font-size: 14px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-col {
  flex: 1;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  margin-top: 8px;
  background-color: #25686c !important;
  border-color: #25686c !important;
}

.submit-btn:hover,
.submit-btn:focus {
  background-color: #1d5457 !important;
  border-color: #1d5457 !important;
}

@media (max-width: 480px) {
  .booking-header {
    padding: 16px;
  }

  .header-logo {
    height: 36px;
  }

  .header-title {
    font-size: 18px;
  }

  .booking-main {
    padding: 12px;
  }

  .form-card {
    padding: 20px 16px;
  }

  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .result-card {
    padding: 40px 20px;
  }

  .result-icon {
    font-size: 56px;
  }
}
</style>
