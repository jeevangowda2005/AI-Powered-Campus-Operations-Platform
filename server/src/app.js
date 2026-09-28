const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Configure CORS for React Frontend
// Accepts the configured CLIENT_URL plus common Vite dev-server fallback ports
const allowedOrigins = [
  config.clientUrl || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Handle unknown API routes (404)
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

module.exports = app;
