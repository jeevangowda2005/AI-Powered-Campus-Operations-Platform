'use strict';

const { Queue } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const config = require('../config/env');

let aiQueue = null;

/**
 * Get (or lazily initialize) the AI processing BullMQ queue.
 * Returns null if Redis is unavailable.
 */
const getAiQueue = () => {
  if (aiQueue) return aiQueue;

  const connection = getRedisClient();
  if (!connection) {
    return null;
  }

  try {
    aiQueue = new Queue(config.aiQueueName, {
      connection,
      defaultJobOptions: {
        attempts: config.aiJobAttempts,
        backoff: {
          type: 'exponential',
          delay: config.aiJobBackoffMs,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    aiQueue.on('error', (err) => {
      console.warn('[AI Queue] Queue error:', err.message);
      aiQueue = null; // reset so next call re-creates it
    });

    console.log(`[AI Queue] Queue "${config.aiQueueName}" initialized.`);
    return aiQueue;
  } catch (err) {
    console.warn('[AI Queue] Failed to initialize AI queue:', err.message);
    aiQueue = null;
    return null;
  }
};

/**
 * Enqueue an AI processing job for a specific request.
 * Uses deterministic jobId (ai-<requestId>) to prevent duplicate active jobs.
 *
 * @param {string} requestId
 * @returns {{ scheduled: boolean, jobId?: string, reason?: string }}
 */
const enqueueAiJob = async (requestId) => {
  const queue = getAiQueue();

  if (!queue) {
    console.warn(`[AI Queue] Cannot enqueue job for request ${requestId}: Redis unavailable.`);
    return { scheduled: false, reason: 'Redis unavailable — AI processing could not be scheduled' };
  }

  const jobId = `ai-${requestId}`;

  try {
    const job = await queue.add(
      'process-ai',
      { requestId },
      { jobId }
    );

    console.log(`[AI Queue] Job enqueued — requestId: ${requestId}, jobId: ${job.id}`);
    return { scheduled: true, jobId: job.id };
  } catch (err) {
    console.warn(`[AI Queue] Failed to enqueue job for request ${requestId}:`, err.message);
    return { scheduled: false, reason: `Queue error: ${err.message}` };
  }
};

/**
 * Gracefully close the queue connection.
 */
const closeAiQueue = async () => {
  if (aiQueue) {
    try {
      await aiQueue.close();
      console.log('[AI Queue] Queue closed gracefully.');
    } catch (err) {
      console.warn('[AI Queue] Error closing queue:', err.message);
    } finally {
      aiQueue = null;
    }
  }
};

module.exports = { getAiQueue, enqueueAiJob, closeAiQueue };
