// wxpush-skin.js - 预约通知详情页（与预约页面风格一致）
// 部署到 Cloudflare Workers，作为点击微信通知后的展示页面

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const title = url.searchParams.get('title') || '消息通知';
    const message = url.searchParams.get('message') || '';
    const date = url.searchParams.get('date') || '';

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
            background: #f0f2f5;
            min-height: 100vh;
            padding-bottom: env(safe-area-inset-bottom);
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 24px 16px 16px;
            background: #fff;
            border-bottom: 1px solid #e4e7ed;
        }

        .header-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #25686c 0%, #1d5457 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .header-icon svg {
            width: 24px;
            height: 24px;
            fill: #fff;
        }

        .header-text {
            display: flex;
            flex-direction: column;
        }

        .header-title {
            font-size: 22px;
            font-weight: 600;
            color: #25686c;
        }

        .header-subtitle {
            font-size: 13px;
            color: #909399;
        }

        .main {
            padding: 16px;
            max-width: 500px;
            margin: 0 auto;
        }

        .card {
            background: #fff;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e4e7ed;
        }

        .card-icon {
            width: 40px;
            height: 40px;
            background: rgba(37, 104, 108, 0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .card-icon svg {
            width: 20px;
            height: 20px;
            fill: #25686c;
        }

        .card-title {
            font-size: 18px;
            font-weight: 600;
            color: #303133;
        }

        .info-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .info-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .info-label {
            font-size: 13px;
            color: #909399;
        }

        .info-value {
            font-size: 15px;
            color: #303133;
            line-height: 1.6;
            white-space: pre-line;
            word-break: break-word;
        }

        .time-section {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #e4e7ed;
        }

        .time-label {
            font-size: 12px;
            color: #909399;
        }

        .time-value {
            font-size: 13px;
            color: #606266;
            margin-top: 4px;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #909399;
            font-size: 12px;
        }

        @media (max-width: 480px) {
            .header {
                padding: 16px;
            }

            .header-icon {
                width: 36px;
                height: 36px;
            }

            .header-title {
                font-size: 18px;
            }

            .main {
                padding: 12px;
            }

            .card {
                padding: 20px 16px;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
            </svg>
        </div>
        <div class="header-text">
            <span class="header-title">预约通知</span>
        </div>
    </header>

    <main class="main">
        <div class="card">
            <div class="card-header">
                <div class="card-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <h1 class="card-title">${title}</h1>
            </div>

            <div class="info-list">
                <div class="info-item">
                    <span class="info-label">详细信息</span>
                    <div class="info-value" id="message">${message}</div>
                </div>
            </div>

            ${date ? `
            <div class="time-section">
                <div class="time-label">通知时间</div>
                <div class="time-value">${date}</div>
            </div>
            ` : ''}
        </div>
    </main>

</body>
</html>
    `;

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  },
};
