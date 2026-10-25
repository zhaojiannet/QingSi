# 一键部署（scripts/deploy.sh）

把本地代码推到一台装了 Docker 的 Linux 服务器上。
脚本在**本地机器**执行，自己 ssh 到服务器完成剩下的事，你不用登服务器。

另外两种部署方式（Docker Compose、传统 nginx + Node.js）见 [README 的「生产部署」](../README.md#生产部署)，本文只讲这个脚本。

## 它做了什么

| 步骤 | 在哪执行 |
| --- | --- |
| 前端 `pnpm build` | 本地 `docker build`（`frontend/Dockerfile` 的 files 段） |
| `dist/` 推到站点目录 | rsync 本地 → 服务器 |
| 后端打 tar 快照备份 | 服务器 |
| 后端代码推送 | rsync 本地 → 服务器 |
| `pnpm install` + `prisma generate` + `prisma migrate deploy` | 服务器后端容器 |
| 重启后端容器 | 服务器 |
| 请求健康检查地址 | 本地 |

数据库迁移在重启之前跑，迁移失败就不重启，老进程继续对外服务。

## 前置条件

**本地：**

- 能免密 ssh 到服务器（`ssh-copy-id` 配好公钥）
- 装了 Docker，脚本用 `docker build` 构建前端，不需要开发容器在跑
- 有 `rsync`（macOS 自带）

**服务器：**

- 装了 Docker
- 有一个跑 Node 的容器，把后端代码目录挂载成容器里的 `/app`，容器内有 pnpm
- 该容器能连上 MySQL
- 站点的反向代理把 `/api` 转发到后端容器的 3000 端口，其余路径走静态文件并回退到 `index.html`（前端是 history 路由）
- 建议在反代层配好 HTTPS，后端 `NODE_ENV=production` 时 cookie 带 Secure 标记，纯 HTTP 下浏览器会拒绝保存

## 配置

配置写在 `scripts/deploy.env`，**这个文件在 `.gitignore` 里，不会进版本库**，所以你的服务器地址不会被提交上去。别直接改 `deploy.sh`。

```bash
cp scripts/deploy.env.example scripts/deploy.env
vi scripts/deploy.env
```

一共 5 项：一台机器、两个目录、一个容器名、一个站点地址。

| 项 | 说明 |
| --- | --- |
| `SERVER` | ssh 目标。`user@host` 或 `~/.ssh/config` 里的别名都行 |
| `FRONT_DIR` | 前端静态文件目录，**必须跟建站时设的网站根目录一致**，否则文件推上去了访问不到 |
| `BACK_DIR` | 后端代码目录，**必须是后端容器挂载成 `/app` 的那个宿主机目录**，否则代码推上去了容器里看不见 |
| `BACK_CONTAINER` | 后端容器名，填 `docker ps` 里显示的，不是镜像名 |
| `SITE_URL` | 站点地址，部署完访问 `${SITE_URL}/api/configs` 探活。这个接口不需要登录 |

`SITE_URL` 和 `SERVER` 分开是因为两者不一定同名：ssh 可能走内网 IP 或 config 别名，站点却是对外域名。

少填任何一项，跑脚本会直接告诉你缺哪个并退出，不会误推到别处。

注意这个 `deploy.env` 跟服务器上后端的 `.env` 是两码事：前者只说明「往哪台机器推」，留在本地；后者是数据库地址和密钥，只在服务器上，脚本永远不碰。

## 首次部署

脚本的 rsync **故意排除了 `.env`**，永远不会覆盖服务器上的配置，所以第一次要手动放一份：

```bash
ssh root@your-domain.com "mkdir -p /srv/www/your-domain.com/backend"
scp backend/app/.env.example root@your-domain.com:/srv/www/your-domain.com/backend/.env
ssh root@your-domain.com "vi /srv/www/your-domain.com/backend/.env"
```

按 `backend/app/.env.example` 的注释逐项填，其中和生产环境直接相关的：

| 键 | 生产环境该填什么 |
| --- | --- |
| `NODE_ENV` | `production` |
| `SECURE_COOKIE` | `true`（需要 HTTPS） |
| `CORS_ORIGIN` | 你的站点地址，如 `https://your-domain.com` |
| `TRUST_PROXY` | 走反代就填 `loopback,uniquelocal`（不能填数字，启动会报错）。不填的话拿不到 https，验证码 session 不下发、登录不了，限流也会按反代的 IP 算 |
| `JWT_SECRET` / `SESSION_SECRET` | 各跑一次 `openssl rand -hex 64`，**两个必须不同** |
| `DATABASE_URL` | 后端容器能访问到的数据库地址 |
| `RATE_LIMIT_MAX` | 全局限流，按 IP 计数。同一门店多台设备共用出口 IP 会共享额度，人多要调大 |

改 `JWT_SECRET` 会让当时所有已登录的用户立刻掉线一次，换密钥挑没人用的时候做。

配置放好后跑一次全量部署：

```bash
./scripts/deploy.sh
```

## 日常部署

```bash
./scripts/deploy.sh            # 前端 + 后端
./scripts/deploy.sh frontend   # 只改了前端
./scripts/deploy.sh backend    # 只改了后端
```

看到「部署完成，健康检查通过」就好了。健康检查是重启后等 10 秒再请求，服务器慢的话可能误报，这时先手动打一下健康检查地址确认，别急着回滚。

## 回滚

后端每次同步前会在服务器上留一份 `/root/qingsi-backend-prev.tgz`（只有一份，会被下次部署覆盖）。健康检查失败时脚本会直接把回滚命令打出来，照着粘贴即可：

```bash
ssh root@your-domain.com "tar -C /srv/www/your-domain.com/backend -xzf /root/qingsi-backend-prev.tgz && docker restart node_your-project"
```

注意这只回滚代码，**不回滚数据库**。如果这次部署带了破坏性的迁移，代码退回去了但表结构还是新的。有风险的迁移在部署前先备份数据库。

前端没有自动快照，需要的话重新 checkout 上个版本再 `./scripts/deploy.sh frontend`。

## 脚本不碰的东西

- 服务器上的 `.env`（要改就自己 ssh 上去改，改完重启后端容器才生效）
- 服务器上的 `node_modules` 和 `src/generated`（由容器内的 `pnpm install` / `prisma generate` 维护）
- 反向代理和 HTTPS 证书配置
- 数据库备份
