/**
 * 404 Route Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  return res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = notFoundHandler;
