# QingSi 会员管理系统

**简单高效，管理不用愁，经营更省心**

适用于：**美业、美容、美发、美甲、按摩、瑜伽、培训、宠物**等行业的会员管理系统。

## 功能

| 模块 | 功能 |
|------|------|
| 收银台 | 快速结算、多支付方式、会员卡支付、智能多卡组合、价格调整 |
| 会员管理 | 会员档案、办卡充值、余额查询、挂账管理、消费记录 |
| 预约管理 | 用户端在线预约、状态追踪、微信通知推送 |
| 营业报表 | 营业概览、支付统计、项目排行、生日提醒、沉睡会员 |
| 系统设置 | 服务项目、卡类型、员工管理、交易撤销 |

## 技术栈

- 前端：Vue 3 + Element Plus + Vite + Pinia
- 后端：Node.js + Fastify + Prisma
- 数据库：MySQL
- 部署：Docker Compose

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/zhaojiannet/QingSi.git
cd QingSi
```

### 2. 配置环境变量

```bash
cp backend/app/.env.example backend/app/.env
```

编辑 `backend/app/.env`：

```env
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here
ADMIN_USERNAME=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password-here
DATABASE_URL=mysql://user:password@localhost:3306/database
```

生成密钥：`openssl rand -hex 64`

### 3. 启动服务

```bash
docker network create docker-net  # 如不存在
docker-compose up -d
```

### 4. 访问

- 前端：http://localhost:5173
- API：http://localhost:3000/api

## 品牌定制

编辑 `frontend/app/src/config/app.js`：

```javascript
export default {
  brandName: '青丝',           // 店铺名称
  industryType: '美业',        // 可选：美业、美容、美发、美甲、按摩、瑜伽、培训、宠物
  systemName: '会员管理系统',
  slogan: '简单高效，管理不用愁，经营更省心',
  logo: '/images/logo.png',
};
```

行业类型对应背景图：

| industryType | 背景图 |
|--------------|--------|
| 美业 | login_bg01.jpg |
| 美容 | login_bg02.jpg |
| 美发 | login_bg03.jpg |
| 美甲 | login_bg04.jpg |
| 按摩 | login_bg05.jpg |
| 瑜伽 | login_bg06.jpg |
| 培训 | login_bg07.jpg |
| 宠物 | login_bg08.jpg |

图片位于 `frontend/app/public/images/` 目录。

## 微信通知推送

支持通过微信公众号推送预约通知。

### 配置步骤

1. 申请微信公众号测试号：https://mp.weixin.qq.com/debug/cgi-bin/sandboxinfo

2. 创建模板消息，内容如下：
```
姓名：{{name.DATA}}
电话：{{phone.DATA}}
时间：{{time.DATA}}
项目：{{services.DATA}}
员工：{{staff.DATA}}
留言：{{message.DATA}}
```

> 注意：不要使用 `notes` 或 `remark` 作为字段名，这是微信保留字段，不会显示。

3. 部署 Cloudflare Worker（文件在 `cloudflare-workers/` 目录）

4. 配置环境变量：
```env
WXPUSH_URL=https://your-worker.workers.dev/wxsend
WXPUSH_TOKEN=your-api-token
```

## 版本升级

### 从旧版本升级

如果你的系统已在运行，升级到新版本需要执行数据库迁移：

```bash
# 进入后端容器
docker exec -it qingsi_backend sh

# 执行数据库迁移
npx prisma db push
```

新增字段说明：
- `SystemConfig.bookingCode` - 用户端预约访问码
- `SystemConfig.bookingCodeUpdatedAt` - 访问码更新时间

## 生产部署

### Docker 部署

同"快速开始"。

### 传统部署（nginx + Node.js）

**前端：**
```bash
cd frontend/app
pnpm install && pnpm build
# 将 dist/ 上传到 nginx 静态目录
```

**后端：**
```bash
cd backend/app
pnpm install --prod
npx prisma generate
pm2 start src/server.js --name qingsi
```

**nginx 配置：**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/qingsi/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 开发

```bash
docker-compose up              # 启动
docker-compose logs -f backend # 查看日志

# 进入容器
docker exec -it qingsi_backend sh
npx prisma studio              # 数据库可视化
node init-admin.js             # 重置管理员
```

## 项目结构

```
QingSi/
├── backend/app/
│   ├── src/routes/      # API 路由
│   ├── prisma/          # 数据模型
│   └── .env.example
├── frontend/app/
│   └── src/
│       ├── views/       # 页面
│       ├── components/  # 组件
│       └── config/      # 配置
└── docker-compose.yml
```

## 许可证

[GPL-3.0](LICENSE)
