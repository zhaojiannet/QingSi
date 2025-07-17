// frontend/app/src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { useUserStore } from '@/stores/user';

NProgress.configure({ showSpinner: false });

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { isPublic: true }
  },
  {
    path: '/transactions',
    name: 'transactions',
    component: () => import('../views/TransactionView.vue')
  },
  {
    path: '/members',
    name: 'members',
    component: () => import('../views/MemberView.vue')
  },
  {
    path: '/appointments',
    name: 'appointments',
    component: () => import('../views/AppointmentView.vue') 
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('../views/ReportView.vue'),
    // 权限元信息：只有 ADMIN 和 MANAGER 可以访问
    meta: { roles: ['ADMIN', 'MANAGER'] }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    // 权限元信息：只有 ADMIN 可以访问
    meta: { roles: ['ADMIN'] }
  },
  {
    path: '/',
    redirect: '/transactions'
  },
  { 
    path: '/:pathMatch(.*)*', 
    name: 'NotFound', 
    component: () => import('../views/NotFoundView.vue') 
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// 升级后的全局前置守卫
router.beforeEach((to, from, next) => {
  NProgress.start();
  const userStore = useUserStore();
  const isLoggedIn = userStore.isLoggedIn;
  const userRole = userStore.userRole;

  if (to.meta.isPublic) {
    // 如果是公共页面
    if (isLoggedIn && to.name === 'login') {
      // 已登录用户访问登录页，重定向到首页
      next({ path: '/' });
    } else {
      next();
    }
  } else {
    // 如果是需要认证的页面
    if (!isLoggedIn) {
      // 未登录，重定向到登录页
      next({ name: 'login', query: { redirect: to.fullPath } });
    } else {
      // 已登录，检查角色权限
      if (to.meta.roles) {
        // 如果路由需要特定角色
        if (to.meta.roles.includes(userRole)) {
          // 角色匹配，放行
          next();
        } else {
          // 角色不匹配，重定向到404页面（或一个专门的403无权限页面）
          next({ name: 'NotFound', query: { unauthorized: '1' } });
        }
      } else {
        // 如果路由不需要特定角色，直接放行
        next();
      }
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});

export default router;