<template>
  <!-- 核心改动1：用一个 v-if 判断，只有在非登录页才显示整个布局 -->
  <div v-if="!isLoginPage" class="app-wrapper">
    <!-- 统一的顶部导航栏 -->
    <el-header class="app-header">
      <div class="header-content">
        <!-- Logo容器 -->
        <div class="logo-container">
          <img src="@/assets/images/qingsi_logo.png" alt="Logo" class="logo-img" />
          <span class="logo-text">青丝 · 美业综合管理系统</span>
        </div>
        
        <!-- PC端导航 -->
        <div class="header-right pc-nav">
          <nav class="custom-nav">
            <router-link
              v-for="item in filteredMenuItems"
              :key="item.index"
              :to="item.index"
              class="nav-item"
              active-class="is-active"
            >
              <!-- 核心修改：为“预约”菜单项包裹 el-badge -->
              <el-badge 
                :value="systemStore.todayAppointmentCount" 
                :hidden="systemStore.todayAppointmentCount === 0" 
                class="nav-badge"
                v-if="item.index === '/appointments'"
              >
                <div class="nav-item-content">
                  <el-icon><component :is="item.icon" /></el-icon>
                  <span>{{ item.title }}</span>
                </div>
              </el-badge>
              <!-- 其他菜单项正常显示 -->
              <div class="nav-item-content" v-else>
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.title }}</span>
              </div>
            </router-link>
          </nav>
          <div v-if="userStore.isLoggedIn" class="user-profile">
             <el-dropdown @command="handleCommand">
              <span class="el-dropdown-link">
                <el-avatar :icon="UserFilled" size="small" />
                <span class="username">admin</span>
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 移动端，只在顶部显示Logo和用户信息 -->
         <div class="header-right mobile-only">
            <div v-if="userStore.isLoggedIn" class="user-profile">
                <el-dropdown @command="handleCommand">
                <span class="el-dropdown-link">
                    <el-avatar :icon="UserFilled" size="small" />
                    <span class="username">admin</span>
                </span>
                <template #dropdown>
                    <el-dropdown-menu>
                    <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                    </el-dropdown-menu>
                </template>
                </el-dropdown>
            </div>
        </div>

      </div>
    </el-header>

    <!-- 主体内容区域 -->
    <main class="app-main">
      <div class="main-content-wrapper">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <div class="page-container" v-if="Component">
              <component :is="Component" />
            </div>
          </transition>
        </router-view>
      </div>
    </main>
    
    <!-- 移动端底部导航栏 -->
    <footer class="mobile-nav">
       <router-link
            v-for="item in filteredMenuItems"
            :key="item.index"
            :to="item.index"
            class="nav-item"
            active-class="is-active"
          >
            <!-- 核心修改：为移动端“预约”菜单项包裹 el-badge -->
            <el-badge 
              :value="systemStore.todayAppointmentCount" 
              :hidden="systemStore.todayAppointmentCount === 0" 
              class="nav-badge-mobile"
              v-if="item.index === '/appointments'"
            >
              <div class="nav-item-content-mobile">
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.title }}</span>
              </div>
            </el-badge>
            <div class="nav-item-content-mobile" v-else>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </div>
        </router-link>
    </footer>
  </div>
  
  <router-view v-else />
</template>

