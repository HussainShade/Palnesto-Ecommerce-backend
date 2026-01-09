import { getRedisClient } from '../config/redis.js';

/**
 * Cache TTL in seconds
 * Product lists cached for 5 minutes to balance freshness and performance
 */
const CACHE_TTL = 300; // 5 minutes

/**
 * Generates cache key for shirt listings
 * Key includes all filter parameters for accurate cache hits
 */
const generateCacheKey = (filters: {
  sizeReferenceId?: string;
  size?: string;
  shirtTypeId?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
  limit: number;
}): string => {
  const parts = ['shirts:list'];
  
  // Use sizeReferenceId or size (normalize to same key)
  const sizeParam = filters.sizeReferenceId || filters.size;
  if (sizeParam) parts.push(`size:${sizeParam}`);
  
  // Use shirtTypeId or type (normalize to same key)
  const typeParam = filters.shirtTypeId || filters.type;
  if (typeParam) parts.push(`type:${typeParam}`);
  
  if (filters.minPrice !== undefined) parts.push(`minPrice:${filters.minPrice}`);
  if (filters.maxPrice !== undefined) parts.push(`maxPrice:${filters.maxPrice}`);
  parts.push(`page:${filters.page}`);
  parts.push(`limit:${filters.limit}`);
  
  return parts.join(':');
};

/**
 * Retrieves cached shirt list data
 * Returns null if cache miss or error
 */
export const getCachedShirtList = async (
  filters: Parameters<typeof generateCacheKey>[0]
): Promise<string | null> => {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      // Redis not available - proceed with DB query
      return null;
    }
    const key = generateCacheKey(filters);
    const cached = await redis.get(key);
    return cached;
  } catch (error) {
    // Redis not available - fail gracefully and proceed with DB query
    // This allows the app to work without Redis
    return null;
  }
};

/**
 * Caches shirt list data with TTL
 * Silently fails if Redis is unavailable
 */
export const setCachedShirtList = async (
  filters: Parameters<typeof generateCacheKey>[0],
  data: string
): Promise<void> => {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      // Redis not available - skip caching
      return;
    }
    const key = generateCacheKey(filters);
    await redis.setEx(key, CACHE_TTL, data);
  } catch (error) {
    // Redis not available - fail silently
    // Cache is not critical for functionality
  }
};

/**
 * Invalidates all shirt list caches
 * Called when shirts are created or updated
 * Uses pattern matching to clear all related cache keys
 */
export const invalidateShirtListCache = async (): Promise<void> => {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      // Redis not available - skip invalidation
      return;
    }
    // Delete all keys matching the shirt list pattern
    const keys = await redis.keys('shirts:list:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    // Fail silently - cache will expire naturally
  }
};

