// frontend/src/router/index.js
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
    meta: { isPublic: true } // 标记为公共页面，路由守卫会用到
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
    component: () => import('../views/ReportView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue')
  },
  // --- 核心修改1：为根路径'/'添加重定向到默认页面 ---
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

// --- 核心修改2：添加完整的全局前置守卫 ---
router.beforeEach((to, from, next) => {
  NProgress.start();
  const userStore = useUserStore();
  const isLoggedIn = userStore.isLoggedIn;
  
  // 目标路由不是公共页面，且用户未登录，则重定向到登录页
  if (!to.meta.isPublic && !isLoggedIn) {
    next({ name: 'login' });
  } 
  // 如果用户已登录，但又想访问登录页，则重定向到首页
  else if (to.meta.isPublic && isLoggedIn) {
    next({ path: '/' });
  }
  // 其他所有情况，直接放行
  else {
    next();
  }
});

router.afterEach(() => {
  NProgress.done();
});

export default router;