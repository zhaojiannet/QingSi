// 简单的内存缓存实现
// 生产环境建议使用 Redis

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  // 设置缓存
  set(key, value, ttl = 3600) {
    // 清除之前的定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 设置新值
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000
    });

    // 设置自动过期
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
    return true;
  }

  // 获取缓存
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expires) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  // 删除缓存
  delete(key) {
    // 清除定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    return this.cache.delete(key);
  }

  // 清空所有缓存
  clear() {
    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
  }

  // 获取缓存大小
  size() {
    return this.cache.size;
  }

  // 检查是否存在
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > item.expires) {
      this.delete(key);
      return false;
    }

    return true;
  }
}

// 创建缓存实例
const cache = new MemoryCache();

// 缓存键生成器
export const cacheKeys = {
  // 会员列表缓存键
  memberList: (page, limit, search) => `members:list:${page}:${limit}:${search || 'all'}`,
  
  // 会员详情缓存键
  memberDetail: (id) => `members:detail:${id}`,
  
  // 服务列表缓存键
  serviceList: () => 'services:list',
  
  // 系统配置缓存键
  systemConfig: () => 'system:config',
  
  // 报表数据缓存键
  report: (type, date) => `report:${type}:${date}`,
};

// 缓存装饰器
export function cacheable(keyGenerator, ttl = 3600) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const key = keyGenerator(...args);
      
      // 尝试从缓存获取
      const cached = cache.get(key);
      if (cached !== null) {
        console.log(`Cache hit: ${key}`);
        return cached;
      }
      
      // 执行原方法
      const result = await originalMethod.apply(this, args);
      
      // 存入缓存
      cache.set(key, result, ttl);
      console.log(`Cache set: ${key}`);
      
      return result;
    };
    
    return descriptor;
  };
}

// 清除缓存的辅助函数
export function invalidateCache(pattern) {
  let count = 0;
  
  for (const key of cache.cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      count++;
    }
  }
  
  console.log(`Invalidated ${count} cache entries matching pattern: ${pattern}`);
  return count;
}

export default cache;