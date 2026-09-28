'use strict';

const getEmitters = () => require('./socket.server');

/**
 * Sanitize request payload for Socket.IO delivery
 * Removes passwords, hashes, tokens, or unnecessary sensitive data
 */
const sanitizeRequestPayload = (request) => {
  if (!request) return null;

  const copy = { ...request };

  if (copy.student) {
    const { passwordHash, ...safeStudent } = copy.student;
    copy.student = safeStudent;
  }

  if (copy.assignedStaff) {
    const { passwordHash, ...safeStaff } = copy.assignedStaff;
    copy.assignedStaff = safeStaff;
  }

  return copy;
};

/**
 * Handle new request creation real-time event
 */
const handleRequestCreated = (request) => {
  try {
    const { emitToUser, emitToDepartment, emitToAdmins } = getEmitters();
    const safeData = sanitizeRequestPayload(request);
    if (!safeData) return;

    const payload = {
      requestId: safeData.id,
      event: 'request.created',
      data: safeData,
    };

    // Notify Student
    emitToUser(safeData.studentId, 'request.created', payload);

    // Notify Department Staff if department assigned
    if (safeData.departmentId) {
      emitToDepartment(safeData.departmentId, 'request.created', payload);
    }

    // Notify Admins
    emitToAdmins('request.created', payload);
  } catch (err) {
    console.warn('[Socket Handlers] Error in handleRequestCreated:', err.message);
  }
};

/**
 * Handle request status update real-time event
 */
const handleRequestStatusUpdated = (request) => {
  try {
    const { emitToUser, emitToDepartment, emitToAdmins } = getEmitters();
    const safeData = sanitizeRequestPayload(request);
    if (!safeData) return;

    const payload = {
      requestId: safeData.id,
      event: 'request.status.updated',
      data: safeData,
    };

    // Notify Student
    emitToUser(safeData.studentId, 'request.status.updated', payload);

    // Notify Assigned Staff
    if (safeData.assignedStaffId) {
      emitToUser(safeData.assignedStaffId, 'request.status.updated', payload);
    }

    // Notify Department Staff
    if (safeData.departmentId) {
      emitToDepartment(safeData.departmentId, 'request.status.updated', payload);
    }

    // Notify Admins
    emitToAdmins('request.status.updated', payload);
  } catch (err) {
    console.warn('[Socket Handlers] Error in handleRequestStatusUpdated:', err.message);
  }
};

/**
 * Handle request assignment/reassignment real-time event
 */
const handleRequestAssigned = (request) => {
  try {
    const { emitToUser, emitToDepartment, emitToAdmins } = getEmitters();
    const safeData = sanitizeRequestPayload(request);
    if (!safeData) return;

    const payload = {
      requestId: safeData.id,
      event: 'request.assigned',
      data: safeData,
    };

    // Notify Student
    emitToUser(safeData.studentId, 'request.assigned', payload);

    // Notify Assigned Staff
    if (safeData.assignedStaffId) {
      emitToUser(safeData.assignedStaffId, 'request.assigned', payload);
    }

    // Notify Department Staff
    if (safeData.departmentId) {
      emitToDepartment(safeData.departmentId, 'request.assigned', payload);
    }

    // Notify Admins
    emitToAdmins('request.assigned', payload);
  } catch (err) {
    console.warn('[Socket Handlers] Error in handleRequestAssigned:', err.message);
  }
};

/**
 * Handle AI processing status update real-time event
 */
const handleAiStatusUpdated = (data) => {
  try {
    const { emitToUser, emitToDepartment, emitToAdmins } = getEmitters();
    const { requestId, studentId, departmentId, assignedStaffId, aiProcessingStatus, aiCategory, aiPriority, aiPriorityReason, aiProcessedAt } = data;
    if (!requestId) return;

    const payload = {
      requestId,
      event: 'request.ai.updated',
      data: {
        requestId,
        aiProcessingStatus,
        aiCategory: aiCategory || null,
        aiPriority: aiPriority || null,
        aiPriorityReason: aiPriorityReason || null,
        aiProcessedAt: aiProcessedAt || null,
      },
    };

    if (studentId) emitToUser(studentId, 'request.ai.updated', payload);
    if (assignedStaffId) emitToUser(assignedStaffId, 'request.ai.updated', payload);
    if (departmentId) emitToDepartment(departmentId, 'request.ai.updated', payload);
    emitToAdmins('request.ai.updated', payload);
  } catch (err) {
    console.warn('[Socket Handlers] Error in handleAiStatusUpdated:', err.message);
  }
};

module.exports = {
  handleRequestCreated,
  handleRequestStatusUpdated,
  handleRequestAssigned,
  handleAiStatusUpdated,
};
