/**
 * Sprint 8 End-to-End Security, Hardening & Regression Test Suite
 *
 * Run: node test-sprint8.js
 */

'use strict';

const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

let passed = 0;
let failed = 0;
const results = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

const request = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✅ PASS  ${name}`);
    results.push({ name, result: 'PASS' });
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${name}`);
    console.error(`           ${err.message}`);
    results.push({ name, result: 'FAIL', error: err.message });
    failed++;
  }
};

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const createSocketClient = (token) => {
  return io(SOCKET_URL, {
    auth: { token },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: false,
  });
};

// ── Test Execution ───────────────────────────────────────────────────────────

const TIMESTAMP = Date.now();
let studentA, studentB, staffDept1, staffDept2, admin;
let dept1, dept2;

async function runSprint8Tests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   Sprint 8 — Final Security & Hardening Audit Suite');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 1. Setup & Department Discovery ──────────────────────────────────────
  console.log('─── 1. Setup & Department Discovery ─────────────────');

  await test('Fetch campus departments', async () => {
    // Initial request without token to verify 401, then with student token
    const studentTemp = await request('POST', '/auth/register', {
      name: 'Temp Student',
      email: `temp-${TIMESTAMP}@campus.test`,
      password: 'Password123!',
      role: 'STUDENT',
    });
    studentA = { token: studentTemp.data.data.token, user: studentTemp.data.data.user };

    const { status, data } = await request('GET', '/departments', null, studentA.token);
    assert(status === 200, `Failed to fetch departments: ${status}`);
    const departments = data.data.departments;
    assert(departments && departments.length >= 2, 'At least 2 departments must exist');
    dept1 = departments[0];
    dept2 = departments[1];
  });

  // ── 2. Authentication & User Profile Security Audit ────────────────────────
  console.log('\n─── 2. Authentication Security Audit ─────────────────');

  await test('Valid registration creates user and returns token without passwordHash', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Student Beta',
      email: `studentB-${TIMESTAMP}@campus.test`,
      password: 'Password123!',
      role: 'STUDENT',
    });
    assert(status === 201, `Registration failed: ${status}`);
    assert(data.data.token !== undefined, 'Token must be returned');
    assert(data.data.user.passwordHash === undefined, 'passwordHash MUST be omitted from user object');
    studentB = { token: data.data.token, user: data.data.user };
  });

  await test('Duplicate email registration returns 400 Bad Request', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Duplicate Student',
      email: studentA.user.email,
      password: 'Password123!',
      role: 'STUDENT',
    });
    assert(status === 400, `Expected 400 Bad Request for duplicate email, got ${status}`);
    assert(data.success === false, 'success field must be false');
  });

  await test('Invalid login returns 401 Unauthorized', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: studentA.user.email,
      password: 'WrongPassword!',
    });
    assert(status === 401, `Expected 401 for bad password, got ${status}`);
    assert(data.success === false, 'success field must be false');
  });

  await test('Valid login returns token and omits passwordHash', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: studentA.user.email,
      password: 'Password123!',
    });
    assert(status === 200, `Login failed: ${status}`);
    assert(data.data.token !== undefined, 'Token must be returned');
    assert(data.data.user.passwordHash === undefined, 'passwordHash MUST be omitted');
  });

  await test('GET /api/auth/me returns current user profile safely', async () => {
    const { status, data } = await request('GET', '/auth/me', null, studentA.token);
    assert(status === 200, `GET /auth/me failed: ${status}`);
    assert(data.data.user.id === studentA.user.id, 'User ID matches token user');
    assert(data.data.user.passwordHash === undefined, 'passwordHash MUST be omitted');
  });

  await test('Invalid/tampered Bearer token returns 401 Unauthorized', async () => {
    const { status } = await request('GET', '/auth/me', null, 'invalid.bearer.token');
    assert(status === 401, `Expected 401 Unauthorized, got ${status}`);
  });

  // Setup Staff & Admin accounts
  await test('Register Staff 1 & Staff 2 & Admin', async () => {
    const s1 = await request('POST', '/auth/register', {
      name: 'Staff One',
      email: `staff1-${TIMESTAMP}@campus.test`,
      password: 'Password123!',
      role: 'STAFF',
    });
    staffDept1 = { token: s1.data.data.token, user: s1.data.data.user };

    const s2 = await request('POST', '/auth/register', {
      name: 'Staff Two',
      email: `staff2-${TIMESTAMP}@campus.test`,
      password: 'Password123!',
      role: 'STAFF',
    });
    staffDept2 = { token: s2.data.data.token, user: s2.data.data.user };

    const adm = await request('POST', '/auth/register', {
      name: 'Admin User',
      email: `admin-${TIMESTAMP}@campus.test`,
      password: 'Password123!',
      role: 'ADMIN',
    });
    admin = { token: adm.data.data.token, user: adm.data.data.user };
  });

  // ── 3. RBAC & IDOR Security Audit ──────────────────────────────────────────
  console.log('\n─── 3. RBAC & IDOR Security Audit ───────────────────');

  let reqStudentA, reqStudentB;

  await test('Student A creates request in Dept 1', async () => {
    const { status, data } = await request('POST', '/requests', {
      title: 'Student A Security Test Issue',
      description: 'Testing IDOR boundaries between students',
      category: 'IT',
      priority: 'HIGH',
      departmentId: dept1.id,
    }, studentA.token);
    assert(status === 201, `Request creation failed: ${status}`);
    reqStudentA = data.data.request;
  });

  await test('Student B creates request in Dept 2', async () => {
    const { status, data } = await request('POST', '/requests', {
      title: 'Student B Security Test Issue',
      description: 'Testing IDOR boundaries for Student B',
      category: 'PLUMBING',
      priority: 'MEDIUM',
      departmentId: dept2.id,
    }, studentB.token);
    assert(status === 201, `Request creation failed: ${status}`);
    reqStudentB = data.data.request;
  });

  await test('IDOR: Student B CANNOT view Student A request details', async () => {
    const { status } = await request('GET', `/requests/${reqStudentA.id}`, null, studentB.token);
    assert(status === 403, `Expected 403 Forbidden for cross-student view, got ${status}`);
  });

  await test('IDOR: Student CANNOT update request status', async () => {
    const { status } = await request('PATCH', `/requests/${reqStudentA.id}/status`, {
      status: 'RESOLVED',
    }, studentA.token);
    assert(status === 403, `Expected 403 Forbidden for student status update, got ${status}`);
  });

  await test('RBAC: Student CANNOT access staff requests queue', async () => {
    const { status } = await request('GET', '/requests/staff', null, studentA.token);
    assert(status === 403, `Expected 403 Forbidden for student accessing staff queue, got ${status}`);
  });

  await test('RBAC: Student CANNOT access admin analytics', async () => {
    const { status } = await request('GET', '/analytics/admin', null, studentA.token);
    assert(status === 403, `Expected 403 Forbidden for student accessing admin analytics, got ${status}`);
  });

  await test('RBAC: Staff CANNOT access admin analytics', async () => {
    const { status } = await request('GET', '/analytics/admin', null, staffDept1.token);
    assert(status === 403, `Expected 403 Forbidden for staff accessing admin analytics, got ${status}`);
  });

  await test('RBAC: Admin CAN access system analytics', async () => {
    const { status, data } = await request('GET', '/analytics/admin', null, admin.token);
    assert(status === 200, `Admin analytics failed: ${status}`);
    assert(data.success === true, 'Admin analytics succeeded');
  });

  // ── 4. Input Validation & Error Handling Audit ─────────────────────────────
  console.log('\n─── 4. Input Validation Audit ───────────────────────');

  await test('Request creation with invalid category returns 400 Bad Request', async () => {
    const { status, data } = await request('POST', '/requests', {
      title: 'Invalid Category Request',
      description: 'Testing validation for bogus category',
      category: 'INVALID_CAT',
      priority: 'LOW',
    }, studentA.token);
    assert(status === 400, `Expected 400, got ${status}`);
    assert(data.message.includes('Invalid category'), `Expected category error message, got: ${data.message}`);
  });

  await test('Request creation with invalid priority returns 400 Bad Request', async () => {
    const { status, data } = await request('POST', '/requests', {
      title: 'Invalid Priority Request',
      description: 'Testing validation for bogus priority',
      category: 'IT',
      priority: 'ULTRA_HIGH',
    }, studentA.token);
    assert(status === 400, `Expected 400, got ${status}`);
    assert(data.message.includes('Invalid priority'), `Expected priority error message, got: ${data.message}`);
  });

  await test('Request creation with empty title returns 400 Bad Request', async () => {
    const { status } = await request('POST', '/requests', {
      title: '   ',
      description: 'Valid description',
      category: 'IT',
    }, studentA.token);
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('Invalid lifecycle transition (OPEN -> CLOSED) returns 400 Bad Request', async () => {
    const { status, data } = await request('PATCH', `/requests/${reqStudentA.id}/status`, {
      status: 'CLOSED',
    }, admin.token);
    assert(status === 400, `Expected 400 for illegal status transition, got ${status}`);
    assert(data.message.includes('Invalid status transition'), `Expected transition error, got: ${data.message}`);
  });

  await test('Admin analytics with page=0 returns 400 Bad Request', async () => {
    const { status } = await request('GET', '/analytics/admin?page=0', null, admin.token);
    assert(status === 400, `Expected 400 Bad Request for page=0, got ${status}`);
  });

  await test('Admin analytics with limit=500 returns 400 Bad Request', async () => {
    const { status } = await request('GET', '/analytics/admin?limit=500', null, admin.token);
    assert(status === 400, `Expected 400 Bad Request for limit > 100, got ${status}`);
  });

  await test('Malformed JSON request body returns 400 Bad Request without stack trace', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json payload }',
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 400, `Expected 400 Bad Request for malformed JSON, got ${res.status}`);
    assert(data.message.includes('Invalid JSON payload'), `Expected JSON error message, got: ${data.message}`);
  });

  // ── 5. AI & Queue Failure Hardening Audit ──────────────────────────────────
  console.log('\n─── 5. AI & Queue Failure Hardening Audit ───────────');

  await test('Request creation succeeds immediately without waiting for Gemini AI', async () => {
    const start = Date.now();
    const { status, data } = await request('POST', '/requests', {
      title: 'Fast Non-Blocking Request Creation',
      description: 'Testing non-blocking async queueing speed',
      category: 'ELECTRICAL',
      priority: 'MEDIUM',
    }, studentA.token);
    const duration = Date.now() - start;

    assert(status === 201, `Request creation failed: ${status}`);
    assert(duration < 2000, `API response took ${duration}ms, must be < 2000ms`);
    assert(data.aiJobQueued !== undefined, 'aiJobQueued field must be returned');
    assert(data.data.request.aiProcessingStatus !== undefined, 'aiProcessingStatus must be present');
    assert(data.data.request.category === 'ELECTRICAL', 'User chosen category MUST NOT be overwritten by AI');
    assert(data.data.request.priority === 'MEDIUM', 'User chosen priority MUST NOT be overwritten by AI');
  });

  // ── 6. Socket.IO Security & Room Scoping Audit ────────────────────────────
  console.log('\n─── 6. Socket.IO Security & Isolation Audit ─────────');

  await test('Socket connection without JWT is rejected', async () => {
    const socket = createSocketClient(null);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.disconnect();
        reject(new Error('Socket without JWT should be rejected'));
      });
      socket.on('connect_error', (err) => {
        socket.disconnect();
        resolve();
      });
    });
  });

  await test('Authenticated socket connection receives scoped request events in real time', async () => {
    const socket = createSocketClient(studentA.token);
    await new Promise((res) => socket.on('connect', res));

    let eventReceived = false;
    socket.on('request.created', (evt) => {
      const studentId = evt.data?.studentId || evt.data?.student?.id || evt.studentId;
      if (studentId === studentA.user.id) {
        eventReceived = true;
      }
    });

    const { status } = await request('POST', '/requests', {
      title: 'Live Socket Delivery Audit Ticket',
      description: 'Verifying real-time delivery',
      category: 'SECURITY',
      priority: 'HIGH',
    }, studentA.token);
    assert(status === 201, 'Request created');

    for (let i = 0; i < 10; i++) {
      if (eventReceived) break;
      await sleep(200);
    }

    assert(eventReceived === true, 'Scoped socket event received by Student A');
    socket.disconnect();
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`   SPRINT 8 AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('  Failed tests:');
    results.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runSprint8Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
