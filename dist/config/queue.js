import { Queue, Worker, QueueEvents } from 'bullmq';
/**
 * BullMQ queue for async tasks
 * Used for logging, analytics, and other background jobs
 */
let queue = null;
let worker = null;
let queueEvents = null;
/**
 * Initializes BullMQ queue with Redis connection
 * Fails gracefully if Redis is not available
 */
export const initializeQueue = async () => {
    if (queue) {
        return queue;
    }
    // Check if Redis is available first by trying to connect
    // This prevents BullMQ from continuously retrying
    let redisAvailable = false;
    try {
        const { getRedisClient } = await import('./redis.js');
        const redis = await getRedisClient();
        if (redis && redis.isOpen) {
            redisAvailable = true;
        }
        else {
            console.warn('⚠️  Redis not available - BullMQ queue disabled');
            return null;
        }
    }
    catch (error) {
        console.warn('⚠️  Redis not available - BullMQ queue disabled');
        return null;
    }
    if (!redisAvailable) {
        return null;
    }
    try {
        // BullMQ connection configuration
        // Uses same Redis instance as caching service
        const connection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null, // Disable retries for faster failure
            connectTimeout: 2000, // 2 second timeout
            retryStrategy: () => null, // Disable retry strategy - fail immediately
        };
        queue = new Queue('shirt-ecommerce-tasks', {
            connection,
        });
        // Initialize worker to process jobs (only if Redis is available)
        // Note: Worker will only be created if Redis connection succeeds
        try {
            worker = new Worker('shirt-ecommerce-tasks', async (job) => {
                // Example: Async logging task
                if (job.name === 'log-event') {
                    console.log(`[ASYNC LOG] ${job.data.message}`, job.data.timestamp);
                }
                // Add more job types as needed
                return { success: true };
            }, {
                connection: {
                    ...connection,
                    retryStrategy: () => null, // Stop retrying on connection failure
                },
                limiter: {
                    max: 1,
                    duration: 1000,
                },
            });
            worker.on('error', (error) => {
                // Silently handle errors - don't spam console
                // Worker will stop retrying due to retryStrategy
            });
            worker.on('closed', () => {
                console.log('ℹ️  BullMQ Worker closed');
            });
        }
        catch (error) {
            console.warn('⚠️  BullMQ Worker initialization failed:', error instanceof Error ? error.message : 'Unknown error');
            worker = null;
        }
        // Monitor queue events (only if Redis is available)
        try {
            queueEvents = new QueueEvents('shirt-ecommerce-tasks', {
                connection: {
                    ...connection,
                    retryStrategy: () => null, // Stop retrying on connection failure
                },
            });
            queueEvents.on('completed', ({ jobId }) => {
                console.log(`✅ Job ${jobId} completed`);
            });
            queueEvents.on('failed', ({ jobId, failedReason }) => {
                console.error(`❌ Job ${jobId} failed:`, failedReason);
            });
            queueEvents.on('error', (error) => {
                // Silently handle errors - don't spam console
                // QueueEvents will stop retrying due to retryStrategy
            });
        }
        catch (error) {
            console.warn('⚠️  BullMQ QueueEvents initialization failed:', error instanceof Error ? error.message : 'Unknown error');
            queueEvents = null;
        }
        console.log('✅ BullMQ queue initialized');
        return queue;
    }
    catch (error) {
        console.warn('⚠️  BullMQ queue initialization failed - continuing without queue:', error instanceof Error ? error.message : 'Connection failed');
        // Clean up on failure
        queue = null;
        worker = null;
        queueEvents = null;
        return null;
    }
};
/**
 * Gets the queue instance
 * Returns null if queue is not available
 */
export const getQueue = () => {
    return queue;
};
/**
 * Closes queue connections gracefully
 */
export const closeQueue = async () => {
    if (worker) {
        await worker.close();
        worker = null;
    }
    if (queueEvents) {
        await queueEvents.close();
        queueEvents = null;
    }
    if (queue) {
        await queue.close();
        queue = null;
    }
    console.log('✅ BullMQ queue closed');
};
