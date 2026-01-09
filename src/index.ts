import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { closeRedisClient } from './config/redis.js';
import { initializeQueue, closeQueue } from './config/queue.js';
import authRoutes from './routes/auth.routes.js';
import shirtRoutes from './routes/shirt.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/**
 * Main application bootstrap
 * Initializes all services and sets up routes
 */
const app = new Hono();

// CORS Configuration
// Allows requests from Next.js frontend with credentials support for HTTP-only cookies
// Supports comma-separated origins in environment variable for multiple environments

const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
  
  // Split by comma if multiple origins are provided
  const origins = envOrigins.split(',').map(origin => origin.trim());
  
  // Remove trailing slashes and filter out empty strings
  const normalizedOrigins = origins
    .map(origin => origin.replace(/\/$/, ''))
    .filter(origin => origin.length > 0);
  
  // Always include localhost for local development
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  
  // Combine and remove duplicates
  const allOrigins = [...normalizedOrigins, ...defaultOrigins];
  return [...new Set(allOrigins)];
};

const allowedOrigins = getAllowedOrigins();

// CORS origin validator function
const corsOrigin = (origin: string | undefined): string | undefined => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) {
    return allowedOrigins[0];
  }

  // Remove trailing slash from origin for comparison
  const normalizedOrigin = origin.replace(/\/$/, '');

  // Check if origin is in allowed list
  const isAllowed = allowedOrigins.some((allowed) => {
    const normalizedAllowed = allowed.replace(/\/$/, '');
    return normalizedOrigin === normalizedAllowed;
  });

  if (isAllowed) {
    return normalizedOrigin;
  }

  // Log for debugging (remove in production if needed)
  console.warn(`⚠️  CORS: Origin "${origin}" not in allowed list:`, allowedOrigins);
  return undefined;
};

app.use('*', cors({
  origin: corsOrigin, // Use function to validate origin
  credentials: true, // CRITICAL: Required for HTTP-only cookies (Access-Control-Allow-Credentials: true)
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  allowHeaders: ['Content-Type', 'Authorization'], // Allowed request headers
  exposeHeaders: ['Content-Type'], // Headers that can be accessed by the frontend
  maxAge: 86400, // Cache preflight requests for 24 hours
}));
// Cookie middleware is handled via getCookie/setCookie helpers

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/shirts', shirtRoutes);

// Error handling
app.onError(errorHandler);
app.notFound(notFoundHandler);

/**
 * Graceful shutdown handler
 * Closes all connections properly
 */
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await disconnectDatabase();
    await closeRedisClient();
    await closeQueue();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/**
 * Start server
 * Initializes database, Redis, and queue before listening
 */
const startServer = async () => {
  try {
    // Initialize services
    await connectDatabase();
    // Initialize queue (non-blocking - server works without it)
    await initializeQueue().catch((error) => {
      console.warn('⚠️  Queue initialization failed, continuing without queue');
    });

    const port = parseInt(process.env.PORT || '5000', 10);

    serve(
      {
  fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`🚀 Server is running on http://localhost:${info.port}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 CORS: Allowing origins:`, allowedOrigins);
      }
    );
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
