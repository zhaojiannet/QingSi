export const updateConfigSchema = {
  body: {
    type: 'object',
    properties: {
      enableLoginCaptcha: { type: 'boolean' },
      enableTransactionVoid: { type: 'boolean' },
      password: { type: 'string', maxLength: 200 }
    },
    additionalProperties: false
  }
};

export const updateBookingCodeSchema = {
  body: {
    type: 'object',
    properties: {
      customCode: { type: 'string', pattern: '^[a-zA-Z0-9_]{2,20}$' }
    },
    additionalProperties: false
  }
};
