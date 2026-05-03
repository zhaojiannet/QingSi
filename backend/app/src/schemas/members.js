import { phoneSchema, genderEnum, memberStatusEnum } from './common.js';

export const createMemberSchema = {
  body: {
    type: 'object',
    required: ['name', 'phone'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
      phone: phoneSchema,
      gender: { type: 'string', enum: genderEnum },
      birthday: { type: 'string', format: 'date' },
      notes: { type: 'string', maxLength: 500 }
    },
    additionalProperties: false
  }
};

export const updateMemberSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
      phone: phoneSchema,
      gender: { type: 'string', enum: genderEnum },
      birthday: { type: ['string', 'null'], format: 'date' },
      status: { type: 'string', enum: memberStatusEnum },
      notes: { type: ['string', 'null'], maxLength: 500 }
    },
    additionalProperties: false
  }
};

export const issueCardSchema = {
  body: {
    type: 'object',
    required: ['cardTypeId'],
    properties: {
      cardTypeId: { type: 'string', minLength: 1, maxLength: 191 },
      expiryDate: { type: ['string', 'null'], format: 'date' }
    },
    additionalProperties: false
  }
};

export const addPendingSchema = {
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0, maximum: 999999.99 },
      description: { type: ['string', 'null'], maxLength: 500 },
      createdAt: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
};

export const clearPendingSchema = {
  body: {
    type: 'object',
    properties: {
      paymentMethod: { type: 'string', enum: ['CASH', 'MEMBER_CARD', 'OTHER'] },
      cardId: { type: ['string', 'null'], maxLength: 191 }
    },
    additionalProperties: false
  }
};
