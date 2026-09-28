const { io } = require('socket.io-client');

const API_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

// Helper for colored console logs
const log = {
  section: (msg) => console.log(`\n\x1b[36m=== ${msg} ===\x1b[0m`),
  pass: (msg) => console.log(`\x1b[32m✔ PASS: ${msg}\x1b[0m`),
  fail: (msg) => console.log(`\x1b[31m✖ FAIL: ${msg}\x1b[0m`),
};

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    log.pass(message);
    passCount++;
  } else {
    log.fail(message);
    failCount++;
  }
}

const request = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

async function runSprint7Tests() {
  console.log('\n======================================================');
  console.log('  STARTING SPRINT 7: DASHBOARDS & ANALYTICS AUDIT TEST');
  console.log('======================================================\n');

  try {
    const timestamp = Date.now();
    const studentEmail = `student.sprint7.${timestamp}@campus.edu`;
    const staff1Email = `staff1.sprint7.${timestamp}@campus.edu`;
    const staff2Email = `staff2.sprint7.${timestamp}@campus.edu`;
    const adminEmail = `admin.sprint7.${timestamp}@campus.edu`;

    log.section('1. Setup Users & Departments');

    // 1. Register Student
    const studentReg = await request('POST', '/auth/register', {
      name: 'Sprint7 Student',
      email: studentEmail,
      password: 'password123',
      role: 'STUDENT',
    });
    assert(studentReg.status === 201, 'Student registered successfully');
    const studentToken = studentReg.data.data.token;
    const studentUser = studentReg.data.data.user;

    // 2. Get Departments with authenticated student token
    const deptRes = await request('GET', '/departments', null, studentToken);
    const departments = deptRes.data?.data?.departments;
    assert(departments && departments.length >= 2, 'At least 2 departments exist in database');
    const dept1 = departments[0];
    const dept2 = departments[1];

    // 3. Register Staff 1 & Staff 2
    const staff1Reg = await request('POST', '/auth/register', {
      name: 'Sprint7 Staff 1',
      email: staff1Email,
      password: 'password123',
      role: 'STAFF',
    });
    assert(staff1Reg.status === 201, 'Staff 1 registered successfully');
    const staff1Token = staff1Reg.data.data.token;

    const staff2Reg = await request('POST', '/auth/register', {
      name: 'Sprint7 Staff 2',
      email: staff2Email,
      password: 'password123',
      role: 'STAFF',
    });
    assert(staff2Reg.status === 201, 'Staff 2 registered successfully');

    // 4. Register Admin
    const adminReg = await request('POST', '/auth/register', {
      name: 'Sprint7 Admin',
      email: adminEmail,
      password: 'password123',
      role: 'ADMIN',
    });
    assert(adminReg.status === 201, 'Admin registered successfully');
    const adminToken = adminReg.data.data.token;

    // Create Service Requests for testing
    log.section('2. Create Service Requests for Analytics');
    const req1 = await request('POST', '/requests', {
      title: 'Broken Laptop in IT Lab',
      description: 'Screen is cracked and will not turn on.',
      category: 'IT',
      priority: 'HIGH',
      departmentId: dept1.id,
    }, studentToken);
    assert(req1.status === 201, 'Student created Service Request 1 (Dept 1)');

    const req2 = await request('POST', '/requests', {
      title: 'Leaking Pipe in Hostel B',
      description: 'Water leaking under the bathroom sink.',
      category: 'PLUMBING',
      priority: 'MEDIUM',
      departmentId: dept2.id,
    }, studentToken);
    assert(req2.status === 201, 'Student created Service Request 2 (Dept 2)');

    // ------------------------------------------------------------------------
    log.section('3. Student Analytics Scoping & Verification');
    const studentAnalytics = await request('GET', '/analytics/student', null, studentToken);

    assert(studentAnalytics.status === 200, 'GET /api/analytics/student returned 200 OK');
    assert(studentAnalytics.data.data.summary.total >= 2, 'Student analytics total count includes created requests');
    assert(studentAnalytics.data.data.priority.high >= 1, 'Student analytics includes priority breakdown');
    assert(Array.isArray(studentAnalytics.data.data.recentRequests), 'Student analytics returns recentRequests array');

    // Security check for Student: cannot access Staff or Admin analytics
    const staffAccessByStudent = await request('GET', '/analytics/staff', null, studentToken);
    assert(staffAccessByStudent.status === 403, 'Student access to /api/analytics/staff returns 403 Forbidden');

    const adminAccessByStudent = await request('GET', '/analytics/admin', null, studentToken);
    assert(adminAccessByStudent.status === 403, 'Student access to /api/analytics/admin returns 403 Forbidden');

    // ------------------------------------------------------------------------
    log.section('4. Staff Analytics & Strict Department Isolation (CHANGE 1)');
    const staff1Analytics = await request('GET', '/analytics/staff', null, staff1Token);

    assert(staff1Analytics.status === 200, 'GET /api/analytics/staff returned 200 OK for Staff');
    assert(staff1Analytics.data.data.summary !== undefined, 'Staff analytics includes operational summary');

    // Verify CHANGE 1: Query param departmentId attempt by staff is ignored
    const staffTampered = await request('GET', '/analytics/staff?departmentId=fake-dept-id', null, staff1Token);
    assert(staffTampered.status === 200, 'Staff request with tampered departmentId succeeds without error');
    assert(
      staffTampered.data.data.summary.total === staff1Analytics.data.data.summary.total,
      'Staff analytics ignored frontend departmentId query parameter and derived strictly from DB identity'
    );

    // Security check for Staff: cannot access Admin analytics
    const adminAccessByStaff = await request('GET', '/analytics/admin', null, staff1Token);
    assert(adminAccessByStaff.status === 403, 'Staff access to /api/analytics/admin returns 403 Forbidden');

    // ------------------------------------------------------------------------
    log.section('5. Admin System-Wide Analytics & Filter Verification');
    const adminAnalytics = await request('GET', '/analytics/admin', null, adminToken);

    assert(adminAnalytics.status === 200, 'GET /api/analytics/admin returned 200 OK for Admin');
    assert(adminAnalytics.data.data.summary.total >= 2, 'Admin summary metrics reflect total system requests');
    assert(adminAnalytics.data.data.statusDistribution !== undefined, 'Admin analytics includes status distribution');
    assert(adminAnalytics.data.data.categoryDistribution !== undefined, 'Admin analytics includes category distribution');
    assert(adminAnalytics.data.data.aiSummary !== undefined, 'Admin analytics includes AI processing summary (PENDING, PROCESSING, COMPLETED, FAILED)');
    assert(Array.isArray(adminAnalytics.data.data.departmentWorkload), 'Admin analytics includes department workload');
    assert(Array.isArray(adminAnalytics.data.data.requestTrend), 'Admin analytics includes time-series request trend');

    // Date Filters
    const dateToday = await request('GET', '/analytics/admin?dateRange=today', null, adminToken);
    assert(dateToday.status === 200, 'Admin analytics filter dateRange=today works');

    const dateMonth = await request('GET', '/analytics/admin?dateRange=thismonth', null, adminToken);
    assert(dateMonth.status === 200, 'Admin analytics filter dateRange=thismonth works');

    // Category / Department / Priority Filters
    const catFiltered = await request('GET', '/analytics/admin?category=IT', null, adminToken);
    assert(catFiltered.status === 200, 'Admin analytics filter category=IT works');

    // ------------------------------------------------------------------------
    log.section('6. Validated Admin Pagination Verification (CHANGE 2)');
    const paginatedRes = await request('GET', '/analytics/admin?page=1&limit=5', null, adminToken);
    assert(paginatedRes.status === 200, 'Valid pagination page=1&limit=5 returns HTTP 200');
    assert(paginatedRes.data.data.pagination.page === 1, 'Pagination metadata reflects page=1');
    assert(paginatedRes.data.data.pagination.limit === 5, 'Pagination metadata reflects limit=5');
    assert(typeof paginatedRes.data.data.pagination.totalPages === 'number', 'Pagination metadata includes totalPages');

    // Invalid Pagination Checks
    const invalidPage = await request('GET', '/analytics/admin?page=0&limit=10', null, adminToken);
    assert(invalidPage.status === 400, 'Invalid page=0 returns HTTP 400 Bad Request');

    const invalidLimit = await request('GET', '/analytics/admin?page=1&limit=200', null, adminToken);
    assert(invalidLimit.status === 400, 'Invalid limit > 100 returns HTTP 400 Bad Request');

    // ------------------------------------------------------------------------
    log.section('7. Real-Time Socket.IO Integration Verification (CHANGE 3)');
    const socketStudent = io(SOCKET_URL, {
      auth: { token: studentToken },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    await new Promise((res) => socketStudent.on('connect', res));

    let socketReceived = false;
    socketStudent.on('request.created', (evt) => {
      socketReceived = true;
    });

    // Create new request to trigger socket event
    const liveReq = await request('POST', '/requests', {
      title: 'Live Realtime Socket Test Ticket',
      description: 'Testing real-time update delivery to dashboard listener.',
      category: 'ELECTRICAL',
      priority: 'CRITICAL',
    }, studentToken);
    assert(liveReq.status === 201, 'Created live request for real-time socket verification');

    // Wait for event
    for (let i = 0; i < 10; i++) {
      if (socketReceived) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    assert(socketReceived === true, 'Socket.IO client received request.created event in real time');

    socketStudent.disconnect();

    // ------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`  SPRINT 7 AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\x1b[31mUnexpected error during Sprint 7 test execution:\x1b[0m', err.message);
    process.exit(1);
  }
}

runSprint7Tests();
