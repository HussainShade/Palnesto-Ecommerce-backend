import { Shirt } from '../models/Shirt.js';
import type { IShirt, ShirtSize, ShirtType, IDiscount } from '../models/Shirt.js';
import type { CreateShirtInput, UpdateShirtInput, ListShirtsInput, BatchCreateShirtInput } from '../validators/shirt.validator.js';
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
 * Creates multiple shirts in batch with different sizes and stocks
 * All shirts share the same name, description, type, price, and discount
 * Each shirt has a different size and stock
 * Invalidates cache after creation
 */
export const batchCreateShirts = async (
  sellerId: string,
  data: BatchCreateShirtInput
): Promise<IShirt[]> => {
  // Calculate finalPrice once (same for all shirts)
  const finalPrice = calculateFinalPrice(data.price, data.discount);

  // Filter sizes with stock > 0 and create shirt documents
  const shirtsToCreate = data.sizes
    .filter((sizeStock) => sizeStock.stock > 0)
    .map((sizeStock) => ({
      sellerId,
      name: data.name,
      description: data.description,
      size: sizeStock.size,
      type: data.type,
      price: data.price,
      discount: data.discount,
      finalPrice,
      stock: sizeStock.stock,
    }));

  // Create all shirts in batch
  const createdShirts = await Shirt.insertMany(shirtsToCreate);

  // Invalidate cache after batch creation
  await invalidateShirtListCache();

  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
      await queue.add('log-event', {
        message: `Batch created ${createdShirts.length} shirts: ${data.name} by seller ${sellerId}`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return createdShirts as unknown as IShirt[];
};

/**
 * Updates an existing shirt and optionally updates/creates size variants
 * Only allows seller to update their own shirts
 * Invalidates cache after update
 * Returns updated shirt, updated variants, and newly created variants
 */
export const updateShirt = async (
  shirtId: string,
  sellerId: string,
  data: UpdateShirtInput
): Promise<{
  shirt: IShirt;
  updatedShirts: IShirt[];
  createdShirts: IShirt[];
  updatedCount: number;
  createdCount: number;
} | null> => {
  const shirt = await Shirt.findOne({
    _id: shirtId,
    sellerId,
  });

  if (!shirt) {
    return null;
  }

  // Extract sizes array if present (will be handled separately)
  const { sizes, ...updateData } = data;

  // Calculate finalPrice if price or discount is being updated
  let calculatedFinalPrice: number | undefined;
  if (updateData.price !== undefined || updateData.discount !== undefined) {
    const price = updateData.price !== undefined ? updateData.price : shirt.price;
    const discount = updateData.discount !== undefined ? updateData.discount : shirt.discount;
    calculatedFinalPrice = calculateFinalPrice(price, discount);
  }

  // Update the current shirt
  Object.assign(shirt, updateData);
  if (calculatedFinalPrice !== undefined) {
    shirt.finalPrice = calculatedFinalPrice;
  }
  await shirt.save();

  const updatedShirts: IShirt[] = [];
  const createdShirts: IShirt[] = [];
  let updatedCount = 0;
  let createdCount = 0;

  // If sizes array is provided, update existing variants or create new ones
  if (sizes && sizes.length > 0) {
    // Get the final values after update (use updated values or existing values)
    const finalName = updateData.name !== undefined ? updateData.name : shirt.name;
    const finalDescription = updateData.description !== undefined ? updateData.description : shirt.description;
    const finalType = updateData.type !== undefined ? updateData.type : shirt.type;
    const finalPrice = updateData.price !== undefined ? updateData.price : shirt.price;
    const finalDiscount = updateData.discount !== undefined ? updateData.discount : shirt.discount;
    const finalFinalPrice = calculatedFinalPrice !== undefined ? calculatedFinalPrice : shirt.finalPrice;

    // Filter out sizes that match the current shirt's size (it's already updated)
    const sizesToProcess = sizes.filter((sizeStock) => sizeStock.size !== shirt.size && sizeStock.stock > 0);

    if (sizesToProcess.length > 0) {
      // Find existing variants with same name and size for this seller
      const existingVariants = await Shirt.find({
        sellerId,
        name: finalName,
        size: { $in: sizesToProcess.map((s) => s.size) },
        _id: { $ne: shirtId }, // Exclude the current shirt
      });

      const existingVariantsMap = new Map(
        existingVariants.map((v) => [v.size, v])
      );

      const sizesToUpdate: Array<{ size: ShirtSize; stock: number }> = [];
      const sizesToCreate: Array<{ size: ShirtSize; stock: number }> = [];

      // Separate sizes into update and create lists
      for (const sizeStock of sizesToProcess) {
        if (existingVariantsMap.has(sizeStock.size)) {
          sizesToUpdate.push(sizeStock);
        } else {
          sizesToCreate.push(sizeStock);
        }
      }

      // Update existing variants
      if (sizesToUpdate.length > 0) {
        const updatePromises = sizesToUpdate.map(async (sizeStock) => {
          const existingVariant = existingVariantsMap.get(sizeStock.size)!;
          
          // Update variant with new stock and shared attributes (if they changed)
          existingVariant.stock = sizeStock.stock;
          existingVariant.name = finalName;
          if (finalDescription !== undefined) {
            existingVariant.description = finalDescription;
          }
          existingVariant.type = finalType;
          existingVariant.price = finalPrice;
          existingVariant.discount = finalDiscount;
          existingVariant.finalPrice = finalFinalPrice;
          
          await existingVariant.save();
          return existingVariant;
        });

        const updated = await Promise.all(updatePromises);
        updatedShirts.push(...(updated as unknown as IShirt[]));
        updatedCount = updated.length;
      }

      // Create new variants
      if (sizesToCreate.length > 0) {
        const shirtsToCreate = sizesToCreate.map((sizeStock) => ({
          sellerId,
          name: finalName,
          description: finalDescription,
          size: sizeStock.size,
          type: finalType,
          price: finalPrice,
          discount: finalDiscount,
          finalPrice: finalFinalPrice,
          stock: sizeStock.stock,
        }));

        const newlyCreated = await Shirt.insertMany(shirtsToCreate);
        createdShirts.push(...(newlyCreated as unknown as IShirt[]));
        createdCount = newlyCreated.length;
      }
    }
  }

  // Invalidate cache after updating shirt and creating variants
  await invalidateShirtListCache();

  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
        await queue.add('log-event', {
          message: `Shirt updated: ${shirt.name} by seller ${sellerId}${updatedCount > 0 || createdCount > 0 ? `, ${updatedCount} variant(s) updated, ${createdCount} variant(s) created` : ''}`,
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return {
    shirt,
    updatedShirts,
    createdShirts,
    updatedCount,
    createdCount,
  };
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
 * Supports grouping by design (name + type + price)
 */
export const listShirts = async (
  filters: ListShirtsInput
): Promise<{
  shirts: IShirt[] | Array<{
    _id: string;
    sellerId: string;
    name: string;
    description?: string;
    type: ShirtType;
    price: number;
    discount?: IDiscount;
    finalPrice: number;
    totalStock: number;
    availableSizes: ShirtSize[];
    variants: Array<{
      _id: string;
      size: ShirtSize;
      stock: number;
      finalPrice: number;
    }>;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  // Try to get from cache first (only if not grouping)
  if (!filters.groupBy) {
    const cached = await getCachedShirtList(filters);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Build MongoDB query
  const query: any = {};

  // Size filter: if grouping, we'll filter after grouping
  // If not grouping, apply size filter directly
  if (filters.size && !filters.groupBy) {
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

  // If grouping by design, fetch all matching shirts and group them
  if (filters.groupBy === 'design') {
    // Fetch all matching shirts (no pagination yet)
    const allShirts = await Shirt.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Group by name, type, and price
    const designMap = new Map<string, IShirt[]>();
    
    for (const shirt of allShirts as IShirt[]) {
      // Create a unique key for the design
      const designKey = `${shirt.name}|${shirt.type}|${shirt.price}`;
      
      if (!designMap.has(designKey)) {
        designMap.set(designKey, []);
      }
      designMap.get(designKey)!.push(shirt);
    }

    // Convert map to grouped designs
    const groupedDesigns = Array.from(designMap.values()).map((variants) => {
      // Sort variants by size order (M, L, XL, XXL)
      const sizeOrder: Record<ShirtSize, number> = { M: 0, L: 1, XL: 2, XXL: 3 };
      variants.sort((a, b) => sizeOrder[a.size] - sizeOrder[b.size]);

      // Use first variant for shared fields
      const firstVariant = variants[0];
      
      // Calculate total stock
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      
      // Get available sizes (stock > 0)
      const availableSizes = variants
        .filter((v) => v.stock > 0)
        .map((v) => v.size);

      // Build variants array
      const variantArray = variants.map((v) => ({
        _id: v._id.toString(),
        size: v.size,
        stock: v.stock,
        finalPrice: v.finalPrice,
      }));

      return {
        _id: firstVariant._id.toString(),
        sellerId: firstVariant.sellerId.toString(),
        name: firstVariant.name,
        description: firstVariant.description,
        type: firstVariant.type,
        price: firstVariant.price,
        discount: firstVariant.discount,
        finalPrice: firstVariant.finalPrice,
        totalStock,
        availableSizes,
        variants: variantArray,
      };
    });

    // Apply size filter if provided (filter at design level)
    let filteredDesigns = groupedDesigns;
    if (filters.size) {
      filteredDesigns = groupedDesigns.filter((design) =>
        design.availableSizes.includes(filters.size!)
      );
    }

    // Apply pagination to grouped designs
    const total = filteredDesigns.length;
    const skip = (filters.page - 1) * filters.limit;
    const paginatedDesigns = filteredDesigns.slice(skip, skip + filters.limit);

    const result = {
      shirts: paginatedDesigns,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };

    // Don't cache grouped results (too complex to invalidate)
    return result;
  }

  // Standard behavior: return individual variants
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

