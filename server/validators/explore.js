const { z } = require('zod');

const exploreQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1)
});

module.exports = {
  exploreQuerySchema
};
