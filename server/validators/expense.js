const { z } = require('zod');

const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must be 100 characters or fewer'),
  amount: z.coerce.number().positive('Amount must be positive').finite('Amount must be a finite number').max(100000000, 'Amount must be 100,000,000 or less'),
  currency: z.string().trim().max(10).optional().default('INR'),
  category: z.string().trim().max(50).optional().default('other'),
  paidById: z.string().trim().optional(),
  splitAmong: z.array(z.string().trim().min(1)).min(1, 'splitAmong must contain at least one user ID').optional(),
  splits: z.array(z.object({
    userId: z.string().trim().min(1),
    amount: z.coerce.number().min(0)
  })).optional()
}).refine(data => {
  return (data.splitAmong && data.splitAmong.length > 0) || (data.splits && data.splits.length > 0);
}, {
  message: 'splitAmong or splits must contain at least one participant',
  path: ['splitAmong']
});

module.exports = {
  createExpenseSchema
};
