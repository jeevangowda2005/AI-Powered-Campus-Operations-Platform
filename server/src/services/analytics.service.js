const prisma = require('../config/db');

const VALID_CATEGORIES = ['IT', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'SECURITY', 'CLASSROOM', 'HOSTEL', 'TRANSPORT', 'OTHER'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const VALID_AI_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];

const requestIncludeOptions = {
  student: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
  assignedStaff: { select: { id: true, name: true, email: true } },
};

/**
 * Get Student Analytics
 * Strictly scoped to authenticated studentId
 */
const getStudentAnalytics = async (studentId) => {
  if (!studentId) {
    const error = new Error('Student ID is required');
    error.statusCode = 400;
    throw error;
  }

  const baseWhere = { studentId };

  const [
    total,
    open,
    assigned,
    inProgress,
    resolved,
    closed,
    lowPrio,
    medPrio,
    highPrio,
    critPrio,
    recentRequests,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where: baseWhere }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'OPEN' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'ASSIGNED' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'CLOSED' } }),

    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'LOW' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'MEDIUM' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'HIGH' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'CRITICAL' } }),

    prisma.serviceRequest.findMany({
      where: baseWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: requestIncludeOptions,
    }),
  ]);

  return {
    summary: {
      total,
      open,
      assigned,
      inProgress,
      resolved,
      closed,
    },
    priority: {
      low: lowPrio,
      medium: medPrio,
      high: highPrio,
      critical: critPrio,
    },
    recentRequests,
  };
};

/**
 * Get Staff Analytics
 * Derives staff department strictly from DB user record
 */
const getStaffAnalytics = async (staffUser) => {
  if (!staffUser || !staffUser.id) {
    const error = new Error('Staff user ID is required');
    error.statusCode = 400;
    throw error;
  }

  // Always query fresh user record from DB to get authorized departmentId
  const dbUser = await prisma.user.findUnique({
    where: { id: staffUser.id },
    select: { id: true, role: true, departmentId: true, department: { select: { id: true, name: true } } },
  });

  if (!dbUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  let baseWhere = {};
  if (dbUser.role === 'STAFF') {
    baseWhere = {
      OR: [
        { assignedStaffId: dbUser.id },
        ...(dbUser.departmentId ? [{ departmentId: dbUser.departmentId }] : []),
      ],
    };
  }

  const [
    total,
    open,
    assigned,
    inProgress,
    resolved,
    closed,
    highCritical,
    lowPrio,
    medPrio,
    highPrio,
    critPrio,
    categoryGroup,
    activeRequests,
    recentActivity,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where: baseWhere }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'OPEN' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'ASSIGNED' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, status: 'CLOSED' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: { in: ['HIGH', 'CRITICAL'] } } }),

    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'LOW' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'MEDIUM' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'HIGH' } }),
    prisma.serviceRequest.count({ where: { ...baseWhere, priority: 'CRITICAL' } }),

    prisma.serviceRequest.groupBy({
      by: ['category'],
      where: baseWhere,
      _count: { _all: true },
    }),

    prisma.serviceRequest.findMany({
      where: {
        ...baseWhere,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: requestIncludeOptions,
    }),

    prisma.serviceRequest.findMany({
      where: baseWhere,
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: requestIncludeOptions,
    }),
  ]);

  const categoryBreakdown = {};
  VALID_CATEGORIES.forEach((cat) => {
    categoryBreakdown[cat] = 0;
  });
  categoryGroup.forEach((g) => {
    categoryBreakdown[g.category] = g._count._all;
  });

  return {
    department: dbUser.department || null,
    summary: {
      total,
      open,
      assigned,
      inProgress,
      resolved,
      closed,
      highCritical,
    },
    priority: {
      low: lowPrio,
      medium: medPrio,
      high: highPrio,
      critical: critPrio,
    },
    category: categoryBreakdown,
    activeRequests,
    recentActivity,
  };
};

/**
 * Helper to build Date Filter from query string
 */
const buildDateFilter = (dateRange, startDateRaw, endDateRaw) => {
  if (!dateRange) return undefined;

  const now = new Date();

  switch (dateRange.toLowerCase()) {
    case 'today': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return { gte: start, lte: end };
    }
    case 'last7days': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { gte: start };
    }
    case 'last30days': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { gte: start };
    }
    case 'thismonth': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      return { gte: start };
    }
    case 'custom': {
      if (!startDateRaw || !endDateRaw) {
        const error = new Error('startDate and endDate are required for custom date range');
        error.statusCode = 400;
        throw error;
      }
      const start = new Date(startDateRaw);
      const end = new Date(endDateRaw);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        const error = new Error('Invalid startDate or endDate format');
        error.statusCode = 400;
        throw error;
      }
      return { gte: start, lte: end };
    }
    default: {
      const error = new Error(`Invalid dateRange parameter '${dateRange}'. Must be one of: today, last7days, last30days, thismonth, custom`);
      error.statusCode = 400;
      throw error;
    }
  }
};

/**
 * Get Admin System-Wide Analytics
 * Supports filtering, validated pagination, date ranges, and aggregations
 */
