const dateRangeQuery = {
  type: 'object',
  required: ['startDate', 'endDate'],
  properties: {
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' }
  },
  additionalProperties: false
};

const optionalDateRangePagination = {
  type: 'object',
  properties: {
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 }
  },
  additionalProperties: false
};

const paginationOnly = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 }
  },
  additionalProperties: false
};

export const businessReportSchema = { querystring: dateRangeQuery };
export const paymentSummarySchema = { querystring: dateRangeQuery };
export const cardSalesSummarySchema = { querystring: dateRangeQuery };
export const serviceRankingSchema = { querystring: optionalDateRangePagination };
export const memberRankingSchema = { querystring: optionalDateRangePagination };
export const sleepingMembersSchema = { querystring: paginationOnly };
export const pendingStatsSchema = { querystring: paginationOnly };
