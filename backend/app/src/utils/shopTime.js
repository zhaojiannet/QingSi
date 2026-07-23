// backend/app/src/utils/shopTime.js
// 门店时区固定 UTC+8（与前端 timezone-unified 的主时区一致）。
// 容器按 UTC 运行，报表/今日的日期边界若直接 setHours 会整体错位 8 小时，
// 故统一在此按门店本地日计算对应的 UTC 起止时刻。
const SHOP_TZ = '+08:00';

// "YYYY-MM-DD" 起止日期字符串 → 门店本地整日覆盖的 UTC 起止时刻
export function shopDayRange(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T00:00:00.000${SHOP_TZ}`);
  const end = new Date(`${endDateStr}T23:59:59.999${SHOP_TZ}`);
  return { start, end };
}

// 门店"今天"的 UTC 起止时刻
export function shopTodayRange() {
  // 加 8 小时后用 UTC 读，即得到门店本地（+8）墙钟的日期
  const nowShop = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const dateStr = nowShop.toISOString().slice(0, 10);
  return shopDayRange(dateStr, dateStr);
}

// 最近 n 个月（含当月）：门店本地月份 key 列表 + 覆盖整个窗口的 UTC 起止时刻
export function shopMonthWindow(n) {
  const nowShop = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = nowShop.getUTCFullYear();
  const m = nowShop.getUTCMonth();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const start = new Date(`${months[0]}-01T00:00:00.000${SHOP_TZ}`);
  // 上界取当月最后一刻（门店本地），与 shopDayRange 的整日边界口径一致，
  // 否则补录时间晚于"现在"的交易会被漏计
  const nextMonth = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 7);
  const end = new Date(new Date(`${nextMonth}-01T00:00:00.000${SHOP_TZ}`).getTime() - 1);
  return { months, start, end };
}

// 交易时刻 → 门店本地月份 key "YYYY-MM"
export function shopMonthKey(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
