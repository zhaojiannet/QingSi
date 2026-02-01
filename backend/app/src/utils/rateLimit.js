// backend/app/src/utils/rateLimit.js

const store = new Map();
const WINDOW_MS = 60 * 1000; // 1分钟
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟清理一次

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
  store.set(key, Date.now());
}
