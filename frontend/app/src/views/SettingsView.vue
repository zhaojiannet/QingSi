<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">系统设置</h2>
    </div>

    <!-- 核心修复：移除所有 v-if，改为通过 CSS class 控制显示 -->
    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane
        label="服务项目"
        name="services"
        :class="{ 'is-hidden': !canAccessServiceManagement }"
      >
        <ServiceManager />
      </el-tab-pane>

      <el-tab-pane
        label="会员卡类型"
        name="cardTypes"
        :class="{ 'is-hidden': !canAccessCardTypeManagement }"
      >
        <CardTypeManager />
      </el-tab-pane>

      <el-tab-pane
        label="员工"
        name="staff"
        :class="{ 'is-hidden': !canAccessStaffManagement }"
      >
        <StaffManager />
      </el-tab-pane>

      <el-tab-pane label="账户设置" name="account">
        <PasswordManager />
      </el-tab-pane>

      <el-tab-pane
        label="通用设置"
        name="general"
        :class="{ 'is-hidden': !canAccessGeneralSettings }"
      >
        <ConfigManager />
      </el-tab-pane>

      <el-tab-pane
        label="交易撤销"
        name="voidLogs"
        :class="{ 'is-hidden': !canAccessVoidLogs }"
      >
        <VoidLogManager />
      </el-tab-pane>

      <el-tab-pane
        label="预约设置"
        name="booking"
        :class="{ 'is-hidden': !canAccessBookingSettings }"
      >
        <BookingManager />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useUserStore } from '@/stores/user';
import ServiceManager from '@/components/settings/ServiceManager.vue';
import CardTypeManager from '@/components/settings/CardTypeManager.vue';
import StaffManager from '@/components/settings/StaffManager.vue';
import PasswordManager from '@/components/settings/PasswordManager.vue';
import ConfigManager from '@/components/settings/ConfigManager.vue';
import VoidLogManager from '@/components/settings/VoidLogManager.vue';
import BookingManager from '@/components/settings/BookingManager.vue';

const userStore = useUserStore();

const canAccessServiceManagement = computed(() => userStore.userRole === 'ADMIN');
const canAccessCardTypeManagement = computed(() => userStore.userRole === 'ADMIN');
// --- 核心修改：店长也可以管理员工 ---
const canAccessStaffManagement = computed(() => ['ADMIN', 'MANAGER'].includes(userStore.userRole));
const canAccessGeneralSettings = computed(() => userStore.userRole === 'ADMIN');
const canAccessVoidLogs = computed(() => ['ADMIN', 'MANAGER'].includes(userStore.userRole));
const canAccessBookingSettings = computed(() => userStore.userRole === 'ADMIN');


// 默认激活第一个Tab，逻辑大大简化
const activeTab = ref('services');

// 确保在组件挂载后，如果默认的Tab对当前用户不可见，
// 则自动切换到第一个可见的Tab。
onMounted(async () => {
    // 等待DOM更新，确保 canAccess... 计算属性已经获取到正确的角色
    await nextTick();

    const tabsVisibility = {
        services: canAccessServiceManagement.value,
        cardTypes: canAccessCardTypeManagement.value,
        staff: canAccessStaffManagement.value,
        account: true, // 账户设置总是可见
        general: canAccessGeneralSettings.value,
        voidLogs: canAccessVoidLogs.value,
        booking: canAccessBookingSettings.value,
    };

    // 如果当前激活的Tab是不可见的
    if (!tabsVisibility[activeTab.value]) {
        // 找到第一个可见的Tab并设置为激活状态
        const firstVisibleTab = Object.keys(tabsVisibility).find(tab => tabsVisibility[tab]);
        if (firstVisibleTab) {
            activeTab.value = firstVisibleTab;
        }
    }
});
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

/* 核心修复：使用 :deep() 选择器来隐藏无权限的 Tab 标签 */
.settings-tabs :deep(.el-tab-pane.is-hidden) {
    display: none;
}
</style>