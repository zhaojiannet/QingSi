# 升级指南

适用于：从 commit `d13ce6f`（含）之前的版本，升级到 `1e9d665` 及之后的版本。

本次升级包含 1 个 P0 安全修复 + 1 个 P0 数据完整性修复 + 数据库迁移工作流变更。**请严格按本文步骤操作。**

---

## 一、升级前必读

### 1.1 影响范围

| 类型 | 项 | 影响 |
|---|---|---|
| 安全 | 鉴权绕过 | 旧版本 `members / transactions / appointments / cards / reports` 共 23 条核心路由未挂鉴权 hook，未带 token 即可访问；新版修复后必须带 token |
| 数据 | 多卡支付退单 | 旧版从 `Transaction.notes` regex 解析多卡信息恢复余额，卡名改名/删除即丢数据；新版从 `TransactionCardLink` 表读取 |
| 数据 | 卡余额并发扣减 | 旧版高并发下可能超扣；新版 `updateMany + ROW_COUNT` 原子保护 |
| 凭据 | Refresh Token | 旧版以明文入库；新版改 SHA256 hash，**所有用户需重新登录一次** |
| 工作流 | DB 迁移 | 旧版 `prisma db push`；新版 `prisma migrate deploy`，启动 command 已修改 |

### 1.2 兼容性

- **历史数据**：100% 兼容（已实测 4347 笔 Transaction、223 张 Card、98 个 Member）
- **历史 6 位 ID**：完全保留可用（应用层验证已扩到 6-8 位）
- **API 接口**：无破坏性变更，前端无需改动
- **微信推送 worker**：不受影响

### 1.3 停机时间

- 主要变更：约 **3-5 分钟**（容器重启 + 数据迁移 + backfill）
- 期间 API 不可用，前端会出现 5xx
- 建议在业务低峰期执行

---

## 二、升级步骤

### Step 0：备份（强制）

```bash
# 1. 数据库全量备份
mkdir -p backups
docker exec mysql-server mysqldump -uqingsi -p<your-password> \
  --single-transaction --routines --triggers qingsi \
  > backups/qingsi-pre-upgrade-$(date +%Y%m%d-%H%M).sql

# 2. 代码备份点
git tag backup/before-upgrade-$(date +%Y%m%d)
```

> 验证备份：`ls -lh backups/qingsi-pre-upgrade-*.sql` 文件大小应 > 100KB

### Step 1：拉取新代码

```bash
git fetch origin
git checkout master
git pull origin master
```

### Step 2：重启容器（应用 docker-compose.yml 变更）

新版本 `docker-compose.yml` 启动 command 把 `prisma db push` 改成了 `prisma migrate deploy`。重启后会自动应用 migrations：

```bash
docker-compose down
docker-compose up -d

# 观察 backend 启动日志
docker-compose logs -f backend
```

预期看到：

```
=== 应用数据库迁移 ===
2 migrations found in prisma/migrations
Applying migration `20260504000000_add_card_link_prune_indexes`
Applying migration `20260504000100_card_id_allow_6_to_8`
All migrations have been successfully applied.
```

### Step 3：基线化（首次升级必做）

如果你的数据库**已存在数据**（schema 已通过旧版 `db push` 创建），但**没有 `prisma/migrations` 目录的应用记录**，会出现错误：

```
P3005: The database schema is not empty.
```

解决：把已有 schema 标记为初始基线已应用：

```bash
docker exec -it qingsi_backend sh
npx prisma migrate resolve --applied 0_init
exit

# 然后重启再次触发 deploy
docker-compose restart backend
```

> 已在新部署上 `docker-compose up` 自动初始化的库不需要这步。

### Step 4：回填历史多卡支付关联（关键）

新版本退单逻辑从 `TransactionCardLink` 表读取多卡支付关系，而历史多卡 transactions 还没填充该表。需要执行 backfill 脚本：

```bash
# 4.1 干跑（不写库，输出统计）
docker exec qingsi_backend npx tsx scripts/backfill-multi-card-links.js --dry-run

# 预期输出末尾：
#   transactions scanned: <N>
#   links would create:   <M>
#   unmatched entries:    0      <-- 必须为 0

# 4.2 如果 unmatched=0，执行实写
docker exec qingsi_backend npx tsx scripts/backfill-multi-card-links.js --apply
```

**如果 unmatched > 0**：说明有历史多卡 transaction 引用的卡名/自定义卡已被删除或改名。脚本会列出每条无法匹配的记录。决策：

- 卡确实被删除：忽略这些记录（后续退单需手工处理）
- 卡名变更：手工写 SQL 在 `TransactionCardLink` 中插入对应记录
- 数据本身错误：从历史日志/备份核实

