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
  // 构建优化配置
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除console
        drop_debugger: true, // 生产环境移除debugger
        dead_code: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    rollupOptions: {
      output: {
        // 优化的代码分割策略
        manualChunks(id) {
          // 将 node_modules 的包分组
          if (id.includes('node_modules')) {
            // Vue生态系统
            if (id.includes('vue') || id.includes('@vue')) {
              return 'vue-vendor';
            }
            // Element Plus UI库
            if (id.includes('element-plus')) {
              return 'element-ui';
            }
            // 工具库
            if (id.includes('axios') || id.includes('jwt-decode') || 
                id.includes('decimal.js') || id.includes('dayjs')) {
              return 'utils';
            }
            // 其他第三方库
            return 'vendor';
          }
        },
        // 输出文件名配置
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg)$/.test(name ?? '')) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    chunkSizeWarningLimit: 1500, // 提高chunk大小警告阈值
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 压缩大小报告
    reportCompressedSize: false,
    // 源码映射
    sourcemap: false,
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'axios', 'element-plus'],
    exclude: []
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
  },
  // 预览服务器配置（可选）
  preview: {
    port: 4173,
    strictPort: true,
  }
})