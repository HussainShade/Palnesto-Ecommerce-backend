import { createClient } from 'redis';
/**
 * Redis client singleton
 * Used for caching product lists and session management
 */
let redisClient = null;
let redisConnectionAttempted = false;
let redisAvailable = false;
/**
 * Creates and returns Redis client instance
 * Reuses existing connection if available
 * Returns null if Redis is not available (graceful degradation)
 */
export const getRedisClient = async () => {
    // If already connected, return it
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }
    // If we've already attempted connection and it failed, don't try again
    if (redisConnectionAttempted && !redisAvailable) {
        return null;
    }
    // If connection is in progress, wait a bit and return null to avoid blocking
    if (redisConnectionAttempted && !redisClient) {
        return null;
    }
    redisConnectionAttempted = true;
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = createClient({
            url: redisUrl,
            socket: {
                connectTimeout: 2000, // 2 second timeout
                reconnectStrategy: false, // Don't auto-reconnect on connection failure
            },
        });
        redisClient.on('error', (err) => {
            console.error('❌ Redis Client Error:', err);
            redisAvailable = false;
        });
        redisClient.on('connect', () => {
            console.log('✅ Redis Client Connected');
            redisAvailable = true;
        });
        // Try to connect with timeout
        await Promise.race([
            redisClient.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 2000)),
        ]);
        redisAvailable = true;
        return redisClient;
    }
    catch (error) {
        console.warn('⚠️  Redis not available - continuing without cache:', error instanceof Error ? error.message : 'Connection failed');
        redisClient = null;
        redisAvailable = false;
        return null;
    }
};
/**
 * Closes Redis connection gracefully
 */
export const closeRedisClient = async () => {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
        console.log('✅ Redis Client Disconnected');
    }
};
