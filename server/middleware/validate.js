/**
 * Middleware factory for validating express request objects (body, params, query) using Zod.
 *
 * @param {Object} schemas
 * @param {import('zod').ZodSchema} [schemas.body]
 * @param {import('zod').ZodSchema} [schemas.params]
 * @param {import('zod').ZodSchema} [schemas.query]
 */
function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    const formattedErrors = [];

    if (body) {
      const result = body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          formattedErrors.push({
            path: `body.${issue.path.join('.')}`,
            message: issue.message
          });
        }
      } else {
        req.body = result.data;
      }
    }

    if (params) {
      const result = params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          formattedErrors.push({
            path: `params.${issue.path.join('.')}`,
            message: issue.message
          });
        }
      } else {
        req.params = result.data;
      }
    }

    if (query) {
      const result = query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          formattedErrors.push({
            path: `query.${issue.path.join('.')}`,
            message: issue.message
          });
        }
      } else {
        req.query = result.data;
      }
    }

    if (formattedErrors.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: formattedErrors[0].message || 'Validation failed',
        errors: formattedErrors
      });
    }

    next();
  };
}

module.exports = { validate };
