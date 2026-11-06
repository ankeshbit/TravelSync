const { z } = require('zod');
const { ALLOWED_CURRENCIES } = require('./trip');

const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must be 100 characters or fewer'),
  amount: z.coerce.number().positive('Amount must be positive').finite('Amount must be a finite number').max(100000000, 'Amount must be 100,000,000 or less'),
  currency: z.string().trim().toUpperCase().refine(val => !val || ALLOWED_CURRENCIES.includes(val), {
    message: `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`
  }).optional(),
  category: z.string().trim().max(50).optional().default('other'),
  receiptUrl: z.string().url('receiptUrl must be a valid URL').optional().or(z.literal('')).default(''),
  paidBy: z.string().trim().min(1, 'paidBy (user ID) is required'),
  splitAmong: z.array(z.string().trim().min(1, 'Each split entry must be a non-empty user ID')).min(1, 'splitAmong must contain at least one user ID')
});

const updateExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(100, 'Title must be 100 characters or fewer').optional(),
  amount: z.coerce.number().positive('Amount must be positive').finite('Amount must be a finite number').max(100000000, 'Amount must be 100,000,000 or less').optional(),
  currency: z.string().trim().toUpperCase().refine(val => !val || ALLOWED_CURRENCIES.includes(val), {
    message: `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`
  }).optional(),
  category: z.string().trim().max(50).optional(),
  receiptUrl: z.string().url('receiptUrl must be a valid URL').optional().or(z.literal('')).optional(),
  paidBy: z.string().trim().min(1, 'paidBy must be a valid user ID').optional(),
  splitAmong: z.array(z.string().trim().min(1, 'Each split entry must be a non-empty user ID')).min(1, 'splitAmong must contain at least one user ID').optional()
});

module.exports = {
  createExpenseSchema,
  updateExpenseSchema
};
