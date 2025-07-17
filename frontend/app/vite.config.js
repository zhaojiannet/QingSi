import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // --- 核心：确保 server.proxy 配置正确 ---
  server: {
    proxy: {
      // 将所有以 /api 开头的请求代理到后端
      '/api': {
        target: 'http://qingsi_backend:3000', // 确认这是您后端服务的正确地址
        changeOrigin: true, // 必须为 true，以支持跨域
        // 如果上面依然无效，可以尝试去掉 rewrite，Vite 5+ 默认行为就是正确的
        // rewrite: (path) => path.replace(/^\/api/, '') 
      }
    }
  }
})