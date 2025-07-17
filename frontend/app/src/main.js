// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 保持全量引入，确保所有组件样式正确
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css' 
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 必须先注册 Pinia，再注册 Router
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')