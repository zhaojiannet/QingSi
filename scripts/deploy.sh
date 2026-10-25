#!/usr/bin/env bash
# 本机一键部署到远程服务器：前端容器内构建 → rsync 推送 → 服务器端迁移 → 重启 → 健康检查
#
# 用法（在项目根目录）：
#   cp scripts/deploy.env.example scripts/deploy.env && vi scripts/deploy.env   # 首次
#   ./scripts/deploy.sh            # 全量（前端 + 后端）
#   ./scripts/deploy.sh frontend   # 仅前端
#   ./scripts/deploy.sh backend    # 仅后端
#
# 安全性质：
#   - rsync 排除 .env / node_modules / src/generated，永远不会覆盖服务器配置；
#   - 后端同步前先在服务器留 tar 快照，健康检查失败时按提示一条命令回滚；
#   - 迁移（migrate deploy）在重启之前执行，失败则不重启，老进程继续服务。
set -euo pipefail
cd "$(dirname "$0")/.."

# 服务器地址和目录放 scripts/deploy.env（不入库），各项含义见 deploy.env.example
[ -f scripts/deploy.env ] && . scripts/deploy.env

for v in SERVER FRONT_DIR BACK_DIR BACK_CONTAINER SITE_URL; do
	if [ -z "${!v:-}" ]; then
		echo "deploy.env 缺少 ${v}。先执行：cp scripts/deploy.env.example scripts/deploy.env 并按注释填写" >&2
		exit 1
	fi
done

MIRROR="PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma"

PART="${1:-all}"

if [ "${PART}" != "backend" ]; then
	echo "== 前端：镜像内构建并推送"
	# 导出到新建的空目录：导出不清理目标目录，旧文件留着会被 rsync --delete 一起推上去
	out=$(mktemp -d)
	docker build --target files --output "${out}" frontend
	rsync -av --delete --exclude '.DS_Store' --exclude '._*' \
		"${out}/" "${SERVER}:${FRONT_DIR}/"
	rm -rf "${out}"
fi

if [ "${PART}" != "frontend" ]; then
	echo "== 后端：留回滚快照"
	ssh "${SERVER}" "tar -C '${BACK_DIR}' --exclude node_modules --exclude src/generated -czf /root/qingsi-backend-prev.tgz ."

	echo "== 后端：同步代码"
	rsync -av --delete \
		--exclude node_modules --exclude src/generated --exclude .env --exclude .pnpm-store \
		--exclude '.DS_Store' --exclude '._*' \
		backend/app/ "${SERVER}:${BACK_DIR}/"

	echo "== 后端：依赖 + 迁移 + 重启"
	ssh "${SERVER}" "
		set -e
		docker exec ${BACK_CONTAINER} sh -c 'cd /app && ${MIRROR} pnpm install --frozen-lockfile --prod=false'
		docker exec ${BACK_CONTAINER} sh -c 'cd /app && ${MIRROR} npx prisma generate'
		docker exec ${BACK_CONTAINER} sh -c 'cd /app && npx prisma migrate deploy'
		docker restart ${BACK_CONTAINER}
	"
fi

echo "== 健康检查"
sleep 10
if curl -sf "${SITE_URL}/api/configs" >/dev/null; then
	echo "部署完成，健康检查通过"
else
	echo "健康检查失败。后端回滚：" >&2
	echo "  ssh ${SERVER} \"tar -C ${BACK_DIR} -xzf /root/qingsi-backend-prev.tgz && docker restart ${BACK_CONTAINER}\"" >&2
	exit 1
fi
