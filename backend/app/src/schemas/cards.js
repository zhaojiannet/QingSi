import { paymentMethodEnum } from './common.js';

export const issueWithTransactionSchema = {
  body: {
    type: 'object',
    required: ['memberId', 'cardTypeId'],
    properties: {
      memberId: { type: 'string', minLength: 1, maxLength: 191 },
      cardTypeId: { type: 'string', minLength: 1, maxLength: 191 },
      staffId: { type: ['string', 'null'], maxLength: 191 },
      paymentMethod: { type: 'string', enum: paymentMethodEnum },
      isCustomCard: { type: 'boolean' },
      customAmount: { type: ['number', 'null'], exclusiveMinimum: 0, maximum: 999999.99 },
      discountSource: { type: 'string', enum: ['card_type', 'custom'] },
      customDiscountRate: { type: ['number', 'null'], exclusiveMinimum: 0, maximum: 1 }
    },
    additionalProperties: false
  }
};
