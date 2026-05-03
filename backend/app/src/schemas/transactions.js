import { paymentMethodEnum } from './common.js';

const serviceIdArray = {
  type: 'array',
  items: { type: 'string', minLength: 1, maxLength: 191 },
  minItems: 1,
  maxItems: 50
};

const manualPriceAdjustment = {
  type: ['object', 'null'],
  properties: {
    adjustedAmount: { type: 'number', minimum: 0, maximum: 9999999 },
    reason: { type: 'string', minLength: 1, maxLength: 500 }
  },
  required: ['adjustedAmount']
};

export const createTransactionSchema = {
  body: {
    type: 'object',
    required: ['serviceIds', 'paymentMethod'],
    properties: {
      memberId: { type: ['string', 'null'], maxLength: 191 },
      customerName: { type: ['string', 'null'], maxLength: 100 },
      staffId: { type: ['string', 'null'], maxLength: 191 },
      serviceIds: serviceIdArray,
      paymentMethod: { type: 'string', enum: paymentMethodEnum },
      cardId: { type: ['string', 'null'], maxLength: 191 },
      notes: { type: ['string', 'null'], maxLength: 500 },
      appointmentId: { type: ['string', 'null'], maxLength: 191 },
      manualPriceAdjustment,
      customTransactionTime: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
};

export const comboCheckoutSchema = {
  body: {
    type: 'object',
    required: ['memberId', 'serviceIds'],
    properties: {
      memberId: { type: 'string', minLength: 1, maxLength: 191 },
      customerName: { type: ['string', 'null'], maxLength: 100 },
      serviceIds: serviceIdArray,
      staffId: { type: ['string', 'null'], maxLength: 191 },
      notes: { type: ['string', 'null'], maxLength: 500 },
      appointmentId: { type: ['string', 'null'], maxLength: 191 },
      manualPriceAdjustment,
      customTransactionTime: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
};

export const comboPreviewSchema = {
  body: {
    type: 'object',
    required: ['memberId', 'serviceIds'],
    properties: {
      memberId: { type: 'string', minLength: 1, maxLength: 191 },
      serviceIds: serviceIdArray
    },
    additionalProperties: false
  }
};

export const voidTransactionSchema = {
  body: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', minLength: 1, maxLength: 500 }
    },
    additionalProperties: false
  }
};

export const transactionsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      search: { type: 'string', maxLength: 100 }
    },
    additionalProperties: false
  }
};