const getAdminAnalytics = async (query = {}) => {
  const {
    page: pageRaw = 1,
    limit: limitRaw = 10,
    dateRange,
    startDate,
    endDate,
    departmentId,
    category,
    status,
    priority,
  } = query;

  // Validate pagination parameters strictly (CHANGE 2)
  const page = Number(pageRaw);
  const limit = Number(limitRaw);

  if (!Number.isInteger(page) || page < 1) {
    const error = new Error('Invalid pagination parameter: page must be a positive integer >= 1');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error = new Error('Invalid pagination parameter: limit must be an integer between 1 and 100');
    error.statusCode = 400;
    throw error;
  }

  const skip = (page - 1) * limit;

  // Build filter object
  const where = {};

  // Date Filter
  if (dateRange) {
    where.createdAt = buildDateFilter(dateRange, startDate, endDate);
  }

  // Department Filter
  if (departmentId) {
    where.departmentId = departmentId;
  }

  // Category Filter
  if (category) {
    const catUpper = category.toUpperCase();
    if (!VALID_CATEGORIES.includes(catUpper)) {
      const error = new Error(`Invalid category filter '${category}'`);
      error.statusCode = 400;
      throw error;
    }
    where.category = catUpper;
  }

  // Status Filter
  if (status) {
    const statusUpper = status.toUpperCase();
    if (!VALID_STATUSES.includes(statusUpper)) {
      const error = new Error(`Invalid status filter '${status}'`);
      error.statusCode = 400;
      throw error;
    }
    where.status = statusUpper;
  }

  // Priority Filter
  if (priority) {
    const prioUpper = priority.toUpperCase();
    if (!VALID_PRIORITIES.includes(prioUpper)) {
      const error = new Error(`Invalid priority filter '${priority}'`);
      error.statusCode = 400;
      throw error;
    }
    where.priority = prioUpper;
  }

  // Execute database aggregations concurrently
  const [
    totalCount,
    openCount,
    assignedCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    highCriticalCount,
    statusGroup,
    categoryGroup,
    aiStatusGroup,
    allDepartments,
    deptGroup,
    requestsList,
    allRequestsForTrend,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.count({ where: { ...where, status: 'OPEN' } }),
    prisma.serviceRequest.count({ where: { ...where, status: 'ASSIGNED' } }),
    prisma.serviceRequest.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.serviceRequest.count({ where: { ...where, status: 'RESOLVED' } }),
    prisma.serviceRequest.count({ where: { ...where, status: 'CLOSED' } }),
    prisma.serviceRequest.count({ where: { ...where, priority: { in: ['HIGH', 'CRITICAL'] } } }),

    prisma.serviceRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),

    prisma.serviceRequest.groupBy({
      by: ['category'],
      where,
      _count: { _all: true },
    }),

    prisma.serviceRequest.groupBy({
      by: ['aiProcessingStatus'],
      where,
      _count: { _all: true },
    }),

    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),

    prisma.serviceRequest.groupBy({
      by: ['departmentId', 'status', 'priority'],
      where,
      _count: { _all: true },
    }),

    prisma.serviceRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: requestIncludeOptions,
    }),

    prisma.serviceRequest.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Format Status Distribution
  const statusDistribution = {};
  VALID_STATUSES.forEach((st) => { statusDistribution[st] = 0; });
  statusGroup.forEach((g) => { statusDistribution[g.status] = g._count._all; });

  // Format Category Distribution
  const categoryDistribution = {};
  VALID_CATEGORIES.forEach((cat) => { categoryDistribution[cat] = 0; });
  categoryGroup.forEach((g) => { categoryDistribution[g.category] = g._count._all; });

  // Format AI Processing Summary
  const aiSummary = {};
  VALID_AI_STATUSES.forEach((st) => { aiSummary[st] = 0; });
  aiStatusGroup.forEach((g) => { aiSummary[g.aiProcessingStatus] = g._count._all; });

  // Format Department Workload
  const deptWorkloadMap = {};
  allDepartments.forEach((d) => {
    deptWorkloadMap[d.id] = {
      id: d.id,
      name: d.name,
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      highCritical: 0,
    };
  });
  deptWorkloadMap['unassigned'] = {
    id: null,
    name: 'Unassigned',
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    highCritical: 0,
  };

  deptGroup.forEach((g) => {
    const key = g.departmentId || 'unassigned';
    if (!deptWorkloadMap[key]) {
      deptWorkloadMap[key] = {
        id: g.departmentId,
        name: 'Unknown Dept',
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        highCritical: 0,
      };
    }
    const count = g._count._all;
    deptWorkloadMap[key].total += count;
    if (g.status === 'OPEN') deptWorkloadMap[key].open += count;
    if (g.status === 'IN_PROGRESS' || g.status === 'ASSIGNED') deptWorkloadMap[key].inProgress += count;
    if (g.status === 'RESOLVED' || g.status === 'CLOSED') deptWorkloadMap[key].resolved += count;
    if (g.priority === 'HIGH' || g.priority === 'CRITICAL') deptWorkloadMap[key].highCritical += count;
  });

  const departmentWorkload = Object.values(deptWorkloadMap).filter((d) => d.total > 0 || d.id !== null);

  // Time-series trend (Daily counts)
  const trendMap = {};
  allRequestsForTrend.forEach((r) => {
    const dateStr = new Date(r.createdAt).toISOString().split('T')[0];
    trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
  });

  const requestTrend = Object.keys(trendMap).sort().map((date) => ({
    date,
    count: trendMap[date],
  }));

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    summary: {
      total: totalCount,
      open: openCount,
      assigned: assignedCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      closed: closedCount,
      highCritical: highCriticalCount,
    },
    statusDistribution,
    categoryDistribution,
    aiSummary,
    departmentWorkload,
    requestTrend,
    recentRequests: requestsList,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
    },
  };
};

module.exports = {
  getStudentAnalytics,
  getStaffAnalytics,
  getAdminAnalytics,
};
