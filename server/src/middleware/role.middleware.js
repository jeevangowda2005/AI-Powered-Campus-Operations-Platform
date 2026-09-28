/**
 * Role-Based Authorization Middleware
 * Enforces allowed roles for protected endpoints
 * @param {...string} allowedRoles - List of allowed roles (e.g., 'STUDENT', 'STAFF', 'ADMIN')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const hasRole = allowedRoles.includes(req.user.role.toUpperCase());
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] roles`,
      });
    }

    next();
  };
};

module.exports = authorize;
