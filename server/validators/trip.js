const { z } = require('zod');

const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF', 'CNY', 'AED'];
const ALLOWED_STATUSES = ['planning', 'upcoming', 'active', 'completed', 'cancelled'];

const createTripSchema = z.object({
  name: z.string().trim().min(1, 'Trip name is required').max(100, 'Trip name must be 100 characters or fewer'),
  destination: z.string().trim().min(1, 'Destination is required').max(150, 'Destination must be 150 characters or fewer'),
  startDate: z.string().or(z.date()).pipe(z.coerce.date()),
  endDate: z.string().or(z.date()).pipe(z.coerce.date()),
  budgetPerPerson: z.coerce.number().min(0, 'budgetPerPerson must be non-negative').max(100000000).optional().default(0),
  currency: z.string().trim().toUpperCase().refine(val => !val || ALLOWED_CURRENCIES.includes(val), {
    message: `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`
  }).optional().default('INR'),
  status: z.enum(ALLOWED_STATUSES).optional().default('planning')
}).refine(data => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate']
});

const updateTripSchema = z.object({
  name: z.string().trim().min(1, 'Trip name cannot be empty').max(100, 'Trip name must be 100 characters or fewer').optional(),
  destination: z.string().trim().min(1, 'Destination cannot be empty').max(150, 'Destination must be 150 characters or fewer').optional(),
  startDate: z.string().or(z.date()).pipe(z.coerce.date()).optional(),
  endDate: z.string().or(z.date()).pipe(z.coerce.date()).optional(),
  budgetPerPerson: z.coerce.number().min(0, 'budgetPerPerson must be non-negative').max(100000000).optional(),
  currency: z.string().trim().toUpperCase().refine(val => !val || ALLOWED_CURRENCIES.includes(val), {
    message: `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`
  }).optional(),
  status: z.enum(ALLOWED_STATUSES).optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate']
});

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address')
});

const aiSuggestionsSchema = z.object({
  destination: z.string().trim().min(1).max(150).optional(),
  durationDays: z.coerce.number().int().min(1).max(30).optional(),
  budgetPerPerson: z.coerce.number().min(0).max(100000000).optional(),
  currency: z.string().trim().max(10).optional(),
  interests: z.array(z.string().trim().max(50)).max(10).optional(),
  pace: z.string().trim().max(50).optional()
});

module.exports = {
  ALLOWED_CURRENCIES,
  ALLOWED_STATUSES,
  createTripSchema,
  updateTripSchema,
  addMemberSchema,
  aiSuggestionsSchema
};
