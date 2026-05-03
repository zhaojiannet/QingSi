export const voidLogsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' }
    },
    additionalProperties: false
  }
};
