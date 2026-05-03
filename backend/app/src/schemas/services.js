import { availabilityEnum } from './common.js';

const serviceBody = {
  type: 'object',
  required: ['name', 'standardPrice'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    standardPrice: { type: ['number', 'string'] },
    status: { type: 'string', enum: availabilityEnum },
    sortOrder: { type: 'integer', minimum: 0, maximum: 9999 },
    noDiscount: { type: 'boolean' }
  },
  additionalProperties: false
};

export const createServiceSchema = { body: serviceBody };
export const updateServiceSchema = { body: serviceBody };
