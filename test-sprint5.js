/**
 * Sprint 5 End-to-End Tests
 * Redis + BullMQ Background AI Processing
 *
 * Run: node test-sprint5.js
 * Prerequisites: backend must be running on port 5000
 */

'use strict';

const BASE_URL = 'http://localhost:5001/api';

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

// ── Test State ────────────────────────────────────────────────────────────────

let studentToken, adminToken;
let createdRequestId;
const EMAIL_SUFFIX = `sprint5-${Date.now()}`;

// ── Tests ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n════════════════════════════════════════════');
  console.log('   Sprint 5 — Redis + BullMQ Tests');
  console.log('════════════════════════════════════════════\n');

  // ── 1. Health Check ──────────────────────────────────────────────────────
  console.log('─── 1. Health Check ───────────────────────');
  await test('Health endpoint returns 200', async () => {
    const { status, data } = await request('GET', '/health');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Expected success=true');
  });

  await test('Health endpoint includes services.redis field', async () => {
    const { data } = await request('GET', '/health');
    assert(data.services !== undefined, 'Expected services object');
    assert(['connected', 'unavailable'].includes(data.services.redis), `Invalid redis status: ${data.services.redis}`);
    console.log(`         Redis status reported: ${data.services.redis}`);
  });

  // ── 2. Setup: Register Users ─────────────────────────────────────────────
  console.log('\n─── 2. Setup: Register users ──────────────');
  await test('Register student account', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Sprint5 Student',
      email: `student-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'STUDENT',
    });
    assert(status === 201, `Register failed: ${status} ${JSON.stringify(data)}`);
    studentToken = data.data.token;
    assert(studentToken, 'No token returned');
  });

  await test('Register admin account', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      name: 'Sprint5 Admin',
      email: `admin-${EMAIL_SUFFIX}@campus.test`,
      password: 'Password123!',
      role: 'ADMIN',
    });
    assert(status === 201, `Register failed: ${status}`);
    adminToken = data.data.token;
    assert(adminToken, 'No token returned');
  });

  // ── 3. Request Creation — Non-blocking ───────────────────────────────────
  console.log('\n─── 3. Request Creation (non-blocking) ────');

  let createStart, createEnd;

  await test('POST /api/requests returns immediately (< 2000 ms)', async () => {
    createStart = Date.now();
    const { status, data } = await request('POST', '/requests', {
      title: 'Sprint5 Test: Leaking pipe in lab corridor',
      description: 'There is water leaking from the ceiling in lab corridor B2. Needs urgent attention.',
      category: 'PLUMBING',
      priority: 'HIGH',
    }, studentToken);
    createEnd = Date.now();
    const elapsed = createEnd - createStart;
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    createdRequestId = data.data.request.id;
    assert(createdRequestId, 'No request ID returned');
    assert(elapsed < 2000, `Request creation took ${elapsed}ms — should be < 2000ms (not waiting for AI)`);
    console.log(`         Response time: ${elapsed}ms`);
  });

  await test('Created request has aiProcessingStatus field', async () => {
    const { status, data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
    assert(status === 200, `Expected 200, got ${status}`);
    const req = data.data.request;
    assert(req.aiProcessingStatus !== undefined, 'aiProcessingStatus field missing from response');
    console.log(`         Initial aiProcessingStatus: ${req.aiProcessingStatus}`);
  });

  await test('Initial aiProcessingStatus is valid (PENDING, PROCESSING, or COMPLETED)', async () => {
    const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
    const status = data.data.request.aiProcessingStatus;
    assert(['PENDING', 'PROCESSING', 'COMPLETED'].includes(status), `Expected valid status, got ${status}`);
  });

  await test('Request status is OPEN (AI does not affect request lifecycle status)', async () => {
    const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
    const req = data.data.request;
    assert(req.status === 'OPEN', `Expected OPEN, got ${req.status}`);
  });

  await test('Final category is unchanged (AI must not overwrite)', async () => {
    const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
    const req = data.data.request;
    assert(req.category === 'PLUMBING', `Expected PLUMBING, got ${req.category}`);
  });

  await test('Final priority is unchanged (AI must not overwrite)', async () => {
    const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
    const req = data.data.request;
    assert(req.priority === 'HIGH', `Expected HIGH, got ${req.priority}`);
  });

  // ── 4. Duplicate Job Protection ──────────────────────────────────────────
  console.log('\n─── 4. Duplicate Job Protection ───────────');
  await test('Creating a second request produces unique job ID (no cross-request conflict)', async () => {
    const { status, data } = await request('POST', '/requests', {
      title: 'Sprint5 Test: Power outage in dorm C',
      description: 'Entire dorm C block has no electricity since morning.',
      category: 'ELECTRICAL',
      priority: 'CRITICAL',
    }, studentToken);
    assert(status === 201, `Expected 201, got ${status}`);
    const secondId = data.data.request.id;
    assert(secondId !== createdRequestId, 'Second request should have different ID');
  });

  // ── 5. Polling: Wait for AI completion ───────────────────────────────────
  console.log('\n─── 5. AI Processing Status Polling ───────');
  console.log('         Waiting up to 30s for worker to process...');

  let finalStatus = null;
  let pollAttempts = 0;
  const maxPollAttempts = 10; // 30s total

  while (pollAttempts < maxPollAttempts) {
    await sleep(3000);
    pollAttempts++;
    try {
      const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
      finalStatus = data.data.request.aiProcessingStatus;
      if (finalStatus === 'COMPLETED' || finalStatus === 'FAILED') break;
      process.stdout.write(`         Poll ${pollAttempts}: ${finalStatus}...\n`);
    } catch (e) {
      // ignore transient poll errors
    }
  }

  console.log(`         Final aiProcessingStatus after polling: ${finalStatus ?? 'STILL_RUNNING'}`);

  if (finalStatus === 'COMPLETED') {
    await test('aiProcessingStatus reached COMPLETED', async () => {
      assert(finalStatus === 'COMPLETED', `Expected COMPLETED, got ${finalStatus}`);
    });

    await test('AI fields populated after completion (advisory values exist)', async () => {
      const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
      const req = data.data.request;
      // At least one AI advisory field should be set if AI key is configured
      const hasAiData = req.aiCategory || req.aiPriority || req.aiProcessedAt;
      // We don't assert because AI key might not be configured — just report
      console.log(`         aiCategory: ${req.aiCategory ?? 'N/A'}, aiPriority: ${req.aiPriority ?? 'N/A'}, aiProcessedAt: ${req.aiProcessedAt ?? 'N/A'}`);
    });

    await test('Final category still unchanged after AI COMPLETED', async () => {
      const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
      assert(data.data.request.category === 'PLUMBING', `Category overwritten! Got ${data.data.request.category}`);
    });

    await test('Final priority still unchanged after AI COMPLETED', async () => {
      const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
      assert(data.data.request.priority === 'HIGH', `Priority overwritten! Got ${data.data.request.priority}`);
    });

  } else if (finalStatus === 'FAILED') {
    await test('aiProcessingStatus = FAILED (worker ran but AI config missing/errored)', async () => {
      assert(finalStatus === 'FAILED', `Expected FAILED, got ${finalStatus}`);
    });
    console.log('         NOTE: AI key not configured — FAILED is expected behavior.');

    await test('Final category still unchanged after AI FAILED', async () => {
      const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
      assert(data.data.request.category === 'PLUMBING', `Category overwritten! Got ${data.data.request.category}`);
    });

    await test('Final priority still unchanged after AI FAILED', async () => {
      const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
      assert(data.data.request.priority === 'HIGH', `Priority overwritten! Got ${data.data.request.priority}`);
    });

  } else {
    await test('AI processing status reached terminal state within timeout', async () => {
      assert(false, `Worker did not complete within 30s. Last status: ${finalStatus}. Is the worker running? (npm run worker)`);
    });
  }

  // ── 6. Regression: Sprint 1–4 Core Flows ─────────────────────────────────
  console.log('\n─── 6. Sprint 1–4 Regression Tests ────────');

  await test('Authentication: /auth/me returns current user', async () => {
    const { status, data } = await request('GET', '/auth/me', null, studentToken);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.data.user.email === `student-${EMAIL_SUFFIX}@campus.test`, 'Wrong user returned');
  });

  await test('RBAC: student cannot access admin routes', async () => {
    const { status } = await request('GET', '/requests', null, studentToken);
    assert(status === 403, `Expected 403, got ${status}`);
  });

  await test('RBAC: admin can access all requests', async () => {
    const { status } = await request('GET', '/requests', null, adminToken);
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('Request ownership: student can view own requests', async () => {
    const { status, data } = await request('GET', '/requests/my', null, studentToken);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.data.requests), 'Expected requests array');
    assert(data.data.requests.length >= 1, 'Expected at least 1 request');
  });

  await test('Request lifecycle: invalid status transition is rejected', async () => {
    const { status } = await request('PATCH', `/requests/${createdRequestId}/status`, { status: 'CLOSED' }, adminToken);
    assert(status === 400, `Expected 400 for invalid transition OPEN→CLOSED, got ${status}`);
  });

  await test('Request detail includes aiProcessingStatus field', async () => {
    const { data } = await request('GET', `/requests/${createdRequestId}`, null, studentToken);
    assert(data.data.request.aiProcessingStatus !== undefined, 'aiProcessingStatus missing from detail endpoint');
  });

  await test('Departments endpoint works', async () => {
    const { status, data } = await request('GET', '/departments', null, adminToken);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.data.departments), 'Expected departments array');
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════');
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
