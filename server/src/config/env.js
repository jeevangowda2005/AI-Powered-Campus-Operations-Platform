const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'fallback-super-secret-jwt-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // AI Intelligence Layer Settings
  aiApiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gemini-3.8-flash',
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.80,

  // Sprint 5: Redis + BullMQ Settings
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  aiQueueName: process.env.AI_QUEUE_NAME || 'ai-processing',
  aiJobAttempts: parseInt(process.env.AI_JOB_ATTEMPTS, 10) || 3,
  aiJobBackoffMs: parseInt(process.env.AI_JOB_BACKOFF_MS, 10) || 5000,
};

module.exports = config;
