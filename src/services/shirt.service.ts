import { Shirt } from '../models/Shirt.js';
import type { IShirt, ShirtSize, ShirtType } from '../models/Shirt.js';
import type { CreateShirtInput, UpdateShirtInput, ListShirtsInput } from '../validators/shirt.validator.js';
import { getCachedShirtList, setCachedShirtList, invalidateShirtListCache } from './cache.service.js';
import { getQueue } from '../config/queue.js';

/**
 * Helper function to calculate finalPrice (same logic as pre-save hook)
 * Used to ensure finalPrice is set before validation
 */
const calculateFinalPrice = (price: number, discount?: { type: 'amount' | 'percentage'; value: number }): number => {
  let finalPrice = price;

  if (discount) {
    if (discount.type === 'amount') {
      finalPrice = Math.max(0, price - discount.value);
    } else if (discount.type === 'percentage') {
      finalPrice = Math.max(0, price * (1 - discount.value / 100));
    }
  }

  return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
};

/**
 * Creates a new shirt for a seller
 * Invalidates cache after creation
 */
export const createShirt = async (
  sellerId: string,
  data: CreateShirtInput
): Promise<IShirt> => {
  // Calculate finalPrice before creating document to pass validation
  const finalPrice = calculateFinalPrice(data.price, data.discount);

  const shirt = new Shirt({
    ...data,
    sellerId,
    finalPrice, // Set finalPrice explicitly to pass validation
  });

  await shirt.save();
  
  // Invalidate cache after creating new shirt
  await invalidateShirtListCache();
  
  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
      await queue.add('log-event', {
        message: `Shirt created: ${shirt.name} by seller ${sellerId}`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return shirt;
};

/**
 * Updates an existing shirt
 * Only allows seller to update their own shirts
 * Invalidates cache after update
 */
export const updateShirt = async (
  shirtId: string,
  sellerId: string,
  data: UpdateShirtInput
): Promise<IShirt | null> => {
  const shirt = await Shirt.findOne({
    _id: shirtId,
    sellerId,
  });

  if (!shirt) {
    return null;
  }

  // Calculate finalPrice if price or discount is being updated
  if (data.price !== undefined || data.discount !== undefined) {
    const price = data.price !== undefined ? data.price : shirt.price;
    const discount = data.discount !== undefined ? data.discount : shirt.discount;
    data.finalPrice = calculateFinalPrice(price, discount);
  }

  Object.assign(shirt, data);
  await shirt.save();
  
  // Invalidate cache after updating shirt
  await invalidateShirtListCache();
  
  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
      await queue.add('log-event', {
        message: `Shirt updated: ${shirt.name} by seller ${sellerId}`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return shirt;
};

/**
 * Retrieves a single shirt by ID
 */
export const getShirtById = async (shirtId: string): Promise<IShirt | null> => {
  return Shirt.findById(shirtId);
};

/**
 * Lists shirts with filtering, pagination, and caching
 * Uses Redis cache to reduce database load
 */
export const listShirts = async (
  filters: ListShirtsInput
): Promise<{
  shirts: IShirt[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  // Try to get from cache first
  const cached = await getCachedShirtList(filters);
  if (cached) {
    return JSON.parse(cached);
  }

  // Build MongoDB query
  const query: any = {};

  if (filters.size) {
    query.size = filters.size;
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    query.finalPrice = {};
    if (filters.minPrice !== undefined) {
      query.finalPrice.$gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      query.finalPrice.$lte = filters.maxPrice;
    }
  }

  // Execute query with pagination
  const skip = (filters.page - 1) * filters.limit;
  
  const [shirts, total] = await Promise.all([
    Shirt.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(filters.limit)
      .lean(),
    Shirt.countDocuments(query),
  ]);

  const result = {
    shirts: shirts as IShirt[],
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };

  // Cache the result
  await setCachedShirtList(filters, JSON.stringify(result));

  return result;
};

/**
 * Deletes a shirt
 * Only allows seller to delete their own shirts
 */
export const deleteShirt = async (
  shirtId: string,
  sellerId: string
): Promise<boolean> => {
  const result = await Shirt.deleteOne({
    _id: shirtId,
    sellerId,
  });

  if (result.deletedCount > 0) {
    await invalidateShirtListCache();
    return true;
  }

  return false;
};