<script setup>
import { shallowRef, computed, onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { useSystemStore } from '@/stores/system';
import { useRoute, onBeforeRouteUpdate } from 'vue-router';
import { Tickets, User, Calendar, DataAnalysis, Tools, UserFilled, ArrowDown } from '@element-plus/icons-vue';

const userStore = useUserStore();
const systemStore = useSystemStore();
const route = useRoute();

const isLoginPage = computed(() => route.name === 'login');

onMounted(() => {
  if (userStore.isLoggedIn) {
    systemStore.fetchTodayAppointmentCount();
  }
});

onBeforeRouteUpdate((to, from) => {
  if (from.name === 'login' && to.name !== 'login') {
    systemStore.fetchTodayAppointmentCount();
  }
});

const menuItems = shallowRef([
  { index: '/transactions', title: '收银', icon: Tickets },
  { index: '/members', title: '会员', icon: User },
  { index: '/appointments', title: '预约', icon: Calendar },
  { index: '/reports', title: '报表', icon: DataAnalysis, roles: ['ADMIN', 'MANAGER'] },
  { index: '/settings', title: '设置', icon: Tools, roles: ['ADMIN'] },
]);

const filteredMenuItems = computed(() => {
  const userRole = userStore.userRole;
  if (!userRole) {
    return [];
  }
  return menuItems.value.filter(item => {
    return !item.roles || item.roles.includes(userRole);
  });
});

const handleCommand = (command) => {
  if (command === 'logout') {
    userStore.logout();
  }
};
</script>

<style scoped>
.app-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  background-color: #fafafa;
  height: 60px;
  width: 100%;
  padding: 0;
  flex-shrink: 0;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  border-bottom: 1px solid #e4e7ed;
}
.header-content {
  max-width: 1400px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
}
.logo-container { display: flex; align-items: center; gap: 12px; }
.logo-img { height: 40px; }
.logo-text { font-size: 20px; font-weight: 600; white-space: nowrap; color: #25686c; }

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto; 
}
.custom-nav { display: flex; align-items: center; height: 100%; }
.nav-item {
  display: flex;
  align-items: center;
  padding: 0 18px;
  height: 100%;
  color: #606266;
  text-decoration: none;
  font-size: 15px;
  transition: all 0.2s ease;
  border-bottom: 3px solid transparent;
  /* 为 badge 提供定位上下文 */
  position: relative; 
}
.nav-item .el-icon { margin-right: 6px; }
.nav-item:hover { color: #25686c; }
.nav-item.is-active { color: #25686c; border-bottom-color: #25686c; font-weight: 600; }

.el-dropdown-link {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #303133;
}
.username {
  margin: 0 8px;
}

.app-main {
  flex-grow: 1;
  padding-top: 60px;
  background-color: #f0f2f5;
  overflow-y: auto;
}
.main-content-wrapper {
  padding: 20px;
}
.page-container {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,21,41,.08);
  padding: 20px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.mobile-nav {
    display: none;
}
.mobile-only {
    display: none;
}

/* 核心修改：新增 badge 样式 */
.nav-item-content, .nav-item-content-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-item-content-mobile {
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.nav-badge {
  /* 确保 badge 填满整个 a 标签，使点击区域不变 */
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.nav-badge-mobile {
  /* 移动端 badge 样式 */
  width: 100%;
  height: 100%;
}

@media (max-width: 767px) {
  .pc-nav { display: none !important; }
  .mobile-only { display: flex; margin-left: auto; }
  
  .header-content {
      justify-content: space-between;
  }
  .logo-text { display: none; }
  
  .app-main {
    padding: 75px 15px 75px;
  }
  .main-content-wrapper { padding: 0; }
  .page-container { padding: 15px; border-radius: 6px;}

  .mobile-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 60px;
      background-color: #fff;
      box-shadow: 0 -2px 5px rgba(0,0,0,0.05);
      z-index: 1000;
      border-top: 1px solid #e4e7ed;
  }
  .mobile-nav .nav-item {
      flex: 1;
      padding: 0 5px;
      font-size: 12px;
      line-height: 1.2;
      border-bottom-width: 2px;
  }
  .mobile-nav .nav-item .el-icon {
      margin-right: 0;
      margin-bottom: 2px;
      font-size: 20px;
  }
}
</style>

<style>
/* 全局样式重置 */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif; }

#nprogress .bar {
  background: #25686c !important;
  height: 3px !important;
}

#nprogress .peg {
  box-shadow: 0 0 10px #25686c, 0 0 5px #25686c !important;
}
</style>