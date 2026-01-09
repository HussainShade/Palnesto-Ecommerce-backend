/**
 * Vercel Serverless Function Entry Point
 * This file exports the Hono app for Vercel's serverless environment
 */
import app from '../src/index.js';

// Initialize database connection for serverless functions
// This runs once per cold start
import { connectDatabase } from '../src/config/database.js';
import { initializeQueue } from '../src/config/queue.js';

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
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
};

// Initialize on module load (cold start)
initializeServices();

// Export the Hono app's fetch handler for Vercel
export default app;
