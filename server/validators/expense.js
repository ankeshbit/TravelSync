const { z } = require('zod');

const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must be 100 characters or fewer'),
  amount: z.coerce.number().positive('Amount must be positive').finite('Amount must be a finite number').max(100000000, 'Amount must be 100,000,000 or less'),
  currency: z.string().trim().max(10).optional(),
  category: z.string().trim().max(50).optional().default('other'),
  receiptUrl: z.string().url('receiptUrl must be a valid URL').optional().or(z.literal('')).default(''),
  paidBy: z.string().trim().min(1, 'paidBy (user ID) is required'),
  splitAmong: z.array(z.string().trim().min(1, 'Each split entry must be a non-empty user ID')).min(1, 'splitAmong must contain at least one user ID')
});

module.exports = {
  createExpenseSchema
};

