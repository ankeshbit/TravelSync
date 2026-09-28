const { asyncHandler } = require('../middleware/errorHandler');

module.exports = asyncHandler;
module.exports.asyncHandler = asyncHandler;