### Step 5：清空旧 Refresh Token（强制下线）

新版 refresh token 入库前 SHA256 hash，旧库内的明文 token 全部失效。直接清空，让用户重新登录：

```bash
docker exec mysql-server mysql -uqingsi -p<your-password> qingsi \
  -e "TRUNCATE TABLE RefreshToken;"
```

影响：所有当前登录的用户下次刷新 token 会得到 401，需重新输入用户名密码登录一次。

### Step 6：验证

```bash
# 6.1 验证未鉴权访问被拦截
curl -i http://localhost:3000/api/members
# 期望：HTTP/1.1 401

# 6.2 验证迁移记录
docker exec qingsi_backend npx prisma migrate status
# 期望：Database schema is up to date!

# 6.3 验证 trigger 已删
docker exec mysql-server mysql -uqingsi -p<your-password> qingsi \
  -e "SHOW TRIGGERS;"
# 期望：返回空（before_card_insert / before_card_update 已删）

# 6.4 验证 cardLinks 已 backfill
docker exec mysql-server mysql -uqingsi -p<your-password> qingsi -e "
SELECT COUNT(*) link_total FROM TransactionCardLink;
SELECT COUNT(DISTINCT transactionId) tx_with_links FROM TransactionCardLink;
"
# 预期：link_total > 0，tx_with_links 接近你历史多卡 transaction 数

# 6.5 浏览器登录后访问主功能页（收银 / 会员 / 预约 / 报表 / 设置）
# 应无控制台错误
```

---

## 三、回滚预案

如果升级后出现问题，按以下顺序回滚：

### 3.1 代码回滚

```bash
git checkout backup/before-upgrade-<日期>
docker-compose down
docker-compose up -d
```

### 3.2 数据库回滚

```bash
# 1. 停止 backend 写入
docker-compose stop backend

# 2. 还原备份（会 DROP 所有现有数据 + 还原备份内容）
docker exec -i mysql-server mysql -uqingsi -p<your-password> qingsi \
  < backups/qingsi-pre-upgrade-<时间戳>.sql

# 3. 启动旧版本
docker-compose up -d
```

### 3.3 部分回滚（仅丢弃新 migration，保留数据）

```bash
# 直接删 migration 应用记录 + 手工 DROP TransactionCardLink 表
docker exec mysql-server mysql -uqingsi -p<your-password> qingsi -e "
DROP TABLE IF EXISTS TransactionCardLink;
DELETE FROM _prisma_migrations
  WHERE migration_name IN (
    '20260504000000_add_card_link_prune_indexes',
    '20260504000100_card_id_allow_6_to_8'
  );
"
# 索引 / trigger 是否需要恢复看实际情况
```

---

## 四、变更详细清单

### 4.1 新增表

```
TransactionCardLink
  id            String      @id (cuid)
  transactionId String      -> Transaction.id ON DELETE CASCADE
  cardId        String      -> Card.id ON DELETE RESTRICT
  cardName      String      // 写入时快照，避免卡名变更后丢信息
  amount        Decimal(10,2)
  @@index([transactionId])
  @@index([cardId])
```

### 4.2 删除索引

| 表 | 索引 | 原因 |
|---|---|---|
| Card | `Card_balance_idx` | 基数 91/223，业务不按余额范围查询 |
| Card | `Card_isCustomCard_idx` | 基数 2，区分度过低 |

复合索引 `[memberId, status]` 仍存在，覆盖外键查询。

### 4.3 删除 DB Trigger

| Trigger | 原检查 | 移除原因 |
|---|---|---|
| `before_card_insert` | `card.id REGEXP '^[0-9a-z]{6}$'` | 应用层 `validateCardIdFormat` 已统一为 6-8 位检查；DB 层 trigger 阻止了 ID 加宽 |
| `before_card_update` | 同上 | 同上 |

### 4.4 应用层重要变更

| 文件 | 变更 |
|---|---|
| `utils/applyAuth.js` | **新增** - 把 register({ onRequest: [...] }) 真正应用到 plugin 内 routes |
| `utils/balance.js#atomicDecrementBalance` | **新增** - 防并发超扣的原子扣减 |
| `utils/id.js` | nanoid 长度 6→8；新增 `generateUniqueId(prismaModel)` 异步带 retry 版本 |
| `utils/validators.js#validateCardIdFormat` | 接受 6-8 位 |
| `utils/rateLimit.js` | Map 加 10000 条 LRU 上限 |
| `utils/timezone.js` | **删除** - onSend hook 反模式 |
| `routes/auth.js` | refresh token 入库前 SHA256 hash |
| `server.js` | logger.redact 配置 + setErrorHandler 加 INSUFFICIENT_BALANCE 分支 |
| `routes/{members,transactions,appointments,cards,reports}.js` | 加 `applyAuth(fastify, opts)` |

