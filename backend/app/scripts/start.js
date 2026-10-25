// 生产入口：先迁移数据库、初始化管理员，再起服务。迁移失败就不启动，老数据结构不会被新代码读写。
// 迁移和初始化各跑一个子进程：init-admin 结束时会断开和服务共用的 Prisma 客户端，放在同一进程里服务就没有连接了
import { execFileSync } from 'node:child_process';

const run = (args) => execFileSync(process.execPath, args, { stdio: 'inherit' });

run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
run(['init-admin.js']);
await import('../src/server.js');
