// backend/app/src/utils/timezone.js
// 时区处理工具类 - 支持国际化

/**
 * 时区配置 - 支持中国北京和日本东京
 */
const TIMEZONES = {
  // 中国北京时区 (UTC+8)
  BEIJING: 'Asia/Shanghai',
  // 日本东京时区 (UTC+9)
  TOKYO: 'Asia/Tokyo',
  // 默认时区：中国北京
  DEFAULT: 'Asia/Shanghai'
};

/**
 * 获取客户端时区（从请求头或用户设置）
 * @param {Object} request - Fastify request对象
 * @returns {string} 时区字符串
 */
function getClientTimezone(request) {
  // 1. 从用户设置获取（如果用户已登录并设置了时区偏好）
  if (request.user && request.user.timezone) {
    return request.user.timezone;
  }
  
  // 2. 从请求头获取
  const timezoneHeader = request.headers['x-timezone'];
  if (timezoneHeader && Object.values(TIMEZONES).includes(timezoneHeader)) {
    return timezoneHeader;
  }
  
  // 3. 从Accept-Language推断地区时区
  const acceptLanguage = request.headers['accept-language'];
  if (acceptLanguage) {
    if (acceptLanguage.includes('zh-CN') || acceptLanguage.includes('zh-TW')) {
      return TIMEZONES.BEIJING;  // 中文 -> 北京时区
    }
    if (acceptLanguage.includes('ja')) {
      return TIMEZONES.TOKYO;    // 日文 -> 东京时区
    }
  }
  
  // 4. 默认使用中国北京时区
  return TIMEZONES.DEFAULT;
}

/**
 * 将UTC时间转换为指定时区的时间字符串
 * @param {Date} utcDate - UTC时间
 * @param {string} timezone - 目标时区
 * @returns {string} 格式化的本地时间字符串
 */
function utcToTimezone(utcDate, timezone = TIMEZONES.DEFAULT) {
  if (!utcDate) return null;
  
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(utcDate));
  } catch (error) {
    console.error('时区转换失败:', error);
    return utcDate.toISOString();
  }
}

/**
 * 将本地时间转换为UTC时间
 * @param {string|Date} localTime - 本地时间
 * @param {string} timezone - 源时区
 * @returns {Date} UTC时间对象
 */
function timezoneToUtc(localTime, timezone = TIMEZONES.DEFAULT) {
  if (!localTime) return null;
  
  try {
    const date = new Date(localTime);
    // 如果是字符串且没有时区信息，假设为指定时区
    if (typeof localTime === 'string' && !localTime.includes('T') && !localTime.includes('Z')) {
      // 简单处理：假设输入为 YYYY-MM-DD HH:mm:ss 格式
      const [datePart, timePart] = localTime.split(' ');
      if (datePart && timePart) {
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        return new Date(Date.UTC(
          parseInt(year),
          parseInt(month) - 1, 
          parseInt(day),
          parseInt(hour) - getTimezoneOffset(timezone),
          parseInt(minute) || 0,
          parseInt(second) || 0
        ));
      }
    }
    return date;
  } catch (error) {
    console.error('时区转换失败:', error);
    return new Date(localTime);
  }
}

/**
 * 获取时区偏移小时数
 * @param {string} timezone - 时区
 * @returns {number} 偏移小时数
 */
function getTimezoneOffset(timezone) {
  const offsets = {
    [TIMEZONES.BEIJING]: 8,  // 北京时区 UTC+8
    [TIMEZONES.TOKYO]: 9     // 东京时区 UTC+9
  };
  return offsets[timezone] || 8; // 默认北京时区 +8
}

/**
 * 格式化日期为本地显示格式
 * @param {Date} date - 日期对象
 * @param {string} timezone - 时区
 * @param {string} format - 格式类型: 'date', 'datetime', 'time'
 * @returns {string} 格式化的日期字符串
 */
function formatDateForDisplay(date, timezone = TIMEZONES.DEFAULT, format = 'datetime') {
  if (!date) return '';
  
  try {
    const options = {
      timeZone: timezone,
      hour12: false
    };
    
    switch (format) {
      case 'date':
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
      case 'datetime':
      default:
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
    }
    
    return new Intl.DateTimeFormat('zh-CN', options).format(new Date(date));
  } catch (error) {
    console.error('日期格式化失败:', error);
    return date.toString();
  }
}

/**
 * Fastify 插件：自动处理请求响应中的时区转换
 */
const timezonePlugin = async function (fastify, options) {
  // 注册时区处理hook
  fastify.addHook('onSend', async (request, reply, payload) => {
    // 只处理JSON响应
    if (reply.getHeader('content-type')?.includes('application/json')) {
      try {
        const data = JSON.parse(payload);
        const clientTimezone = getClientTimezone(request);
        
        // 调试日志
        console.log('时区转换处理: URL=', request.url, 'Timezone=', clientTimezone);
        
        // 递归转换对象中的所有日期字段
        const convertDates = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;
          
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];
              
              // 检查是否为日期字段（通常以Date、Time、At结尾）
              if (value && typeof value === 'string' && 
                  (key.toLowerCase().includes('date') || 
                   key.toLowerCase().includes('time') || 
                   key.toLowerCase().endsWith('at')) &&
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                console.log(`转换日期字段: ${key} = ${value} -> 时区: ${clientTimezone}`);
                obj[key] = utcToTimezone(new Date(value), clientTimezone);
              } else if (Array.isArray(value)) {
                value.forEach(convertDates);
              } else if (typeof value === 'object') {
                convertDates(value);
              }
            }
          }
          return obj;
        };
        
        const convertedData = convertDates(data);
        return JSON.stringify(convertedData);
      } catch (error) {
        // 如果处理失败，返回原始payload
        console.error('时区转换处理失败:', error);
        return payload;
      }
    }
    
    return payload;
  });
};

export {
  TIMEZONES,
  getClientTimezone,
  utcToTimezone,
  timezoneToUtc,
  formatDateForDisplay,
  timezonePlugin
};