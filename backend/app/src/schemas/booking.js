// 公开预约 schema
const codeQuery = {
  type: 'object',
  required: ['code'],
  properties: {
    code: { type: 'string', minLength: 2, maxLength: 32, pattern: '^[a-zA-Z0-9_]+$' }
  }
};

export const bookingOptionsSchema = {
  querystring: codeQuery
};

export const createBookingSchema = {
  querystring: codeQuery,
  body: {
    type: 'object',
    required: ['customerPhone', 'appointmentTime', 'serviceIds'],
    properties: {
      customerName: { type: 'string', maxLength: 50 },
      customerPhone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
      appointmentTime: { type: 'string', minLength: 1 },
      serviceIds: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 191 },
        minItems: 1,
        maxItems: 20
      },
      assignedStaffId: { type: ['string', 'null'], maxLength: 191 },
      notes: { type: ['string', 'null'], maxLength: 500 }
    },
    additionalProperties: false
  }
};
