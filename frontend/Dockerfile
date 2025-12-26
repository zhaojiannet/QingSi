# 使用一个现代、精简的 Node.js 基础镜像
FROM node:22-bookworm-slim

# 设置 pnpm 的环境变量
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 启用 Corepack 并安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate



# 1. 以 root 身份执行所有权限相关的设置
USER root

# 2. 修改已存在的 'node' 用户的 UID/GID
RUN usermod -u 1000 node && groupmod -g 1000 node

# 3. 【核心修正】创建工作目录，并将其所有权直接交给 'node' 用户
RUN mkdir -p /app/node_modules && mkdir -p /app/.pnpm-store && chown -R node:node /app

# 4. 现在，安全地切换到非 root 用户
USER node
# 5. 设置工作目录。此时进入的 /app 目录已经是 'node' 用户所有
WORKDIR /app

# 6. 复制依赖定义文件
# RUN mkdir -p /app/node_modules && mkdir -p /app/.pnpm-store && chown -R node:node /app
COPY --chown=node:node package.json pnpm-lock.yaml* ./

# # 7. 安装依赖
# RUN pnpm install --frozen-lockfile
RUN pnpm install

# 8. 复制应用的全部源代码
COPY --chown=node:node . .

# 暴露应用端口（根据你的应用调整）
# EXPOSE 3000

# 设置容器启动时执行的默认命令
CMD ["pnpm", "dev"]


# CMD ["pnpm", "dlx", "@tailwindcss/cli", "-i", "./src/input.css", "-o", "./assets/css/style.css", "--watch"]

