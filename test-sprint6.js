/**
 * Sprint 6 End-to-End Test Suite — Real-Time System using Socket.IO
 *
 * Run: node test-sprint6.js
 * Prerequisites: backend server running on port 5001 with Redis and Worker active
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
  const data = await res.json();
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

// ── Test State ────────────────────────────────────────────────────────────────

let studentA, studentB, staffDeptA, staffDeptB, admin;
const EMAIL_SUFFIX = `sprint6-${Date.now()}`;

async function runTests() {
  console.log('\n════════════════════════════════════════════');
  console.log('   Sprint 6 — Socket.IO Real-Time Tests');
  console.log('════════════════════════════════════════════\n');

  // ── 1. Setup: Register Test Accounts & Departments ────────────────────────
  console.log('─── 1. Setup: User Accounts & Departments ─');

  await test('Register Student A', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Student Alpha',
      email: `studentA-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'STUDENT',
    });
    assert(status === 201, `Register failed: ${status}`);
    studentA = { token: data.data.token, user: data.data.user };
  });

  await test('Register Student B', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Student Beta',
      email: `studentB-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'STUDENT',
    });
    assert(status === 201, `Register failed: ${status}`);
    studentB = { token: data.data.token, user: data.data.user };
  });

  await test('Register Staff Dept A', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Staff IT Dept',
      email: `staffA-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'STAFF',
    });
    assert(status === 201, `Register failed: ${status}`);
    staffDeptA = { token: data.data.token, user: data.data.user };
  });

  await test('Register Staff Dept B', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Staff Plumbing Dept',
      email: `staffB-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'STAFF',
    });
    assert(status === 201, `Register failed: ${status}`);
    staffDeptB = { token: data.data.token, user: data.data.user };
  });

  await test('Register Admin', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Admin Master',
      email: `admin-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'ADMIN',
    });
    assert(status === 201, `Register failed: ${status}`);
    admin = { token: data.data.token, user: data.data.user };
  });

  // ── 2. Socket Authentication Audit ───────────────────────────────────────
  console.log('\n─── 2. Socket Authentication Audit ─────────');

  await test('Connecting with valid JWT succeeds', async () => {
    const socket = createSocketClient(studentA.token);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', (err) => reject(new Error(`Unexpected connect_error: ${err.message}`)));
    });
  });

  await test('Connecting with missing JWT is rejected', async () => {
    const socket = createSocketClient(null);
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.disconnect();
        reject(new Error('Connection should have been rejected for missing token'));
      });
      socket.on('connect_error', (err) => {
        assert(err.message.includes('Authentication error'), `Expected Authentication error, got ${err.message}`);
        socket.disconnect();
        resolve();
      });
    });
  });

  await test('Connecting with invalid/tampered JWT is rejected', async () => {
    const socket = createSocketClient('invalid.jwt.token');
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.disconnect();
        reject(new Error('Connection should have been rejected for invalid token'));
      });
      socket.on('connect_error', (err) => {
        assert(err.message.includes('Authentication error'), `Expected Authentication error, got ${err.message}`);
        socket.disconnect();
        resolve();
      });
    });
  });

  // ── 3. Real-Time Event & Room Isolation Audit ─────────────────────────────
  console.log('\n─── 3. Event & Room Isolation Audit ────────');

  let socketStudentA, socketStudentB, socketStaffA, socketStaffB, socketAdmin;

  await test('Establish authenticated socket connections for test clients', async () => {
    socketStudentA = createSocketClient(studentA.token);
    socketStudentB = createSocketClient(studentB.token);
    socketStaffA   = createSocketClient(staffDeptA.token);
    socketStaffB   = createSocketClient(staffDeptB.token);
    socketAdmin    = createSocketClient(admin.token);

    await Promise.all([
      new Promise((res) => socketStudentA.on('connect', res)),
      new Promise((res) => socketStudentB.on('connect', res)),
      new Promise((res) => socketStaffA.on('connect', res)),
      new Promise((res) => socketStaffB.on('connect', res)),
      new Promise((res) => socketAdmin.on('connect', res)),
    ]);
  });

  let createdRequestId;

  await test('Request creation emits request.created to Student A and Admin ONLY', async () => {
    let studentAReceived = false;
    let studentBReceived = false;
    let adminReceived = false;

    socketStudentA.once('request.created', (evt) => { studentAReceived = true; });
    socketStudentB.once('request.created', (evt) => { studentBReceived = true; });
    socketAdmin.once('request.created', (evt) => { adminReceived = true; });

    const { status, data } = await request('POST', '/requests', {
      title: 'Sprint 6 Real-Time Wi-Fi Issue',
      description: 'Wi-Fi dropped in dorm library room 302',
      category: 'IT',
      priority: 'HIGH',
    }, studentA.token);

    assert(status === 201, `Request creation failed: ${status}`);
    createdRequestId = data.data.request.id;

    // Give time for Socket delivery
    await sleep(600);

    assert(studentAReceived === true, 'Student A should receive request.created event');
    assert(adminReceived === true, 'Admin should receive request.created event');
    assert(studentBReceived === false, 'Student B MUST NOT receive Student A request.created event');
  });

  await test('Payload security check: request.created payload omits sensitive data', async () => {
    let receivedPayload = null;
    socketStudentA.once('request.created', (evt) => { receivedPayload = evt; });

    await request('POST', '/requests', {
      title: 'Sprint 6 Payload Security Test',
      description: 'Checking password hash omission',
      category: 'IT',
      priority: 'LOW',
    }, studentA.token);

    await sleep(600);
    assert(receivedPayload !== null, 'No payload received');
    assert(receivedPayload.data.student.passwordHash === undefined, 'passwordHash must not be exposed in socket payload');
  });

  await test('Status update emits request.status.updated to authorized clients ONLY', async () => {
    let studentAReceived = false;
    let studentBReceived = false;

    socketStudentA.once('request.status.updated', () => { studentAReceived = true; });
    socketStudentB.once('request.status.updated', () => { studentBReceived = true; });

    const { status } = await request('PATCH', `/requests/${createdRequestId}/status`, {
      status: 'IN_PROGRESS',
    }, admin.token);

    assert(status === 200, `Status update failed: ${status}`);
    await sleep(600);

    assert(studentAReceived === true, 'Student A (owner) should receive request.status.updated event');
    assert(studentBReceived === false, 'Student B MUST NOT receive status update for Student A request');
  });

  await test('Assignment emits request.assigned event to assigned staff & student owner', async () => {
    let studentAReceived = false;
    let staffAReceived = false;
    let staffBReceived = false;

    socketStudentA.once('request.assigned', () => { studentAReceived = true; });
    socketStaffA.once('request.assigned', () => { staffAReceived = true; });
    socketStaffB.once('request.assigned', () => { staffBReceived = true; });

    const { status } = await request('PATCH', `/requests/${createdRequestId}/assign`, {
      assignedStaffId: staffDeptA.user.id,
    }, admin.token);

    assert(status === 200, `Assignment failed: ${status}`);
    await sleep(600);

    assert(studentAReceived === true, 'Student A should receive request.assigned event');
    assert(staffAReceived === true, 'Assigned Staff A should receive request.assigned event');
    assert(staffBReceived === false, 'Unassigned Staff B MUST NOT receive request.assigned event');
  });

  // ── 4. AI Worker → Socket.IO Real-Time Event Audit ────────────────────────
  console.log('\n─── 4. AI Worker → Socket.IO Real-Time Audit');

  await test('AI background worker status transitions emit request.ai.updated events', async () => {
    let aiEventReceived = false;
    let receivedAiStatus = null;

    // Create a new request to watch worker AI events live
    const { data } = await request('POST', '/requests', {
      title: 'Sprint 6 Real-Time AI Watch Test',
      description: 'Testing live AI processing status updates via socket',
      category: 'ELECTRICAL',
      priority: 'MEDIUM',
    }, studentA.token);

    const watchReqId = data.data.request.id;

    socketStudentA.on('request.ai.updated', (evt) => {
      if (evt.requestId === watchReqId) {
        aiEventReceived = true;
        receivedAiStatus = evt.data.aiProcessingStatus;
      }
    });

    let attempts = 0;
    while (attempts < 10 && (!aiEventReceived || (receivedAiStatus !== 'COMPLETED' && receivedAiStatus !== 'FAILED'))) {
      await sleep(1000);
      attempts++;
    }

    console.log(`         AI status received via Socket: ${receivedAiStatus ?? 'NONE'}`);
    assert(aiEventReceived === true, 'Student A should receive live request.ai.updated event');
    assert(['PROCESSING', 'COMPLETED', 'FAILED'].includes(receivedAiStatus), `Invalid AI status: ${receivedAiStatus}`);
  });

  // Cleanup active sockets
  if (socketStudentA) socketStudentA.disconnect();
  if (socketStudentB) socketStudentB.disconnect();
  if (socketStaffA)   socketStaffA.disconnect();
  if (socketStaffB)   socketStaffB.disconnect();
  if (socketAdmin)    socketAdmin.disconnect();

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════');
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('  Failed tests:');
    results.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
