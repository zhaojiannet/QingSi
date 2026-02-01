// backend/app/src/utils/wxpush.js
// 微信公众号推送（基于 Cloudflare Workers 部署的 wxpush）

const WXPUSH_URL = process.env.WXPUSH_URL;
const WXPUSH_TOKEN = process.env.WXPUSH_TOKEN;

export async function sendNotification(data) {
  if (!WXPUSH_URL || !WXPUSH_TOKEN) {
    console.log('[WxPush] Not configured, skipping notification');
    return { success: false, reason: 'not_configured' };
  }

  // 打印发送的数据用于调试
  console.log('[WxPush] Sending data:', JSON.stringify(data, null, 2));

  try {
    const response = await fetch(WXPUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: WXPUSH_TOKEN,
        ...data
      })
    });

    const result = await response.json();
    if (result.msg?.toLowerCase().includes('success') || result.errcode === 0) {
      console.log('[WxPush] Notification sent:', result.msg);
      return { success: true };
    }
    console.error('[WxPush] Send failed:', result);
    return { success: false, reason: result.msg };
  } catch (err) {
    console.error('[WxPush] Request error:', err.message);
    return { success: false, reason: err.message };
  }
}

export function formatAppointmentNotification(appointment) {
  const date = new Date(appointment.appointmentTime);

  // 使用中国时区格式化
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  });

  // 格式化时间段（如 14:00-14:30）
  const startTime = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });

  const endDate = new Date(date.getTime() + 30 * 60 * 1000);
  const endTime = endDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });

  const timeRange = `${dateStr} ${startTime}-${endTime}`;

  const name = appointment.customerName || '未填写';
  const phone = appointment.customerPhone;
  const services = appointment.services?.map(s => s.name).join('、') || '未指定';
  const staff = appointment.staff?.name || '未指定';
  const message = appointment.notes || '无';

  // 返回完整数据，不做截断
  // 微信模板消息会自动截断超长字段
  // 注意：不能使用 notes 作为字段名，微信会将其识别为保留的"备注"字段而不显示
  return {
    name,
    phone,
    time: timeRange,
    services,
    staff,
    message
  };
}
