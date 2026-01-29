//backend/app/src/db/prisma.js

import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// 解析 DATABASE_URL 获取连接参数
const dbUrl = new URL(process.env.DATABASE_URL);
const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10);

// 创建 MySQL adapter
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '3306', 10),
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  connectionLimit: connectionLimit,
});

// 配置日志
let prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
});

// 开发环境下记录慢查询 - 使用新的Client Extensions替代废弃的middleware
if (process.env.NODE_ENV === 'development') {
  prisma = prisma.$extends({
    name: 'performance-logger',
    query: {
      $allOperations({ model, operation, args, query }) {
        const before = Date.now();
        const result = query(args);
        const after = Date.now();
        const duration = after - before;
        
        // 记录超过100ms的查询
        if (duration > 100) {
          console.log(`Slow query (${duration}ms): ${model}.${operation}`);
        }
        
        return result;
      },
    },
  });
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;