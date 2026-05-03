// backend/app/src/utils/rateLimit.js

const store = new Map();
const WINDOW_MS = 60 * 1000; // 1分钟
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟清理一次
const MAX_ENTRIES = 10000; // 防内存泄漏：超过上限按 LRU 淘汰最早条目

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of store.entries()) {
    if (now - timestamp > WINDOW_MS) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export function checkRateLimit(key) {
  const now = Date.now();
  const lastRequest = store.get(key);

  if (lastRequest && now - lastRequest < WINDOW_MS) {
    const remainingSeconds = Math.ceil((WINDOW_MS - (now - lastRequest)) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true };
}

export function recordRequest(key) {
  // Map 迭代顺序为插入顺序，超额时淘汰最早项即可达到 LRU 效果
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.delete(key);
  store.set(key, Date.now());
}
