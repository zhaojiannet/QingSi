<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">系统设置</h2>
    </div>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="服务项目管理" name="services">
        <ServiceManager />
      </el-tab-pane>
      
      <el-tab-pane label="会员卡类型管理" name="cardTypes">
        <CardTypeManager />
      </el-tab-pane>
      
      <!-- 核心改动：引入新组件 -->
      <el-tab-pane label="员工管理" name="staff">
        <StaffManager />
      </el-tab-pane>

        <el-tab-pane label="账户设置" name="account">
    <PasswordManager />
  </el-tab-pane>
      <el-tab-pane label="通用设置" name="general"><ConfigManager /></el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ServiceManager from '@/components/settings/ServiceManager.vue';
import CardTypeManager from '@/components/settings/CardTypeManager.vue';
// 核心改动：引入新组件
import StaffManager from '@/components/settings/StaffManager.vue';
import PasswordManager from '@/components/settings/PasswordManager.vue';
import ConfigManager from '@/components/settings/ConfigManager.vue';

const activeTab = ref('services');
</script>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.settings-tabs {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.settings-tabs :deep(.el-tabs__content) {
  flex-grow: 1;
  overflow-y: auto;
}
</style>