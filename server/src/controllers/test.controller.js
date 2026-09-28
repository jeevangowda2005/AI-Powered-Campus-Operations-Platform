/**
 * Role Test Controller
 * Provides protected endpoints to test RBAC roles
 */

const getStudentResource = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Access granted: Student role verified',
    data: { role: req.user.role, userId: req.user.id },
  });
};

const getStaffResource = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Access granted: Staff role verified',
    data: { role: req.user.role, userId: req.user.id },
  });
};

const getAdminResource = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Access granted: Admin role verified',
    data: { role: req.user.role, userId: req.user.id },
  });
};

module.exports = {
  getStudentResource,
  getStaffResource,
  getAdminResource,
};
