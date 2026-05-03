const statusEnum = ['AVAILABLE', 'UNAVAILABLE'];

const serviceBody = {
  type: 'object',
  required: ['name', 'standardPrice'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    standardPrice: { type: ['number', 'string'] },
    status: { type: 'string', enum: statusEnum },
    sortOrder: { type: 'integer', minimum: 0, maximum: 9999 },
    noDiscount: { type: 'boolean' }
  },
  additionalProperties: false
};

export const createServiceSchema = { body: serviceBody };
export const updateServiceSchema = { body: serviceBody };
