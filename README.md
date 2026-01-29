# QingSi 会员管理系统

QingSi 是一个现代化的会员管理系统，专为美容美发、健身房、SPA 等服务行业设计。支持会员管理、储值卡、多卡联合支付、预约管理、营业报表等功能。

## 功能特性

- **会员管理** - 会员信息、状态管理、消费记录追踪
- **储值卡系统** - 多种卡类型、自定义面值、灵活折扣
- **智能收银** - 多卡联合支付、自动最优折扣计算
- **预约管理** - 在线预约、状态追踪
- **营业报表** - 日报/月报、数据可视化
- **员工管理** - 员工信息、业绩关联
- **挂账功能** - 支持挂账消费、批量清账
- **交易撤销** - 7天内可撤销交易，自动恢复余额

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Element Plus + Vite + Pinia + ECharts |
| 后端 | Node.js + Fastify + Prisma |
| 数据库 | MySQL |
| 部署 | Docker Compose |

## 快速开始

### 环境要求

- Docker & Docker Compose
- 已有的 Docker 网络：`docker-net`

### 1. 克隆项目

```bash
git clone https://github.com/your-username/QingSi.git
cd QingSi
```

### 2. 配置环境变量

复制示例配置并修改：

```bash
cp backend/app/.env.example backend/app/.env
```

编辑 `backend/app/.env`，设置以下必要配置：

```env
# 安全密钥（必须修改！）
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here

# 管理员账户
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# 数据库配置
DATABASE_URL=mysql://user:password@mysql-server:3306/qingsi
```

生成安全密钥：

```bash
openssl rand -hex 64
```

### 3. 创建 Docker 网络（如果不存在）

```bash
docker network create docker-net
```

### 4. 启动服务

```bash
docker-compose up -d
```

### 5. 访问系统

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api

---

## 功能模块详解

### 1. 会员管理

| 功能 | 说明 |
|------|------|
| 会员列表 | 搜索、筛选、分页展示会员信息 |
| 会员详情 | 查看会员卡、消费记录、挂账情况 |
| 会员状态 | 正常、停用、冻结、已注销 |

**会员列表显示说明：**
- **余额**：橙色显示，余额为0时灰色
- **挂账**：红色显示待清账金额
- **会员卡**：显示 `有卡 2/3` 表示3张卡中2张有效（余额>0且状态正常）

### 2. 会员卡管理

| 卡类型 | 说明 |
|--------|------|
| 预设面值卡 | 如 300元卡、500元卡，固定折扣率 |
| 自定义面值卡 | 自定义金额和折扣率 |

**折扣规则：**
- 折扣率以小数表示：0.7 = 7折
- 服务可标记为 `noDiscount`（无折扣），按原价结算

### 3. 收银结算

**支付方式：**
- 现金、微信、支付宝、抖音、美团
- 会员卡（支持单卡/多卡）

**会员卡支付模式：**
- **自动选择**：系统自动计算最优多卡组合
- **手动选择**：指定使用某张卡

**价格调整：**
- 点击"价格调整"可手动修改实付金额
- 需填写调整原因，记录在交易备注中

### 4. 消费记录

**视觉标识说明：**

| 样式 | 含义 |
|------|------|
| 红色文字 | 挂账记录 |
| 绿色文字 | 清账记录 |
| ~~划线文字~~ | 应付金额（折扣前原价） |
| 橙色文字 | 手动设置的交易时间 |
| 虚线下划线 | 有余额快照，悬停可查看交易前后余额变化 |

**折扣列显示：**
- `7折 省¥15` - 单卡支付折扣
- `多卡 7.5折 省¥12.5` - 多卡联合支付平均折扣
- `减 ¥20` - 手动价格调整

**数量显示：**
- 选择同一服务多次时，显示红色数量角标
- 服务项目显示为 `洗剪吹*2、染发` 格式

### 5. 预约管理

**预约状态：**

| 状态 | 说明 | 可执行操作 |
|------|------|-----------|
| PENDING | 待确认 | 确认、取消 |
| CONFIRMED | 已确认 | 去结算、完成、取消 |
| COMPLETED | 已完成 | 去结算 |
| CANCELLED | 已取消 | - |
| NO_SHOW | 未到店 | - |

### 6. 营业报表

**统计指标：**
- **总消费**：所有交易的实付金额总和
- **卡耗**：会员卡支付的金额
- **充值**：会员卡充值金额
- **总客数**：消费客户数量
- **客单价**：总消费 / 总客数

**时间筛选：**
- 支持日期范围选择
- 快捷选项：当日、当周、当月、当季、当年

### 7. 挂账功能

**操作流程：**
1. 在会员详情中创建挂账
2. 记录挂账金额和原因
3. 清账时可选择：
   - **现金/其他**：仅清除挂账记录
   - **会员卡**：从指定卡扣款并清除记录

### 8. 交易撤销

**规则：**
- 仅管理员/经理可操作
- 7天内的交易可撤销
- 会员卡支付的交易撤销后自动恢复余额
- 需填写撤销原因

---

## 多卡联合支付算法

当单张会员卡余额不足时，系统自动计算最优的多卡组合方案：

### 计算规则

1. **折扣率优先** - 折扣率低的卡优先使用（6折 > 7折 > 8折）
2. **小余额优先** - 相同折扣率下，余额少的卡优先使用（清空小额卡）
3. **不打折服务** - 标记为 `noDiscount` 的服务按原价收费

