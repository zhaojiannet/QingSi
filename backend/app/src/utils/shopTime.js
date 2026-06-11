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
