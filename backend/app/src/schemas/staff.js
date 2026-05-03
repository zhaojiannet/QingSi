const statusEnum = ['ACTIVE', 'INACTIVE'];

const staffBody = {
  type: 'object',
  required: ['name', 'position'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    position: { type: 'string', minLength: 1, maxLength: 50 },
    phone: { type: ['string', 'null'], maxLength: 20 },
    status: { type: 'string', enum: statusEnum },
    countsCommission: { type: 'boolean' },
    sortOrder: { type: 'integer', minimum: 0, maximum: 9999 }
  },
  additionalProperties: false
};

export const createStaffSchema = { body: staffBody };

export const updateStaffSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
      position: { type: 'string', minLength: 1, maxLength: 50 },
      phone: { type: ['string', 'null'], maxLength: 20 },
      status: { type: 'string', enum: statusEnum },
      countsCommission: { type: 'boolean' },
      sortOrder: { type: 'integer', minimum: 0, maximum: 9999 }
    },
    additionalProperties: false
  }
};

export const staffListQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: statusEnum }
    },
    additionalProperties: false
  }
};
