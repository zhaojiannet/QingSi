// 性能优化工具函数

/**
 * 防抖函数
 * @param {Function} func 要执行的函数
 * @param {number} wait 等待时间（毫秒）
 * @param {boolean} immediate 是否立即执行
 */
export function debounce(func, wait = 300, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const context = this;
    
    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
}

/**
 * 节流函数
 * @param {Function} func 要执行的函数
 * @param {number} limit 时间限制（毫秒）
 */
export function throttle(func, limit = 100) {
  let inThrottle;
  let lastFunc;
  let lastRan;
  
  return function(...args) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, Math.max(limit - (Date.now() - lastRan), 0));
    }
  };
}

/**
 * 图片懒加载指令
 */
export const lazyLoadDirective = {
  mounted(el, binding) {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = binding.value;
          
          if (src) {
            // 创建新图片对象预加载
            const tempImg = new Image();
            tempImg.onload = () => {
              img.src = src;
              img.classList.add('loaded');
            };
            tempImg.src = src;
          }
          
          observer.unobserve(img);
        }
      });
    }, options);

    imageObserver.observe(el);
  }
};

/**
 * 虚拟滚动钩子
 * @param {Array} items 数据列表
 * @param {number} itemHeight 每项高度
 * @param {number} containerHeight 容器高度
 */
export function useVirtualScroll(items, itemHeight = 50, containerHeight = 500) {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = ref(0);
  const endIndex = ref(visibleCount);
  
  const visibleItems = computed(() => {
    return items.value.slice(startIndex.value, endIndex.value);
  });
  
  const totalHeight = computed(() => {
    return items.value.length * itemHeight;
  });
  
  const offsetY = computed(() => {
    return startIndex.value * itemHeight;
  });
  
  const handleScroll = (scrollTop) => {
    const start = Math.floor(scrollTop / itemHeight);
    startIndex.value = start;
    endIndex.value = start + visibleCount;
  };
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  };
}

/**
 * 请求缓存
 */
class RequestCache {
  constructor(ttl = 60000) { // 默认60秒
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  generateKey(url, params) {
    return `${url}:${JSON.stringify(params || {})}`;
  }
  
  get(url, params) {
    const key = this.generateKey(url, params);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  set(url, params, data) {
    const key = this.generateKey(url, params);
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }
  
  clear() {
    this.cache.clear();
  }
}

export const requestCache = new RequestCache();

/**
 * 带缓存的请求包装器
 */
export function cachedRequest(requestFn, ttl = 60000) {
  const cache = new RequestCache(ttl);
  
  return async function(url, params) {
    // 尝试从缓存获取
    const cached = cache.get(url, params);
    if (cached) {
      console.log('Cache hit:', url);
      return cached;
    }
    
    // 执行请求
    const result = await requestFn(url, params);
    
    // 缓存结果
    cache.set(url, params, result);
    
    return result;
  };
}