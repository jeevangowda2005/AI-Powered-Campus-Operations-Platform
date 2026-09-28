const prisma = require('../config/db');
const { calculateTextSimilarity } = require('../utils/similarity.util');
const aiService = require('./ai.service');
const { enqueueAiJob } = require('../queues/ai.queue');

// Valid Enums
const VALID_CATEGORIES = ['IT', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'SECURITY', 'CLASSROOM', 'HOSTEL', 'TRANSPORT', 'OTHER'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// Defined status transition graph: OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
const ALLOWED_STATUS_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const requestIncludeOptions = {
  student: {
    select: { id: true, name: true, email: true, role: true },
  },
  department: {
    select: { id: true, name: true },
  },
  assignedStaff: {
    select: { id: true, name: true, email: true, role: true },
  },
  similaritiesAsSource: {
    include: {
      similarRequest: {
        select: { id: true, title: true, status: true, category: true },
      },
    },
  },
};

/**
 * Create a new service request (STUDENT ONLY)
 * Non-blocking AI analysis is triggered after database creation
 */
const createRequest = async ({ studentId, title, description, category, priority, departmentId }) => {
  if (!title || typeof title !== 'string' || !title.trim()) {
    const error = new Error('Title is required and must be a non-empty string');
    error.statusCode = 400;
    throw error;
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    const error = new Error('Description is required and must be a non-empty string');
    error.statusCode = 400;
    throw error;
  }

  const categoryUpper = category ? category.toUpperCase() : null;
  if (!categoryUpper || !VALID_CATEGORIES.includes(categoryUpper)) {
    const error = new Error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const priorityUpper = priority ? priority.toUpperCase() : 'MEDIUM';
  if (!VALID_PRIORITIES.includes(priorityUpper)) {
    const error = new Error(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  // Verify optional department if provided
  if (departmentId) {
    const deptExists = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!deptExists) {
      const error = new Error('Specified department does not exist');
      error.statusCode = 404;
      throw error;
    }
  }

  // Create request in database first (aiProcessingStatus defaults to PENDING)
  const newRequest = await prisma.serviceRequest.create({
    data: {
      studentId, // Strictly from authenticated JWT
      title: title.trim(),
      description: description.trim(),
      category: categoryUpper,
      priority: priorityUpper,
      status: 'OPEN',
      departmentId: departmentId || null,
      aiProcessingStatus: 'PENDING',
    },
    include: requestIncludeOptions,
  });

  // Sprint 5: Enqueue background AI processing job via BullMQ.
  // Request creation ALWAYS succeeds — AI queue unavailability never blocks the user.
  const { scheduled, reason } = await enqueueAiJob(newRequest.id);
  if (!scheduled) {
    console.warn(
      `[Request Service] AI job could not be scheduled for request ${newRequest.id}. ${reason}. ` +
      `Request is stored successfully. AI processing status remains PENDING.`
    );
  }

  return {
    request: newRequest,
    aiJobQueued: scheduled,
  };
};

/**
 * Get requests created by the authenticated student
 */
const getStudentRequests = async (studentId, { status, category, priority }) => {
  const where = { studentId };

  if (status && VALID_STATUSES.includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }
  if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
    where.category = category.toUpperCase();
  }
  if (priority && VALID_PRIORITIES.includes(priority.toUpperCase())) {
    where.priority = priority.toUpperCase();
  }

  return prisma.serviceRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: requestIncludeOptions,
  });
};

/**
 * Get relevant requests for Staff member
 */
const getStaffRequests = async (staffUser, { status, category, priority }) => {
  const where = {};

  if (staffUser.role === 'STAFF') {
    where.OR = [
      { assignedStaffId: staffUser.id },
      ...(staffUser.departmentId ? [{ departmentId: staffUser.departmentId }] : []),
    ];
  }

  if (status && VALID_STATUSES.includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }
  if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
    where.category = category.toUpperCase();
  }
  if (priority && VALID_PRIORITIES.includes(priority.toUpperCase())) {
    where.priority = priority.toUpperCase();
  }

  return prisma.serviceRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: requestIncludeOptions,
  });
};

