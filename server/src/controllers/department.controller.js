const departmentService = require('../services/department.service');

/**
 * Get all departments
 * GET /api/departments
 */
const getDepartments = async (req, res, next) => {
  try {
    const departments = await departmentService.getAllDepartments();
    return res.status(200).json({
      success: true,
      data: { departments },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
};
