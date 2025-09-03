//backend/app/src/db/prisma.js

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// 配置连接池和日志
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // 连接池配置
  // 注意：连接池大小需要在 DATABASE_URL 中设置
  // 例如: mysql://user:pass@host:3306/db?connection_limit=10
  
  // 日志配置
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
    
  // 错误格式
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
});

// 开发环境下记录慢查询
if (process.env.NODE_ENV === 'development') {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    
    // 记录超过100ms的查询
    if (after - before > 100) {
      console.log(`Slow query (${after - before}ms): ${params.model}.${params.action}`);
    }
    
    return result;
  });
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;