/**
 * Get all requests for ADMIN with pagination and filters
 */
const getAllRequests = async ({ status, category, priority, departmentId, page = 1, limit = 10 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (status && VALID_STATUSES.includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }
  if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
    where.category = category.toUpperCase();
  }
  if (priority && VALID_PRIORITIES.includes(priority.toUpperCase())) {
    where.priority = priority.toUpperCase();
  }
  if (departmentId) {
    where.departmentId = departmentId;
  }

  const [totalCount, requests] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: requestIncludeOptions,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum) || 1;

  return {
    requests,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages,
    },
  };
};

/**
 * Get single request details with ownership/role permission check
 */
const getRequestById = async (id, currentUser) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: requestIncludeOptions,
  });

  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }

  // Permission Check
  if (currentUser.role === 'STUDENT' && request.studentId !== currentUser.id) {
    const error = new Error('Forbidden: You can only view your own service requests');
    error.statusCode = 403;
    throw error;
  }

  if (currentUser.role === 'STAFF') {
    const isAssigned = request.assignedStaffId === currentUser.id;
    const isDeptStaff = currentUser.departmentId && request.departmentId === currentUser.departmentId;
    if (!isAssigned && !isDeptStaff) {
      const error = new Error('Forbidden: You do not have permission to view this request');
      error.statusCode = 403;
      throw error;
    }
  }

  return request;
};

/**
 * Update Request Status with lifecycle transition validation
 */
const updateRequestStatus = async (id, { status }, currentUser) => {
  if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
    const error = new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const newStatus = status.toUpperCase();

  const request = await getRequestById(id, currentUser);

  const allowedNext = ALLOWED_STATUS_TRANSITIONS[request.status] || [];
  if (request.status !== newStatus && !allowedNext.includes(newStatus)) {
    const error = new Error(`Invalid status transition from ${request.status} to ${newStatus}. Allowed transitions: [${allowedNext.join(', ')}]`);
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { status: newStatus },
    include: requestIncludeOptions,
  });

  return updated;
};

/**
 * Assign Request to Staff or Department
 */
const assignRequest = async (id, { assignedStaffId, departmentId }, currentUser) => {
  const request = await getRequestById(id, currentUser);

  if (currentUser.role === 'STAFF') {
    if (departmentId && departmentId !== currentUser.departmentId) {
      const error = new Error('Forbidden: Staff members cannot reassign requests to unrelated departments');
      error.statusCode = 403;
      throw error;
    }

    if (assignedStaffId && assignedStaffId !== currentUser.id) {
      const targetStaff = await prisma.user.findUnique({ where: { id: assignedStaffId } });
      if (!targetStaff || targetStaff.departmentId !== currentUser.departmentId) {
        const error = new Error('Forbidden: Staff members cannot assign requests to staff outside their department');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  if (assignedStaffId) {
    const staffUser = await prisma.user.findUnique({ where: { id: assignedStaffId } });
    if (!staffUser || !['STAFF', 'ADMIN'].includes(staffUser.role)) {
      const error = new Error('Invalid assigned staff user');
      error.statusCode = 400;
      throw error;
    }
  }

  if (departmentId) {
    const deptExists = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!deptExists) {
      const error = new Error('Specified department does not exist');
      error.statusCode = 404;
      throw error;
    }
  }

  let nextStatus = request.status;
  if (request.status === 'OPEN' && (assignedStaffId || departmentId)) {
    nextStatus = 'ASSIGNED';
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      ...(assignedStaffId !== undefined && { assignedStaffId }),
      ...(departmentId !== undefined && { departmentId }),
      status: nextStatus,
    },
    include: requestIncludeOptions,
  });

  return updated;
};

module.exports = {
  createRequest,
  getStudentRequests,
  getStaffRequests,
  getAllRequests,
  getRequestById,
  updateRequestStatus,
  assignRequest,
};
