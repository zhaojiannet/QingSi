const appointmentStatusEnum = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export const createAppointmentSchema = {
  body: {
    type: 'object',
    required: ['customerPhone', 'appointmentTime', 'serviceIds'],
    properties: {
      memberId: { type: ['string', 'null'], maxLength: 191 },
      customerName: { type: ['string', 'null'], maxLength: 50 },
      customerPhone: { type: 'string', minLength: 1, maxLength: 20 },
      appointmentTime: { type: 'string', minLength: 1 },
      assignedStaffId: { type: ['string', 'null'], maxLength: 191 },
      serviceIds: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 191 },
        minItems: 1,
        maxItems: 20
      },
      notes: { type: ['string', 'null'], maxLength: 500 }
    },
    additionalProperties: false
  }
};

export const updateAppointmentStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: appointmentStatusEnum }
    },
    additionalProperties: false
  }
};

export const appointmentsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      staffId: { type: 'string', maxLength: 191 },
      status: { type: 'string', enum: appointmentStatusEnum }
    },
    additionalProperties: false
  }
};
