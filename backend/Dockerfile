# 各项目保持同一份，项目之间的差别放 .env。
# 标签跟官方浮动，不钉 digest：构建时加 --pull 就拿到官方当前的版本，大版本也跟着换
FROM node:lts-trixie-slim AS dev

# NODE_USE_SYSTEM_CA：OrbStack 把它的根证书装进容器的系统证书库，Node 默认不读系统库，
# 访问 https://*.orb.local 会报 SELF_SIGNED_CERT_IN_CHAIN；slim 镜像又不带系统证书库，所以要装 ca-certificates。
# store 必须显式指定：不指定时 pnpm 发现默认位置和 node_modules 不在同一文件系统，
# 会把 store 建到 node_modules/.pnpm-store 里，共享 volume 就没用上。
# confirm_modules_purge：容器里没有终端，pnpm 要重建 node_modules 时没法问，会直接报错退出
# PORT：程序读它监听，开发和生产都是 3000，Nuxt 默认就读它
ENV NODE_USE_SYSTEM_CA=1 \
    PORT=3000 \
    PNPM_HOME=/home/node/.local/share/pnpm \
    pnpm_config_store_dir=/home/node/.local/share/pnpm/store \
    pnpm_config_cache_dir=/home/node/.local/share/pnpm/cache \
    pnpm_config_confirm_modules_purge=false \
    PATH=/home/node/.local/share/pnpm/bin:$PATH

# 这里装的 pnpm 只负责启动，项目实际用 package.json 里 packageManager 写的版本，pnpm 会自己下载切换。
# --before 和 pnpm-workspace.yaml 的 minimumReleaseAge 一样只取发布满 3 天的版本：
# 建项目时把这个版本写进 packageManager，取到刚发布的就绕过了考察期。
# libatomic1：版本不同时 pnpm 下载的是独立可执行版 @pnpm/exe，它要这个库，slim 镜像里没有
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libatomic1 \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm --before="$(date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
    && npm cache clean --force

# 这两个目录会被 volume 覆盖；空 volume 首次挂载继承镜像里同路径的属主，不预建就是 root 的
RUN mkdir -p /app/node_modules /home/node/.local/share/pnpm \
    && chown -R node:node /app /home/node/.local

USER node
WORKDIR /app

# 开发服务器要监听 0.0.0.0，OrbStack 域名和别的项目才访问得到。
# CUSTOM: Astro 的 .astro/dev.json 记着上次的进程号，容器停掉时不删；新容器的进程号从头分配，
# 撞上就以为服务器还在、拒绝启动。容器刚起来时不可能已有服务器，留下的一定是旧的
CMD ["sh", "-c", "rm -f .astro/dev.json && pnpm install && exec pnpm dev --host"]


FROM dev AS build

# 先只拷依赖清单，源码改了也能复用装依赖那一层。
# pnpm 目录挂成构建缓存，和开发时的 volume 是同一个路径：store、元数据缓存、按 packageManager 下载的 pnpm 都在里面，
# 下次构建只下载变过的包。uid、gid 必须写，不写的话缓存目录是 root 的，node 用户写不进去
COPY --chown=node:node app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/home/node/.local/share/pnpm,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile
COPY --chown=node:node app/ ./
# 挂同一个缓存：按 packageManager 下载的 pnpm 在里面，不挂的话这一步会再下载一次。
# --if-present：纯 JS 的接口服务没有构建这一步，package.json 里没有 build 脚本
RUN --mount=type=cache,target=/home/node/.local/share/pnpm,uid=1000,gid=1000 \
    pnpm run --if-present build \
    && pnpm prune --prod


FROM node:lts-trixie-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
# 直接用 node 起入口，不经过 pnpm、npm 或 node --run：它们收到 SIGTERM 不转给子进程，程序没机会正常关闭。
# 入口由 compose.prod.yaml 从 .env 传进来；4xx 也算活着，接口服务的根路径常常是 404
CMD ["sh", "-c", "exec node \"$NODE_ENTRY\""]
HEALTHCHECK --start-period=30s --start-interval=1s CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"
