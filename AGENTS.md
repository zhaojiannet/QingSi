# QingSi 会员管理系统

会员管理 + 收银 + 预约 + 营业报表，覆盖美业 / 美容 / 美发 / 美甲 / 按摩 / 瑜伽 / 培训 / 宠物等行业。品牌名、行业类型、登录背景图在 `frontend/app/src/config/app.js` 切换；不要把行业文案/图片路径硬编码到组件。

## 容器与网络
- `qingsi_backend`（:3000，Fastify + Prisma + MySQL）、`qingsi_frontend`（:5173，Vue 3 + Element Plus + Vite）。
- 共享 **外部** 网络 `docker-net`：首次启动前需 `docker network create docker-net`。
- 包管理统一 pnpm；命令一律在容器内执行（`docker exec -it qingsi_backend sh`），`node_modules` 走 named volume，宿主机不要 `pnpm install`。

## 凭证
- 后端读 `backend/app/.env`：`JWT_SECRET` / `SESSION_SECRET` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `DATABASE_URL` / `CORS_ORIGIN` / `SECURE_COOKIE` / `WXPUSH_URL` / `WXPUSH_TOKEN`。
- `.env.example` 是真值的 schema，新增 key 必须同步它。前端无独立 secrets。

## 数据库
- Prisma 7 + MySQL，schema 唯一来源 `backend/app/prisma/schema.prisma`。
- 已切换到 migration 工作流（baseline 为 `prisma/migrations/0_init`）。schema 改动流程：先 `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<timestamp>_<name>/migration.sql` 生成 SQL，再 `npx prisma migrate deploy` 应用。**禁止再用 `db push`**（含 docker-compose 启动 command）。
- 金额字段统一 `Decimal(10,2)`，前后端运算用 `decimal.js`，禁止用 JS `number` 直接加减。
- 卡余额扣减必须走 `utils/balance.js#atomicDecrementBalance`（`where: { id, balance: { gte: amount } }` + catch P2025），禁止裸 `decrement`，否则并发下会超扣。
- 多卡支付通过 `TransactionCardLink` 表关联（创建时同步写 link，退单时遍历 link 恢复余额）；**禁止再从 `notes` 字段 regex 解析多卡信息**。
- 重置管理员：容器内 `node init-admin.js`。

## 时区
- 后端永远返回 ISO 8601 UTC 字符串（`registrationDate: "2026-04-07T09:46:26.748Z"` 这种）。已删除 `utils/timezone.js` 的 onSend 反模式。
- 前端按用户时区在显示时格式化（`frontend/app/src/utils/timezone-unified.js#formatDate`，内部用 `Intl.DateTimeFormat({ timeZone })`）。

## 安全
- Refresh token 入库前必须 SHA256 hash（`routes/auth.js#hashRefreshToken`）。bcryptjs 仅用于密码。
- 全局错误处理在 `server.js#setErrorHandler`：`P2002` → 409，`P2025` → 404，`INSUFFICIENT_BALANCE` → 400。新业务错误码加分支即可，禁止每个路由各写一套。
- Pino logger redact 已覆盖 `req.headers.authorization/cookie`、`*.password/token/refreshToken/accessToken`。新增敏感字段同步到 `server.js` 的 `logger.redact.paths`。
- **Fastify register 时传 `{ onRequest: [...] }` 不会自动应用到 plugin 内的 routes**（曾踩坑：23 条核心路由完全裸奔）。每个需要鉴权的 plugin 文件顶部必须显式调用 `applyAuth(fastify, opts)`（见 `utils/applyAuth.js`），新增 plugin 同样处理。

## 路由约定
- 后端资源单文件：`backend/app/src/routes/<resource>.js` ↔ 前端 `frontend/app/src/api/<resource>.js`。新增资源同时建两侧文件并在 `server.js` 注册。
- 已封装的工具优先复用：`utils/rateLimit.js`（带 LRU 上限）/ `utils/cache.js` / `utils/id.js`（nanoid）/ `utils/balance.js` / `utils/wxpush.js`。
- 写路由必须挂 JSON Schema 校验：在 `schemas/<resource>.js` 定义后传入 `{ schema: ... }`。

## 微信推送
- 路径：业务后端 → `cloudflare-workers/wxpush-*.js`（独立部署）→ 微信公众号测试号。配置见 `WXPUSH_URL` + `WXPUSH_TOKEN`。
- 模板字段名禁止用 `notes` / `remark`（微信保留字，渲染会被吞）。新增字段先到公众号模板登记。
