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
    path: '/b/:code',
    name: 'booking',
    component: () => import('../views/BookingView.vue'),
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

// vue-router 5 风格：return 值代替 next() 回调
router.beforeEach((to) => {
  NProgress.start();
  const userStore = useUserStore();
  const isLoggedIn = userStore.isLoggedIn;
  const userRole = userStore.userRole;

  if (to.meta.isPublic) {
    if (isLoggedIn && to.name === 'login') return { path: '/' };
    return true;
  }

  if (!isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.roles && !to.meta.roles.includes(userRole)) {
    return { name: 'NotFound', query: { unauthorized: '1' } };
  }

  return true;
});

router.afterEach(() => {
  NProgress.done();
});

export default router;