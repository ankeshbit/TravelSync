const { z } = require('zod');

const idParamSchema = z.object({
  id: z.string().trim().min(1, 'ID is required').max(128, 'ID is too long')
});

const tripIdParamSchema = z.object({
  tripId: z.string().trim().min(1, 'tripId is required').max(128, 'tripId is too long')
});

const tripAndPlaceParamSchema = z.object({
  tripId: z.string().trim().min(1, 'tripId is required').max(128, 'tripId is too long'),
  placeId: z.string().trim().min(1, 'placeId is required').max(128, 'placeId is too long')
});

const tripAndExpenseParamSchema = z.object({
  tripId: z.string().trim().min(1, 'tripId is required').max(128, 'tripId is too long'),
  expenseId: z.string().trim().min(1, 'expenseId is required').max(128, 'expenseId is too long')
});

const tripAndMemberParamSchema = z.object({
  tripId: z.string().trim().min(1, 'tripId is required').max(128, 'tripId is too long'),
  userId: z.string().trim().min(1, 'userId is required').max(128, 'userId is too long')
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

module.exports = {
  idParamSchema,
  tripIdParamSchema,
  tripAndPlaceParamSchema,
  tripAndExpenseParamSchema,
  tripAndMemberParamSchema,
  paginationQuerySchema
};
