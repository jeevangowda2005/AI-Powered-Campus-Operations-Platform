const app = require('./src/app');
const prisma = require('./src/config/db');

let server;
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}/api`;

const request = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const runAudit = async () => {
  console.log('====================================================');
  console.log('🚀 RUNNING END-TO-END AUDIT SUITE (SPRINTS 1–4)');
  console.log('====================================================');

  let passedTests = 0;
  let failedTests = 0;

  const assert = (condition, description, detail = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${description} ${detail}`);
      failedTests++;
    }
  };

  try {
    // 1. Start Server
    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`  ℹ️ Test server running on port ${PORT}`);
        resolve();
      });
    });

    // 2. Health Endpoint Audit
    console.log('\n--- 1. Health API Audit ---');
    const health = await request('/health');
    assert(health.status === 200 && health.data.success === true, 'GET /api/health returns HTTP 200 & success=true');

    // 3. Database & Department Seed Audit
    console.log('\n--- 2. Database & Department Seed Audit ---');
    const deptRes = await request('/departments', {
      headers: { Authorization: 'Bearer invalid' },
    });
    assert(deptRes.status === 401, 'Unauthenticated /departments returns HTTP 401');

    // 4. Authentication End-to-End Audit
    console.log('\n--- 3. Authentication End-to-End Audit ---');
    const timestamp = Date.now();
    const student1Email = `student.alpha.${timestamp}@campus.edu`;
    const student2Email = `student.beta.${timestamp}@campus.edu`;
    const staffEmail = `staff.ops.${timestamp}@campus.edu`;
    const adminEmail = `admin.master.${timestamp}@campus.edu`;

    // Register Student 1
    const regStudent1 = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Student Alpha', email: student1Email, password: 'Password123!', role: 'STUDENT' },
    });
    assert(regStudent1.status === 201 && regStudent1.data.data.token, 'Register Student 1 returns HTTP 201 & JWT token');
    assert(!regStudent1.data.data.user.passwordHash, 'User response omits passwordHash');

    const student1Token = regStudent1.data.data.token;
    const student1User = regStudent1.data.data.user;

    // Duplicate Email Check
    const dupReg = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Student Dup', email: student1Email, password: 'Password123!', role: 'STUDENT' },
    });
    assert(dupReg.status === 400 && dupReg.data.message.includes('already registered'), 'Duplicate email registration rejected with HTTP 400');

    // Register Student 2
    const regStudent2 = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Student Beta', email: student2Email, password: 'Password123!', role: 'STUDENT' },
    });
    const student2Token = regStudent2.data.data.token;
    const student2User = regStudent2.data.data.user;

    // Register Staff
    const regStaff = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Staff Operations', email: staffEmail, password: 'Password123!', role: 'STAFF' },
    });
    assert(regStaff.status === 201 && regStaff.data.data.user.role === 'STAFF', 'Register Staff returns HTTP 201 with role STAFF');
    const staffToken = regStaff.data.data.token;
    const staffUser = regStaff.data.data.user;

    // Register Admin
    const regAdmin = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Admin Master', email: adminEmail, password: 'Password123!', role: 'ADMIN' },
    });
    assert(regAdmin.status === 201 && regAdmin.data.data.user.role === 'ADMIN', 'Register Admin returns HTTP 201 with role ADMIN');
    const adminToken = regAdmin.data.data.token;

    // Login & Wrong Password Rejection
    const badLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: student1Email, password: 'WrongPassword!' },
    });
    assert(badLogin.status === 401, 'Wrong password login rejected with HTTP 401');

    const goodLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: student1Email, password: 'Password123!' },
    });
    assert(goodLogin.status === 200 && goodLogin.data.data.token, 'Valid login returns HTTP 200 & JWT token');

    // GET /api/auth/me
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(meRes.status === 200 && meRes.data.data.user.email === student1Email, 'GET /api/auth/me returns authenticated user profile');

    // 5. RBAC Security Audit
    console.log('\n--- 4. RBAC Security Audit ---');
    const studentTestRole = await request('/test/student', { headers: { Authorization: `Bearer ${student1Token}` } });
    assert(studentTestRole.status === 200, 'Student can access /api/test/student');

    const studentStaffTestRole = await request('/test/staff', { headers: { Authorization: `Bearer ${student1Token}` } });
    assert(studentStaffTestRole.status === 403, 'Student rejected from /api/test/staff with HTTP 403');

    const studentAdminTestRole = await request('/test/admin', { headers: { Authorization: `Bearer ${student1Token}` } });
    assert(studentAdminTestRole.status === 403, 'Student rejected from /api/test/admin with HTTP 403');

    const staffStaffTestRole = await request('/test/staff', { headers: { Authorization: `Bearer ${staffToken}` } });
    assert(staffStaffTestRole.status === 200, 'Staff can access /api/test/staff');

    const adminAdminTestRole = await request('/test/admin', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(adminAdminTestRole.status === 200, 'Admin can access /api/test/admin');

    // 6. Request Management & Security Scoping Audit
    console.log('\n--- 5. Request Management & Ownership Security Audit ---');
    const req1 = await request('/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
      body: { title: 'Water Leak in Room 101', description: 'Severe water leak near sink in Block A', category: 'PLUMBING', priority: 'HIGH' },
    });
    assert(req1.status === 201 && req1.data.data.request.status === 'OPEN', 'Student 1 creates Plumbing request with OPEN status');
    const req1Id = req1.data.data.request.id;

    const req2 = await request('/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${student2Token}` },
      body: { title: 'Wi-Fi Disconnected in Library', description: 'Cannot access campus network from 2nd floor', category: 'IT', priority: 'MEDIUM' },
    });
    assert(req2.status === 201, 'Student 2 creates IT request');
    const req2Id = req2.data.data.request.id;

    // Student 1 fetches own requests
    const myReqs = await request('/requests/my', {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(myReqs.status === 200 && myReqs.data.data.requests.length >= 1 && myReqs.data.data.requests.every(r => r.studentId === student1User.id), 'GET /api/requests/my returns ONLY Student 1 requests');

    // IDOR Security Check: Student 1 attempts to access Student 2 request
    const idorCheck = await request(`/requests/${req2Id}`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(idorCheck.status === 403, 'IDOR Security: Student 1 viewing Student 2 request rejected with HTTP 403 Forbidden');

    // Student 1 attempts to call Admin request list
    const adminListCheck = await request('/requests', {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(adminListCheck.status === 403, 'Student attempting to access admin request list rejected with HTTP 403');

    // Student 1 attempts to assign request
    const assignForbiddenCheck = await request(`/requests/${req1Id}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${student1Token}` },
      body: { assignedStaffId: staffUser.id },
    });
    assert(assignForbiddenCheck.status === 403, 'Student attempting to assign request rejected with HTTP 403');

    // Admin assigns staffUser to req1Id to authorize staff management
    const adminAssign = await request(`/requests/${req1Id}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { assignedStaffId: staffUser.id },
    });
    assert(adminAssign.status === 200 && adminAssign.data.data.request.assignedStaffId === staffUser.id, 'Admin assigns staff user to request (HTTP 200)');

    // 7. Status Lifecycle Transition Audit
    console.log('\n--- 6. Status Lifecycle Transition Audit ---');
    // Valid lifecycle: ASSIGNED -> IN_PROGRESS
    const validStatus1 = await request(`/requests/${req1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'IN_PROGRESS' },
    });
    assert(validStatus1.status === 200 && validStatus1.data.data.request.status === 'IN_PROGRESS', 'Authorized Staff updates status ASSIGNED -> IN_PROGRESS (HTTP 200)');

    // Valid lifecycle: IN_PROGRESS -> RESOLVED
    const validStatus2 = await request(`/requests/${req1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'RESOLVED' },
    });
    assert(validStatus2.status === 200 && validStatus2.data.data.request.status === 'RESOLVED', 'Authorized Staff updates status IN_PROGRESS -> RESOLVED (HTTP 200)');

    // Invalid transition: RESOLVED -> IN_PROGRESS
    const invalidTransition = await request(`/requests/${req1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'IN_PROGRESS' },
    });
    assert(invalidTransition.status === 400 && invalidTransition.data.message.includes('Invalid status transition'), 'Invalid status transition RESOLVED -> IN_PROGRESS rejected with HTTP 400');

    // 8. Admin Assignment & Pagination Audit
    console.log('\n--- 7. Admin Assignment & Pagination Audit ---');
    const adminPaginated = await request('/requests?page=1&limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminPaginated.status === 200 && adminPaginated.data.data.pagination.totalCount >= 2, 'Admin GET /api/requests returns paginated response and metadata');

    // 9. AI Intelligence Layer & Fallback Audit
    console.log('\n--- 8. AI Intelligence Layer & Fallback Audit ---');
    const aiClassify = await request(`/ai/classify/${req1Id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(aiClassify.status === 200, 'POST /api/ai/classify returns HTTP 200');

    const aiPrio = await request(`/ai/suggest-priority/${req1Id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(aiPrio.status === 200, 'POST /api/ai/suggest-priority returns HTTP 200');

    const aiSimilar = await request(`/ai/similar/${req1Id}`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(aiSimilar.status === 200 && Array.isArray(aiSimilar.data.data.similarRequests), 'GET /api/ai/similar returns HTTP 200 with similar requests array');

    const aiResStaff = await request(`/ai/resolution/${req1Id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(aiResStaff.status === 200 && aiResStaff.data.data.suggestion, 'Authorized Staff POST /api/ai/resolution returns resolution guidance');

    const aiResStudent = await request(`/ai/resolution/${req1Id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(aiResStudent.status === 403, 'Student POST /api/ai/resolution rejected with HTTP 403 Forbidden');

    // Critical AI Safety Check: Verify category !== aiCategory unless naturally identical
    const req1Details = await request(`/requests/${req1Id}`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert(req1Details.data.data.request.category === 'PLUMBING', 'Final category remains PLUMBING as selected by user');

    console.log('\n====================================================');
    console.log(`📊 E2E AUDIT RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Audit execution error:', err);
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    process.exit(failedTests > 0 ? 1 : 0);
  }
};

runAudit();
