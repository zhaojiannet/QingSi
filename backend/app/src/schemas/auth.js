// 认证相关 schema
export const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 50 },
      password: { type: 'string', minLength: 1, maxLength: 100 },
      captchaText: { type: 'string', maxLength: 10 },
      trustDevice: { type: 'boolean' }
    },
    additionalProperties: false
  }
};

export const refreshSchema = {
  // refresh token 优先从 httpOnly cookie 读取，body 仅为兼容旧客户端，故不强制
  body: {
    type: 'object',
    properties: {
      refreshToken: { type: 'string', minLength: 1, maxLength: 256 }
    },
    additionalProperties: false
  }
};

export const logoutSchema = {
  body: {
    type: 'object',
    properties: {
      refreshToken: { type: 'string', maxLength: 256 }
    },
    additionalProperties: false
  }
};

export const passwordChangeSchema = {
  body: {
    type: 'object',
    required: ['oldPassword', 'newPassword'],
    properties: {
      oldPassword: { type: 'string', minLength: 1, maxLength: 100 },
      newPassword: { type: 'string', minLength: 6, maxLength: 100 }
    },
    additionalProperties: false
  }
};
