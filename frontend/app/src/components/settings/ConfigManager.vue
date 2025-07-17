<template>
  <div class="config-manager-container" v-loading="loading">
    <el-form label-width="150px" style="max-width: 500px">
      <el-form-item label="开启登录验证码">
        <el-switch 
          v-model="config.enableLoginCaptcha"
          @change="handleConfigChange"
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
});

onMounted(async () => {
  loading.value = true;
  try {
    config.value = await getSystemConfig();
  } finally {
    loading.value = false;
  }
});

const handleConfigChange = async () => {
  try {
    await updateSystemConfig({
      enableLoginCaptcha: config.value.enableLoginCaptcha,
    });
    ElMessage.success('配置更新成功');
  } catch {
    // 如果失败，将开关恢复原状
    config.value.enableLoginCaptcha = !config.value.enableLoginCaptcha;
  }
};
</script>

<style scoped>
.config-manager-container {
  padding-top: 20px;
}
</style>