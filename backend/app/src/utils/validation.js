// 输入验证和清理工具
// 注意：需要安装 @sinclair/typebox ajv ajv-formats

// 基础验证规则
export const schemas = {
  // 会员相关
  member: {
    create: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 50 },
        phone: { 
          type: 'string', 
          pattern: '^1[3-9]\\d{9}$',
          description: '中国大陆手机号'
        },
        gender: { 
          type: 'string', 
          enum: ['MALE', 'FEMALE', 'UNKNOWN'],
          nullable: true 
        },
        birthday: { 
          type: 'string', 
          format: 'date',
          nullable: true 
        },
        notes: { 
          type: 'string', 
          maxLength: 500,
          nullable: true 
        }
      },
      required: ['name', 'phone'],
      additionalProperties: false
    },
    update: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 50 },
        phone: { 
          type: 'string', 
          pattern: '^1[3-9]\\d{9}$'
        },
        gender: { 
          type: 'string', 
          enum: ['MALE', 'FEMALE', 'UNKNOWN'] 
        },
        birthday: { 
          type: 'string', 
          format: 'date'
        },
        notes: { 
          type: 'string', 
          maxLength: 500
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'DELETED']
        }
      },
      additionalProperties: false
    }
  },

  // 交易相关
  transaction: {
    create: {
      type: 'object',
      properties: {
        memberId: { 
          type: 'string',
          nullable: true 
        },
        staffId: { 
          type: 'string',
          nullable: true 
        },
        serviceIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          nullable: true  // 可选，因为可以使用新的services格式
        },
        services: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              quantity: { 
                type: 'integer',
                minimum: 1,
                maximum: 99
              }
            },
            required: ['id', 'quantity']
          },
          minItems: 1,
          nullable: true  // 可选，因为可以使用旧的serviceIds格式
        },
        paymentMethod: {
          type: 'string',
          enum: ['CASH', 'WECHAT_PAY', 'ALIPAY', 'CARD_SWIPE', 'MEMBER_CARD', 'OTHER']
        },
        cardId: {
          type: 'string',
          nullable: true
        },
        notes: {
          type: 'string',
          maxLength: 500,
          nullable: true
        },
        appointmentId: {
          type: 'string',
          nullable: true
        }
      },
      required: ['paymentMethod'],  // 只要求paymentMethod，serviceIds或services二选一
      additionalProperties: false
    }
  },

  // 用户认证
  auth: {
    login: {
      type: 'object',
      properties: {
        username: { 
          type: 'string', 
          minLength: 3,
          maxLength: 50 
        },
        password: { 
          type: 'string', 
          minLength: 6,
          maxLength: 100 
        },
        captchaText: {
          type: 'string',
          maxLength: 10,
          nullable: true
        },
        trustDevice: {
          type: 'boolean',
          nullable: true
        }
      },
      required: ['username', 'password'],
      additionalProperties: false
    }
  },

  // 通用分页查询
  pagination: {
    type: 'object',
    properties: {
      page: { 
        type: 'integer', 
        minimum: 1,
        default: 1 
      },
      limit: { 
        type: 'integer', 
        minimum: 1,
        maximum: 100,
        default: 10 
      },
      search: {
        type: 'string',
        maxLength: 100,
        nullable: true
      }
    },
    additionalProperties: false
  }
};

// XSS清理函数
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // 移除或转义危险字符
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#61;');
}

// 递归清理对象中的所有字符串
export function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// SQL注入防护 - 验证ID格式
export function isValidId(id) {
  // 只允许字母数字和连字符
  return /^[a-zA-Z0-9-_]+$/.test(id);
}

// 手机号脱敏
export function maskPhone(phone) {
  if (!phone || phone.length < 11) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

// 创建验证中间件
export function createValidationHook(schema) {
  return async (request, reply) => {
    try {
      // 这里暂时使用简单验证，等依赖安装后可以使用ajv
      const data = request.body || {};
      
      // 基础验证示例
      if (schema.required) {
        for (const field of schema.required) {
          if (!data[field]) {
            return reply.code(400).send({
              message: `缺少必填字段: ${field}`
            });
          }
        }
      }
      
      // XSS清理
      request.body = sanitizeObject(data);
      
    } catch (error) {
      reply.code(400).send({
        message: '请求数据验证失败',
        error: error.message
      });
    }
  };
}