// 共用 schema 片段 - 在多个路由间复用
export const idParam = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', minLength: 1, maxLength: 191 }
  },
  required: ['id']
};

export const phoneSchema = {
  type: 'string',
  pattern: '^(1[3-9]\\d{9}|0{11})$',
  description: '中国大陆手机号或 11 位 0 占位符'
};

export const paginationQuery = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  },
  additionalProperties: true
};

export const paymentMethodEnum = ['CASH', 'WECHAT_PAY', 'ALIPAY', 'DOUYIN', 'MEITUAN', 'CARD_SWIPE', 'MEMBER_CARD', 'OTHER'];

export const memberStatusEnum = ['ACTIVE', 'INACTIVE', 'DELETED'];
export const genderEnum = ['MALE', 'FEMALE', 'UNKNOWN'];
export const availabilityEnum = ['AVAILABLE', 'UNAVAILABLE'];
