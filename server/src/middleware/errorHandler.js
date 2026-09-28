/**
 * Centralized Error Handling Middleware
 * Ensures safe, client-friendly error messages without leaking stack traces or internal secrets.
 */
const errorHandler = (err, req, res, next) => {
  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload in request body',
    });
  }

  // Handle Prisma Known Request Errors
  if (err.code && err.code.startsWith('P')) {
    let statusCode = 400;
    let message = 'Database operation failed due to invalid request data';

    if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Requested record not found';
    } else if (err.code === 'P2002') {
      statusCode = 409;
      message = 'A record with this unique identifier already exists';
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[API Error]:', err.message);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
