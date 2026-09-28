const authService = require('../services/auth.service');

/**
 * Register Controller
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login Controller
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current User Controller
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
};