### 4.5 ID 长度 6 → 8 对历史数据的影响

**结论：完全无破坏性影响。** 历史 6 位 ID 全部可读、可写、可删；外键引用、API 调用、前端展示均不变。

| 场景 | 是否受影响 |
|---|---|
| DB 中 5000+ 条 6 位 ID | 不受影响（`validateCardIdFormat` 已扩到 6-8 位） |
| 外键 `memberId` / `cardId` / `transactionId` | 不受影响（字段仍 `varchar(191)`） |
| 数据查询 / join | 不受影响（字符串相等比较） |
| 老 URL 收藏 `/members/abc123` | 不受影响（6 位 ID 仍存在 DB） |
| 前端组件展示 | 不受影响（渲染字符串） |
| 用户口报 ID 找数据 | 轻微不便（混合期长度不一致；多数业务不依赖人工记 ID） |

**唯一需配合的变更**：DB 里原有两个 trigger 限死 ID 必须 6 位：

- `before_card_insert` / `before_card_update` 检查 `card.id REGEXP '^[0-9a-z]{6}$'`
- 若不删，新生成 8 位 ID 写入 `Card` 表会被 trigger 拒绝（已实测）
- 本次升级 migration `20260504000100_card_id_allow_6_to_8` 已删除这两个 trigger，应用层 `validateCardIdFormat` 接管 6-8 位校验

**碰撞概率对比**（生日悖论：n²/(2·N) 估算）：

| 状态 | 总 ID 数 | 碰撞概率 |
|---|---|---|
| 旧 6 位 | 5,000 | 0.0028% |
| 旧 6 位 | 50,000 | 0.28%（开始可见） |
| 旧 6 位 | 100,000 | 1.13% |
| 新 8 位 | 50,000 | 0.00009% |
| 新 8 位 | 1,000,000 | 0.036% |

升级后新增 ID 都是 8 位，碰撞从"半年内可能踩到" → "实务不可能"。`generateUniqueId(prismaModel)` 还有 5 次 retry 兜底，进一步消除尾部风险。

---

## 五、二次开发注意

### 5.1 后续 schema 修改

不再用 `npx prisma db push`，改：

```bash
# 1. 改 prisma/schema.prisma
# 2. 生成迁移 SQL
docker exec qingsi_backend npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script \
  -o prisma/migrations/<timestamp>_<change_name>/migration.sql

# 3. 应用
docker exec qingsi_backend npx prisma migrate deploy

# 4. 重新生成 client
docker exec qingsi_backend npx prisma generate
```

### 5.2 卡余额扣减的强制要求

**禁止**直接写：

```js
await tx.card.update({
  where: { id: cardId },
  data: { balance: { decrement: amount } }
});
```

并发下会超扣（实测 10 并发同卡可超扣 4 笔）。**必须**用：

```js
import { atomicDecrementBalance } from '../utils/balance.js';
await atomicDecrementBalance(tx, cardId, amount);
// 抛 Error('INSUFFICIENT_BALANCE')，由 server.js setErrorHandler 转 400
```

### 5.3 多卡支付的强制要求

创建多卡支付 transaction 时**必须**同步写 `cardLinks`：

```js
await tx.transaction.create({
  data: {
    // ... 其他字段
    cardLinks: {
      create: paymentDetails.map(d => ({
        cardId: d.cardId,
        cardName: d.cardName,    // 写入时快照
        amount: d.actualPaid,
      })),
    },
  },
});
```

退单时遍历 `transaction.cardLinks` 恢复余额，**禁止**再从 `notes` regex 解析。

### 5.4 鉴权 hook 强制要求

新增需要鉴权的 plugin 时，在 plugin 顶部必须调用 `applyAuth`：

```js
import { applyAuth } from '../utils/applyAuth.js';

export default async function (fastify, opts) {
  applyAuth(fastify, opts);  // 必须在所有 fastify.X(...) 之前
  // ... 路由定义
}
```

否则在 `server.js` 中 `register(plugin, { onRequest: [...] })` 传入的 hooks **不会生效**。

---

## 六、求助

升级过程中遇到问题：

1. 收集 `docker-compose logs backend` 完整日志
2. 收集 `docker exec qingsi_backend npx prisma migrate status` 输出
3. 在仓库提 Issue，附带上述信息和你的现有数据规模（Member / Card / Transaction 行数）
