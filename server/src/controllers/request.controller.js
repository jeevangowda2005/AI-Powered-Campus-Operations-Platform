const requestService = require('../services/request.service');
const {
  handleRequestCreated,
  handleRequestStatusUpdated,
  handleRequestAssigned,
} = require('../socket/socket.handlers');

/**
 * Create Service Request (STUDENT ONLY)
 * POST /api/requests
 */
const create = async (req, res, next) => {
  try {
    const studentId = req.user.id; // Strictly taken from authenticated JWT
    const { request, aiJobQueued } = await requestService.createRequest({
      studentId,
      ...req.body,
    });

    // Emit real-time notification
    try {
      handleRequestCreated(request);
    } catch (e) {
      console.warn('[Request Controller] Socket notification error (non-fatal):', e.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      aiJobQueued,
      data: {
        request,
        aiJobQueued,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get My Requests (STUDENT ONLY)
 * GET /api/requests/my
 */
const getMyRequests = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const requests = await requestService.getStudentRequests(studentId, req.query);

    return res.status(200).json({
      success: true,
      data: { requests },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Staff Requests (STAFF & ADMIN)
 * GET /api/requests/staff
 */
const getStaffRequests = async (req, res, next) => {
  try {
    const requests = await requestService.getStaffRequests(req.user, req.query);

    return res.status(200).json({
      success: true,
      data: { requests },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Requests with Pagination (ADMIN ONLY)
 * GET /api/requests
 */
const getAllRequests = async (req, res, next) => {
  try {
    const result = await requestService.getAllRequests(req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Request Details (STUDENT, STAFF, ADMIN - permissions enforced in service)
 * GET /api/requests/:id
 */
const getRequestById = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.id, req.user);

    return res.status(200).json({
      success: true,
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Request Status (STAFF & ADMIN)
 * PATCH /api/requests/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const request = await requestService.updateRequestStatus(req.params.id, req.body, req.user);

    // Emit real-time notification
    try {
      handleRequestStatusUpdated(request);
    } catch (e) {
      console.warn('[Request Controller] Socket notification error (non-fatal):', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Request status updated successfully',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign Request (STAFF & ADMIN)
 * PATCH /api/requests/:id/assign
 */
const assign = async (req, res, next) => {
  try {
    const request = await requestService.assignRequest(req.params.id, req.body, req.user);

    // Emit real-time notification
    try {
      handleRequestAssigned(request);
    } catch (e) {
      console.warn('[Request Controller] Socket notification error (non-fatal):', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Request assigned successfully',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getMyRequests,
  getStaffRequests,
  getAllRequests,
  getRequestById,
  updateStatus,
  assign,
};
