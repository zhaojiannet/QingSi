// 统一时区处理模块 - 消除循环依赖和过度抽象
// 遵循Linus的"好品味"原则：简单、直接、单一职责

// 支持的时区（仅支持实际需要的）
const TIMEZONES = {
  BEIJING: 'Asia/Shanghai',  // UTC+8
  TOKYO: 'Asia/Tokyo'        // UTC+9
};

// 单一数据源 - 避免缓存不一致
let currentTimezone = null;
let lastDetectionTime = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24小时

/**
 * 获取用户时区 - 唯一的时区获取接口
 * @returns {string} 时区字符串
 */
export function getUserTimezone() {
  const now = Date.now();
  
  // 检查内存缓存
  if (currentTimezone && (now - lastDetectionTime) < CACHE_TTL_MS) {
    return currentTimezone;
  }
  
  // 尝试从localStorage恢复
  if (!currentTimezone) {
    const stored = getStoredTimezone();
    if (stored && (now - stored.time) < CACHE_TTL_MS) {
      currentTimezone = stored.timezone;
      lastDetectionTime = stored.time;
      return currentTimezone;
    }
  }
  
  // 检测系统时区
  currentTimezone = detectSystemTimezone();
  lastDetectionTime = now;
  
  // 持久化存储
  saveTimezoneToStorage(currentTimezone, now);
  
  return currentTimezone;
}

/**
 * 系统时区检测 - 内部函数
 */
function detectSystemTimezone() {
  try {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // 直接匹配支持的时区
    if (systemTz === TIMEZONES.TOKYO) {
      return TIMEZONES.TOKYO;
    }
    
    // 默认北京时区
    return TIMEZONES.BEIJING;
    
  } catch (error) {
    console.warn('时区检测失败，使用默认:', error);
    return TIMEZONES.BEIJING;
  }
}

/**
 * 从存储获取时区信息
 */
function getStoredTimezone() {
  try {
    const timezone = localStorage.getItem('user_timezone');
    const timeStr = localStorage.getItem('timezone_detection_time');
    
    if (timezone && timeStr) {
      return {
        timezone,
        time: parseInt(timeStr)
      };
    }
  } catch (error) {
    console.warn('读取存储时区失败:', error);
  }
  return null;
}

/**
 * 保存时区到存储
 */
function saveTimezoneToStorage(timezone, timestamp) {
  try {
    localStorage.setItem('user_timezone', timezone);
    localStorage.setItem('timezone_detection_time', timestamp.toString());
  } catch (error) {
    console.warn('保存时区失败:', error);
  }
}

/**
 * 设置API请求头
 */
export function setTimezoneHeader(headers = {}) {
  headers['X-Timezone'] = getUserTimezone();
  return headers;
}

/**
 * 格式化日期显示
 */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: getUserTimezone()
  };
  
  return new Intl.DateTimeFormat('zh-CN', { ...defaultOptions, ...options }).format(date);
}

/**
 * 格式化短日期
 */
export function formatShortDate(dateStr) {
  return formatDate(dateStr, {
    hour: undefined,
    minute: undefined, 
    second: undefined
  });
}

/**
 * 格式化时间
 */
export function formatTime(dateStr) {
  return formatDate(dateStr, {
    year: undefined,
    month: undefined,
    day: undefined
  });
}

/**
 * 本地时间转服务器时间
 */
export function localToServerTime(localDateTime) {
  if (!localDateTime) return null;
  return new Date(localDateTime).toISOString();
}

/**
 * 获取当前ISO时间
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * 强制重新检测时区
 */
export function forceTimezoneDetection() {
  currentTimezone = null;
  lastDetectionTime = 0;
  localStorage.removeItem('user_timezone');
  localStorage.removeItem('timezone_detection_time');
  return getUserTimezone();
}

/**
 * 获取时区调试信息
 */
export function getTimezoneDebugInfo() {
  return {
    currentTimezone,
    lastDetectionTime,
    systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cacheValid: currentTimezone && (Date.now() - lastDetectionTime) < CACHE_TTL_MS,
    storage: getStoredTimezone()
  };
}

/**
 * Vue 3 插件
 */
export default {
  install(app) {
    const timezone = {
      getUserTimezone,
      formatDate,
      formatShortDate,
      formatTime,
      localToServerTime,
      nowISO,
      forceTimezoneDetection,
      getDebugInfo: getTimezoneDebugInfo
    };
    
    app.config.globalProperties.$timezone = timezone;
    app.provide('timezone', timezone);
  }
};

// 开发环境调试
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window.timezoneDebug = {
    getInfo: getTimezoneDebugInfo,
    forceDetect: forceTimezoneDetection,
    testFormat: (date) => ({
      原始: date,
      格式化: formatDate(date),
      短日期: formatShortDate(date), 
      时间: formatTime(date)
    })
  };
  console.log('🛠️ 时区调试: window.timezoneDebug');
}