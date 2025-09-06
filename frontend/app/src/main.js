// frontend/app/src/main.js

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 保持全量引入，确保所有组件样式正确
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css' 
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 统一时区处理系统
import timezonePlugin from '@/utils/timezone-unified'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 必须先注册 Pinia，再注册 Router
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// 注册时区插件
app.use(timezonePlugin)

// 等待路由准备就绪后再挂载应用
router.isReady().then(() => {
  console.log('🌍 时区系统已就绪')
  
  app.mount('#app')

  // --- 优化点1: 修复闪烁问题 ---
  // 挂载后，移除 body 的 loading class，显示 #app 容器
  document.body.classList.remove('app-loading');
  // 同时，可以把 loading 的 DOM 元素也移除掉
  const loadingEl = document.querySelector('.loading-wrapper');
  if (loadingEl) {
    loadingEl.parentNode.removeChild(loadingEl);
  }
})