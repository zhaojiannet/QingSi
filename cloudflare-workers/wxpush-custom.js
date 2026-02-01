// wxpush-custom.js - 支持自定义模板字段的微信推送
// 部署到 Cloudflare Workers，替换原来的 wxpush

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 /wxsend 请求
    if (url.pathname === '/wxsend') {
      const params = await getParams(request);

      // 验证 token
      let requestToken = params.token;
      if (!requestToken) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader) {
          const parts = authHeader.split(' ');
          requestToken = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : authHeader;
        }
      }

      if (!requestToken || requestToken !== env.API_TOKEN) {
        return jsonResponse({ msg: 'Invalid token' }, 403);
      }

      // 获取配置
      const appid = env.WX_APPID;
      const secret = env.WX_SECRET;
      const userid = params.userid || env.WX_USERID;
      const template_id = env.WX_TEMPLATE_ID;
      const base_url = env.WX_BASE_URL;

      if (!appid || !secret || !userid || !template_id) {
        return jsonResponse({ msg: 'Missing environment variables' }, 500);
      }

      // 构建模板数据 - 支持自定义字段
      const templateData = {};
      // 注意：不能使用 notes 作为字段名，微信会将其识别为保留的"备注"字段而不显示
      const fieldNames = ['name', 'phone', 'time', 'services', 'staff', 'message', 'title', 'content'];

      for (const field of fieldNames) {
        // 不判断值是否存在，确保所有传入的字段都发送
        if (field in params) {
          templateData[field] = { value: params[field] || '' };
        }
      }

      if (Object.keys(templateData).length === 0) {
        return jsonResponse({ msg: 'Missing template data fields' }, 400);
      }

      try {
        const accessToken = await getAccessToken(appid, secret);
        if (!accessToken) {
          return jsonResponse({ msg: 'Failed to get access token' }, 500);
        }

        const userList = userid.split('|').map(u => u.trim()).filter(Boolean);
        const results = await Promise.all(
          userList.map(uid => sendTemplateMessage(accessToken, uid, template_id, templateData, base_url))
        );

        const successCount = results.filter(r => r.errcode === 0).length;
        if (successCount > 0) {
          return jsonResponse({ msg: `Successfully sent to ${successCount} user(s)` });
        } else {
          const firstError = results[0]?.errmsg || 'Unknown error';
          return jsonResponse({ msg: `Failed: ${firstError}` }, 500);
        }
      } catch (error) {
        return jsonResponse({ msg: error.message }, 500);
      }
    }

    // 首页
    return new Response('WxPush Custom - OK', { status: 200 });
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function getParams(request) {
  const { searchParams } = new URL(request.url);
  const urlParams = Object.fromEntries(searchParams.entries());

  let bodyParams = {};
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        bodyParams = await request.json();
      } else {
        const text = await request.text();
        try {
          bodyParams = JSON.parse(text);
        } catch (e) {
          bodyParams = {};
        }
      }
    } catch (e) {
      bodyParams = {};
    }
  }

  return { ...urlParams, ...bodyParams };
}

async function getAccessToken(appid, secret) {
  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid,
      secret,
      force_refresh: false
    })
  });
  const data = await response.json();
  return data.access_token;
}

async function sendTemplateMessage(accessToken, userid, templateId, data, baseUrl) {
  const payload = {
    touser: userid,
    template_id: templateId,
    data
  };

  // 如果配置了跳转链接
  if (baseUrl) {
    // 字段名映射为中文，按顺序排列
    // 注意：不能使用 notes 作为字段名，微信会将其识别为保留的"备注"字段而不显示
    const fieldOrder = ['name', 'phone', 'time', 'services', 'staff', 'message'];
    const fieldLabels = {
      name: '姓名',
      phone: '电话',
      time: '时间',
      services: '项目',
      staff: '员工',
      message: '留言'
    };

    // 按顺序构建消息内容
    const messageLines = fieldOrder
      .filter(k => data[k])
      .map(k => `${fieldLabels[k]}：${data[k].value}`);

    const urlParams = new URLSearchParams();
    urlParams.set('title', '预约详情');
    urlParams.set('message', messageLines.join('\n'));
    urlParams.set('date', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    payload.url = `${baseUrl}?${urlParams.toString()}`;
  }

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
  return await response.json();
}
