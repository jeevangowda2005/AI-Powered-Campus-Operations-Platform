'use strict';

// Load environment variables FIRST before any other imports
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const config = require('../config/env');
const prisma = require('../config/db');
const aiService = require('../services/ai.service');

console.log('[Worker] AI Worker starting...');
console.log(`[Worker] Queue: "${config.aiQueueName}"`);
console.log(`[Worker] Redis: ${config.redisUrl}`);
console.log(`[Worker] Max attempts: ${config.aiJobAttempts}`);

const connection = getRedisClient();

if (!connection) {
  console.error('[Worker] FATAL: Cannot connect to Redis. Worker cannot start.');
  process.exit(1);
}

/**
 * Publish Redis Pub/Sub message to Express Socket.IO server (non-fatal)
 */
const publishSocketEvent = (handler, payload) => {
  try {
    if (connection && typeof connection.publish === 'function') {
      connection.publish('socket-events', JSON.stringify({ handler, payload }));
    }
  } catch (err) {
    console.warn('[Worker] Socket Redis publish error (non-fatal):', err.message);
  }
};

/**
 * Core AI processing logic for a single service request.
 * Reuses Sprint 4 AI service. AI suggestions are ADVISORY ONLY.
 * Final category/priority are NEVER overwritten.
 */
const processAiForRequest = async (requestId) => {
  // Step 1: Fetch request from PostgreSQL
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error(`Request ${requestId} not found in database — skipping job`);
  }

  // Step 2: Mark as PROCESSING in PostgreSQL
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { aiProcessingStatus: 'PROCESSING' },
  });

  // Emit real-time PROCESSING event via Redis Pub/Sub
  publishSocketEvent('handleAiStatusUpdated', {
    requestId,
    studentId: request.studentId,
    departmentId: request.departmentId,
    assignedStaffId: request.assignedStaffId,
    aiProcessingStatus: 'PROCESSING',
  });

  console.log(`[Worker] Processing AI for request ${requestId} (title: "${request.title}")`);

  // Step 3: Run AI tasks — classify and priority sequentially to avoid parallel
  // Gemini 503 rate-limit errors; similarity is local DB only so runs in parallel.
  const classResult = await aiService.classifyRequest({ title: request.title, description: request.description });
  const prioResult = await aiService.suggestPriority({ title: request.title, description: request.description, category: request.category });
  const similarMatches = await aiService.findSimilarRequests(request);

  // Step 4: Persist AI suggestions (ADVISORY ONLY — never overwrite category/priority)
  const updateData = {
    aiProcessedAt: new Date(),
    aiProcessingStatus: 'COMPLETED',
  };

  if (classResult && classResult.category) {
    updateData.aiCategory = classResult.category;
  }

  if (prioResult && prioResult.priority) {
    updateData.aiPriority = prioResult.priority;
    updateData.aiPriorityReason = prioResult.reason;
  }

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  // Step 5: Persist similarity results
  for (const match of similarMatches) {
    await prisma.requestSimilarity.upsert({
      where: {
        requestId_similarRequestId: {
          requestId: request.id,
          similarRequestId: match.similarRequestId,
        },
      },
      update: { similarityScore: match.similarityScore },
      create: {
        requestId: request.id,
        similarRequestId: match.similarRequestId,
        similarityScore: match.similarityScore,
      },
    });
  }

  // Emit real-time COMPLETED event via Redis Pub/Sub
  publishSocketEvent('handleAiStatusUpdated', {
    requestId,
    studentId: request.studentId,
    departmentId: request.departmentId,
    assignedStaffId: request.assignedStaffId,
    aiProcessingStatus: 'COMPLETED',
    aiCategory: updateData.aiCategory,
    aiPriority: updateData.aiPriority,
    aiPriorityReason: updateData.aiPriorityReason,
    aiProcessedAt: updateData.aiProcessedAt,
  });

  console.log(
    `[Worker] AI processing COMPLETED for request ${requestId}. ` +
    `Category: ${classResult?.category ?? 'N/A'}, Priority: ${prioResult?.priority ?? 'N/A'}, ` +
    `Similar: ${similarMatches.length}`
  );
};

/**
 * BullMQ Worker — processes jobs from the AI queue.
 */
const worker = new Worker(
  config.aiQueueName,
  async (job) => {
    const { requestId } = job.data;

    if (!requestId) {
      throw new Error('Job is missing requestId — cannot process');
    }

    console.log(`[Worker] AI job received — jobId: ${job.id}, requestId: ${requestId}, attempt: ${job.attemptsMade + 1}/${config.aiJobAttempts}`);

    await processAiForRequest(requestId);
  },
  {
    connection,
    concurrency: 2,
  }
);

// --- Worker Event Handlers ---

worker.on('completed', (job) => {
  console.log(`[Worker] AI job COMPLETED — jobId: ${job.id}, requestId: ${job.data.requestId}`);
});

worker.on('failed', async (job, err) => {
  const requestId = job?.data?.requestId;
  const isLastAttempt = job.attemptsMade >= config.aiJobAttempts;

  if (isLastAttempt) {
    console.error(
      `[Worker] AI job PERMANENTLY FAILED after ${job.attemptsMade} attempt(s) — jobId: ${job.id}, requestId: ${requestId}. Error: ${err.message}`
    );

    // Mark request as FAILED in DB so the frontend can show the correct state
    if (requestId) {
      try {
        const req = await prisma.serviceRequest.update({
          where: { id: requestId },
          data: { aiProcessingStatus: 'FAILED' },
        });
        console.log(`[Worker] aiProcessingStatus set to FAILED for request ${requestId}`);

        // Emit real-time FAILED event via Redis Pub/Sub
        publishSocketEvent('handleAiStatusUpdated', {
          requestId,
          studentId: req.studentId,
          departmentId: req.departmentId,
          assignedStaffId: req.assignedStaffId,
          aiProcessingStatus: 'FAILED',
        });
      } catch (dbErr) {
        console.error(`[Worker] Could not update aiProcessingStatus to FAILED for ${requestId}:`, dbErr.message);
      }
    }
  } else {
    console.warn(
      `[Worker] AI job FAILED (will retry) — jobId: ${job.id}, requestId: ${requestId}, attempt: ${job.attemptsMade}/${config.aiJobAttempts}. Error: ${err.message}`
    );
  }
});

worker.on('error', (err) => {
  console.error('[Worker] Worker-level error:', err.message);
});

worker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job stalled — jobId: ${jobId}`);
});

// --- Graceful Shutdown ---

const shutdown = async (signal) => {
  console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
  try {
    await worker.close();
    await prisma.$disconnect();
    console.log('[Worker] Shutdown complete.');
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('[Worker] AI Worker ready and listening for jobs.');
