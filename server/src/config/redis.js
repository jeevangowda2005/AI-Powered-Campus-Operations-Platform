'use strict';

const { Redis } = require('ioredis');
const config = require('./env');

let redisClient = null;
let connectionFailed = false;

/**
 * Create (or return cached) ioredis client.
 * Returns null gracefully if Redis is unavailable.
 */
const getRedisClient = () => {
  if (connectionFailed) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: false,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 2) {
          console.warn('[Redis] Connection retries exhausted. Marking Redis as unavailable.');
          connectionFailed = true;
          return null; // Stop reconnecting
        }
        return Math.min(times * 100, 500);
      },
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis successfully.');
      connectionFailed = false;
    });

    redisClient.on('error', (err) => {
      console.warn('[Redis] Connection error:', err.message);
      connectionFailed = true;
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed.');
      connectionFailed = true;
    });

    return redisClient;
  } catch (err) {
    console.warn('[Redis] Failed to initialize Redis client:', err.message);
    connectionFailed = true;
    return null;
  }
};

/**
 * Check if Redis is healthy (for use in health checks or graceful shutdown).
 */
const isRedisConnected = () => {
  return redisClient !== null && redisClient.status === 'ready';
};

/**
 * Gracefully close the Redis connection.
 */
const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[Redis] Connection closed gracefully.');
    } catch (err) {
      console.warn('[Redis] Error during Redis disconnect:', err.message);
    } finally {
      redisClient = null;
    }
  }
};

module.exports = { getRedisClient, isRedisConnected, closeRedis };