### 计算公式

**不打折服务支付：**
```
卡片扣款 = min(剩余不打折金额, 卡片剩余余额)
```

**可打折服务支付：**
```
卡片最大覆盖原价 = 卡片余额 / 折扣率
实际覆盖原价 = min(卡片最大覆盖原价, 剩余待支付金额)
卡片扣款金额 = 实际覆盖原价 × 折扣率
优惠金额 = 实际覆盖原价 - 卡片扣款金额
```

### 示例

**场景：混合服务支付**

服务项目：
- 剪发套餐 ¥58（noDiscount=true，不打折）
- 染发 ¥158（可打折）

会员卡：
- 6折卡：余额 ¥100
- 8折卡：余额 ¥150

计算过程：
1. 6折卡先支付不打折服务 ¥58，剩余余额 ¥42
2. 6折卡支付可打折服务：¥42÷0.6=¥70原价，扣 ¥42
3. 8折卡支付剩余：¥88原价×0.8=¥70.4

结果：总价 ¥216 → 实付 ¥170.40，省 ¥45.60

---

## API 文档

### 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`

### 主要接口

| 模块 | 端点 | 说明 |
|------|------|------|
| 会员 | `GET/POST/PUT/DELETE /members` | 会员 CRUD |
| 会员 | `GET/POST/DELETE /members/{id}/pending` | 挂账管理 |
| 会员卡 | `POST /cards/issue-with-transaction` | 办卡 |
| 交易 | `POST /transactions` | 消费结算 |
| 交易 | `POST /transactions/combo-checkout` | 多卡联合支付 |
| 交易 | `DELETE /transactions/{id}` | 撤销交易 |
| 服务 | `GET/POST/PUT/DELETE /services` | 服务项目 |
| 卡类型 | `GET/POST/PUT/DELETE /cardTypes` | 卡类型管理 |
| 员工 | `GET/POST/PUT/DELETE /staff` | 员工管理 |
| 预约 | `GET/POST/PUT/DELETE /appointments` | 预约管理 |
| 报表 | `GET /reports/daily` | 日报表 |
| 报表 | `GET /reports/monthly` | 月报表 |
| 认证 | `POST /auth/login` | 登录 |
| 配置 | `GET/PUT /configs` | 系统配置 |

### 请求示例

#### 创建会员

```bash
POST /api/members
{
  "name": "张三",
  "phone": "13800138000",
  "gender": "MALE",
  "birthday": "1990-01-01"
}
```

#### 消费结算（单卡）

```bash
POST /api/transactions
{
  "memberId": "xxx",
  "serviceIds": ["service1", "service2"],
  "paymentMethod": "MEMBER_CARD",
  "cardId": "xxx",
  "staffId": "xxx",
  "customTransactionTime": "2025-01-08 14:30:00"
}
```

#### 多卡联合支付

```bash
POST /api/transactions/combo-checkout
{
  "memberId": "xxx",
  "serviceIds": ["service1", "service2"],
  "staffId": "xxx",
  "manualPriceAdjustment": {
    "adjustedAmount": 100,
    "reason": "会员优惠"
  }
}
```

### 响应格式

```json
// 成功
{
  "data": {...},
  "message": "操作成功"
}

// 分页
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}

// 错误
{
  "error": "Bad Request",
  "message": "具体错误信息",
  "statusCode": 400
}
```

### 枚举值

**性别：** `MALE`（男）、`FEMALE`（女）、`UNKNOWN`（未知）

**会员状态：** `ACTIVE`（正常）、`INACTIVE`（停用）、`FROZEN`（冻结）、`DELETED`（已注销）

**支付方式：** `CASH`（现金）、`WECHAT_PAY`（微信）、`ALIPAY`（支付宝）、`DOUYIN`（抖音）、`MEITUAN`（美团）、`MEMBER_CARD`（会员卡）

**预约状态：** `PENDING`（待确认）、`CONFIRMED`（已确认）、`COMPLETED`（已完成）、`CANCELLED`（已取消）、`NO_SHOW`（未到店）

---

## 项目结构

```
QingSi/
├── backend/
│   ├── app/
│   │   ├── src/
│   │   │   ├── routes/      # API 路由
│   │   │   ├── db/          # 数据库配置
│   │   │   ├── utils/       # 工具函数
│   │   │   └── server.js    # 入口文件
│   │   ├── prisma/
│   │   │   └── schema.prisma # 数据模型
│   │   ├── .env.example     # 环境变量示例
│   │   └── init-admin.js    # 管理员初始化
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   └── src/
│   │       ├── views/       # 页面组件
│   │       ├── components/  # 通用组件
│   │       ├── api/         # API 调用
│   │       ├── stores/      # Pinia 状态
│   │       └── utils/       # 工具函数
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 开发

### 本地开发（容器内）

```bash
# 启动开发环境
docker-compose up

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 数据库操作

```bash
# 进入后端容器
docker exec -it qingsi_backend sh

# Prisma 命令
npx prisma studio    # 数据库可视化
npx prisma db push   # 同步数据库结构
npx prisma generate  # 生成客户端
```

### 重置管理员密码

```bash
docker exec -it qingsi_backend sh
node init-admin.js
```

---

## 许可证

本项目采用 [GPL-3.0](LICENSE) 许可证。
