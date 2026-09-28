const analyticsService = require('../services/analytics.service');

/**
 * Get Student Analytics (STUDENT ONLY)
 * GET /api/analytics/student
 */
const getStudentAnalytics = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const data = await analyticsService.getStudentAnalytics(studentId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Staff Analytics (STAFF & ADMIN)
 * GET /api/analytics/staff
 */
const getStaffAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getStaffAnalytics(req.user);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Admin Analytics (ADMIN ONLY)
 * GET /api/analytics/admin
 */
const getAdminAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminAnalytics(req.query);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentAnalytics,
  getStaffAnalytics,
  getAdminAnalytics,
};
