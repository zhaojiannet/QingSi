import { availabilityEnum } from './common.js';

const cardTypeBody = {
  type: 'object',
  required: ['name', 'initialPrice', 'discountRate'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    initialPrice: { type: ['number', 'string'] },
    discountRate: { type: ['number', 'string'] },
    status: { type: 'string', enum: availabilityEnum }
  },
  additionalProperties: false
};

export const createCardTypeSchema = { body: cardTypeBody };
export const updateCardTypeSchema = { body: cardTypeBody };
