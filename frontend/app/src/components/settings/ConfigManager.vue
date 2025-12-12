<template>
  <div class="config-manager-container" v-loading="loading">
    <el-form label-width="150px" style="max-width: 600px" class="no-wrap-labels">
      <el-form-item label="开启登录验证码">
        <el-switch
          v-model="config.enableLoginCaptcha"
          @change="() => handleConfigChange('enableLoginCaptcha')"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getSystemConfig, updateSystemConfig } from '@/api/config.js';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const config = ref({
  enableLoginCaptcha: true,
  enableTransactionVoid: false,
});

onMounted(async () => {
  loading.value = true;
  try {
    config.value = await getSystemConfig();
  } finally {
    loading.value = false;
  }
});

const handleConfigChange = async (field) => {
  const previousValue = !config.value[field];
  try {
    await updateSystemConfig({
      [field]: config.value[field],
    });
    ElMessage.success('配置更新成功');
  } catch {
    config.value[field] = previousValue;
  }
};
</script>

<style scoped>
.config-manager-container {
  padding-top: 20px;
}

.no-wrap-labels :deep(.el-form-item__label) {
  white-space: nowrap;
}

.switch-with-hint {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-hint {
  color: #909399;
  font-size: 12px;
}
</style>