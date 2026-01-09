/**
 * Vercel Serverless Function Entry Point
 * This file exports the Hono app for Vercel's serverless environment
 */
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectDatabase } from '../src/config/database.js';
import { initializeQueue } from '../src/config/queue.js';
import authRoutes from '../src/routes/auth.routes.js';
import shirtRoutes from '../src/routes/shirt.routes.js';
import { errorHandler, notFoundHandler } from '../src/middlewares/error.middleware.js';

// Create Hono app
const app = new Hono();

// CORS Configuration (same as src/index.ts)
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
  const origins = envOrigins.split(',').map(origin => origin.trim());
  const normalizedOrigins = origins
    .map(origin => origin.replace(/\/$/, ''))
    .filter(origin => origin.length > 0);
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  const allOrigins = [...normalizedOrigins, ...defaultOrigins];
  return [...new Set(allOrigins)];
};

const allowedOrigins = getAllowedOrigins();

const corsOrigin = (origin: string | undefined): string | undefined => {
  if (!origin) {
    return allowedOrigins[0];
  }
  const normalizedOrigin = origin.replace(/\/$/, '');
  const isAllowed = allowedOrigins.some((allowed) => {
    const normalizedAllowed = allowed.replace(/\/$/, '');
    return normalizedOrigin === normalizedAllowed;
  });
  if (isAllowed) {
    return normalizedOrigin;
  }
  console.warn(`⚠️  CORS: Origin "${origin}" not in allowed list:`, allowedOrigins);
  return undefined;
};

app.use('*', cors({
  origin: corsOrigin,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// Health check
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

// Initialize services on cold start
let initialized = false;
const initializeServices = async () => {
  if (initialized) return;
  try {
    await connectDatabase();
    await initializeQueue().catch((error) => {
      console.warn('⚠️  Queue initialization failed, continuing without queue');
    });
    initialized = true;
    console.log('✅ Services initialized for serverless function');
    console.log(`🌐 CORS: Allowing origins:`, allowedOrigins.join(', '));
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
};

// Initialize on module load (cold start)
initializeServices();

// Export the Hono app's fetch handler for Vercel
export default app;
