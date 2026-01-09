import { Shirt, ShirtSize, ShirtType, SizeReference } from '../models/index.js';
import type { IShirt, IShirtSize, IDiscount } from '../models/index.js';
import type { CreateShirtInput, UpdateShirtInput, ListShirtsInput, BatchCreateShirtInput } from '../validators/shirt.validator.js';
import { getCachedShirtList, setCachedShirtList, invalidateShirtListCache } from './cache.service.js';
import { getQueue } from '../config/queue.js';
import { resolveSizeReference, resolveShirtType } from './reference-cache.service.js';
import mongoose from 'mongoose';

/**
 * Helper function to calculate finalPrice (same logic as pre-save hook)
 * Applies discount from Shirt to ShirtSize price
 */
const calculateFinalPrice = (price: number, discount?: IDiscount): number => {
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
 * Creates a new shirt with a single size variant
 * Creates Shirt first, then creates ShirtSize entry
 * Invalidates cache after creation
 */
export const createShirt = async (
  userId: string,
  data: CreateShirtInput
): Promise<{ shirt: IShirt; shirtSize: IShirtSize }> => {
  // Validate that shirtTypeId exists
  const shirtType = await ShirtType.findById(data.shirtTypeId);
  if (!shirtType) {
    throw new Error(`ShirtType with ID '${data.shirtTypeId}' not found. Please ensure reference data is seeded.`);
  }

  // Validate that sizeReferenceId exists
  const sizeRef = await SizeReference.findById(data.sizeVariant.sizeReferenceId);
  if (!sizeRef) {
    throw new Error(`SizeReference with ID '${data.sizeVariant.sizeReferenceId}' not found. Please ensure reference data is seeded.`);
  }

  // Create Shirt first (without price, stock, size - those are in ShirtSize)
  const shirt = new Shirt({
    userId,
    name: data.name,
    description: data.description,
    shirtTypeId: data.shirtTypeId,
    discount: data.discount,
  });

  await shirt.save();

  // Calculate finalPrice for this size variant
  const finalPrice = calculateFinalPrice(data.sizeVariant.price, data.discount);

  // Create ShirtSize entry for this size variant
  const shirtSize = new ShirtSize({
    shirtId: shirt._id,
    sizeReferenceId: data.sizeVariant.sizeReferenceId,
    price: data.sizeVariant.price,
    imageURL: data.sizeVariant.imageURL,
    stock: data.sizeVariant.stock || 0,
    finalPrice, // Will be recalculated by pre-save hook, but set explicitly for validation
  });

  await shirtSize.save();
  
  // Invalidate cache after creating new shirt
  await invalidateShirtListCache();
  
  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
      await queue.add('log-event', {
        message: `Shirt created: ${shirt.name} by user ${userId}`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return { shirt, shirtSize };
};

/**
 * Creates multiple size variants for a single shirt design
 * Creates one Shirt, then creates multiple ShirtSize entries
 * Invalidates cache after creation
 */
export const batchCreateShirts = async (
  userId: string,
  data: BatchCreateShirtInput
): Promise<{ shirt: IShirt; shirtSizes: IShirtSize[] }> => {
  // Validate that shirtTypeId exists
  const shirtType = await ShirtType.findById(data.shirtTypeId);
  if (!shirtType) {
    throw new Error(`ShirtType with ID '${data.shirtTypeId}' not found. Please ensure reference data is seeded.`);
  }

  // Create Shirt first (common to all sizes)
  const shirt = new Shirt({
    userId,
    name: data.name,
    description: data.description,
    shirtTypeId: data.shirtTypeId,
    discount: data.discount,
  });

  await shirt.save();

  // Validate all SizeReferences exist
  const sizeReferenceIds = data.sizes.map(s => s.sizeReferenceId);
  const sizeRefs = await SizeReference.find({ _id: { $in: sizeReferenceIds } });
  const sizeRefMap = new Map(sizeRefs.map(sr => [sr._id.toString(), sr._id]));

  // Verify all size references were found
  for (const sizeVariant of data.sizes) {
    if (!sizeRefMap.has(sizeVariant.sizeReferenceId.toString())) {
      throw new Error(`SizeReference with ID '${sizeVariant.sizeReferenceId}' not found. Please ensure reference data is seeded.`);
    }
  }

  // Create ShirtSize entries for each size variant
  const shirtSizesToCreate = data.sizes
    .filter((sizeVariant) => sizeVariant.stock > 0)
    .map((sizeVariant) => {
      const finalPrice = calculateFinalPrice(sizeVariant.price, data.discount);

      return {
        shirtId: shirt._id,
        sizeReferenceId: sizeVariant.sizeReferenceId,
        price: sizeVariant.price,
        imageURL: sizeVariant.imageURL,
        stock: sizeVariant.stock,
        finalPrice,
      };
    });

  // Create all ShirtSize entries in batch
  const createdShirtSizes = await ShirtSize.insertMany(shirtSizesToCreate);

  // Invalidate cache after batch creation
  await invalidateShirtListCache();

  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
      await queue.add('log-event', {
        message: `Batch created ${createdShirtSizes.length} size variant(s) for shirt: ${data.name} by user ${userId}`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return {
    shirt,
    shirtSizes: createdShirtSizes as unknown as IShirtSize[],
  };
};

/**
 * Updates an existing shirt and optionally updates/creates size variants
 * Only allows user to update their own shirts
 * Invalidates cache after update
 */
export const updateShirt = async (
  shirtId: string,
  userId: string,
  data: UpdateShirtInput
): Promise<{
  shirt: IShirt;
  updatedShirtSizes: IShirtSize[];
  createdShirtSizes: IShirtSize[];
  updatedCount: number;
  createdCount: number;
} | null> => {
  // Find shirt and verify ownership
  const shirt = await Shirt.findOne({
    _id: shirtId,
    userId,
  });

  if (!shirt) {
    return null;
  }

  // Extract sizes array and currentSizeVariant if present (will be handled separately)
  const { sizes, currentSizeVariant, ...updateData } = data;

  // Update the shirt (name, description, shirtTypeId, discount)
  if (updateData.name !== undefined) shirt.name = updateData.name;
  if (updateData.description !== undefined) shirt.description = updateData.description;
  if (updateData.shirtTypeId) {
    // Validate that shirtTypeId exists
    const shirtType = await ShirtType.findById(updateData.shirtTypeId);
    if (!shirtType) {
      throw new Error(`ShirtType with ID '${updateData.shirtTypeId}' not found.`);
    }
    shirt.shirtTypeId = new mongoose.Types.ObjectId(updateData.shirtTypeId);
  }
  if (updateData.discount !== undefined) shirt.discount = updateData.discount;

  await shirt.save();

  const updatedShirtSizes: IShirtSize[] = [];
  const createdShirtSizes: IShirtSize[] = [];
  let updatedCount = 0;
  let createdCount = 0;

  // Update the current shirt's size variant if provided
  if (currentSizeVariant) {
    const existingShirtSize = await ShirtSize.findOne({ shirtId: shirt._id });
    if (existingShirtSize) {
      if (currentSizeVariant.price !== undefined) existingShirtSize.price = currentSizeVariant.price;
      if (currentSizeVariant.imageURL !== undefined) existingShirtSize.imageURL = currentSizeVariant.imageURL;
      if (currentSizeVariant.stock !== undefined) existingShirtSize.stock = currentSizeVariant.stock;
      // finalPrice will be recalculated by pre-save hook
      await existingShirtSize.save();
      updatedShirtSizes.push(existingShirtSize);
      updatedCount++;
    }
  }

  // If sizes array is provided, update existing variants or create new ones
  if (sizes && sizes.length > 0) {
    // Get existing ShirtSize entries for this shirt
    const existingShirtSizes = await ShirtSize.find({ shirtId: shirt._id });
    const existingSizeRefMap = new Map(
      existingShirtSizes.map(ss => [ss.sizeReferenceId.toString(), ss])
    );

    // Get current shirt's sizeReferenceId to skip it (already updated via currentSizeVariant)
    const currentSizeRefId = existingShirtSizes[0]?.sizeReferenceId?.toString();

    // Validate all SizeReferences exist
    const sizeReferenceIds = sizes.map(s => s.sizeReferenceId);
    const sizeRefs = await SizeReference.find({ _id: { $in: sizeReferenceIds } });
    const sizeRefMap = new Map(sizeRefs.map(sr => [sr._id.toString(), sr._id]));

    // Process each size variant in the request
    for (const sizeVariant of sizes) {
      if (sizeVariant.stock <= 0) continue; // Skip sizes with no stock

      // Skip the current shirt's size (it's updated via currentSizeVariant)
      if (currentSizeRefId && sizeVariant.sizeReferenceId.toString() === currentSizeRefId) {
        continue;
      }

      // Validate sizeReferenceId exists
      const sizeRefId = sizeRefMap.get(sizeVariant.sizeReferenceId.toString());
      if (!sizeRefId) {
        throw new Error(`SizeReference with ID '${sizeVariant.sizeReferenceId}' not found.`);
      }

      const existingShirtSize = existingSizeRefMap.get(sizeVariant.sizeReferenceId.toString());

      if (existingShirtSize) {
        // Update existing ShirtSize
        if (sizeVariant.price !== undefined) existingShirtSize.price = sizeVariant.price;
        if (sizeVariant.imageURL !== undefined) existingShirtSize.imageURL = sizeVariant.imageURL;
        if (sizeVariant.stock !== undefined) existingShirtSize.stock = sizeVariant.stock;
        // finalPrice will be recalculated by pre-save hook
        await existingShirtSize.save();
        updatedShirtSizes.push(existingShirtSize);
        updatedCount++;
      } else {
        // Create new ShirtSize
        const finalPrice = calculateFinalPrice(sizeVariant.price, shirt.discount);

        const newShirtSize = new ShirtSize({
          shirtId: shirt._id,
          sizeReferenceId: sizeVariant.sizeReferenceId,
          price: sizeVariant.price,
          imageURL: sizeVariant.imageURL,
          stock: sizeVariant.stock,
          finalPrice,
        });

        await newShirtSize.save();
        createdShirtSizes.push(newShirtSize);
        createdCount++;
      }
    }
  }

  // Invalidate cache after updating shirt and creating variants
  await invalidateShirtListCache();

  // Queue async analytics/logging task (non-blocking)
  try {
    const queue = getQueue();
    if (queue) {
      let logMessage = `Shirt updated: ${shirt.name} by user ${userId}`;
      const logParts: string[] = [];
      if (updatedCount > 0) {
        logParts.push(`${updatedCount} variant(s) updated`);
      }
      if (createdCount > 0) {
        logParts.push(`${createdCount} variant(s) created`);
      }
      if (logParts.length > 0) {
        logMessage += `. ${logParts.join(', ')}.`;
      }
      await queue.add('log-event', {
        message: logMessage,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Queue not available - log but don't fail the request
    console.warn('Queue operation failed:', error);
  }

  return {
    shirt,
    updatedShirtSizes,
    createdShirtSizes,
    updatedCount,
    createdCount,
  };
};

/**
 * Retrieves a single shirt by ID with all its size variants
 */
export const getShirtById = async (shirtId: string): Promise<{ shirt: IShirt; shirtSizes: any[] } | null> => {
  const shirt = await Shirt.findById(shirtId)
    .populate<{ shirtTypeId: { name: string } }>('shirtTypeId')
    .lean();

  if (!shirt) {
    return null;
  }

  // Get ALL size variants for this shirt (no stock filtering)
  // Returns all variants including those with stock = 0
  const sizes = await ShirtSize.find({ shirtId: shirt._id })
    .populate<{ sizeReferenceId: { _id: mongoose.Types.ObjectId; name: string; displayName: string; order: number } }>('sizeReferenceId', 'name displayName order')
    .sort({ 'sizeReferenceId.order': 1 })
    .lean();

  // Transform to include sizeReference object (for frontend compatibility)
  const shirtSizes = sizes.map((size: any) => {
    const sizeRef = size.sizeReferenceId;
    
    return {
      _id: size._id,
      shirtId: size.shirtId,
      sizeReferenceId: sizeRef._id || sizeRef,
      sizeReference: {
        _id: sizeRef._id || sizeRef,
        name: sizeRef.name,
        displayName: sizeRef.displayName,
        order: sizeRef.order,
      },
      price: size.price,
      imageURL: size.imageURL,
      stock: size.stock, // Can be 0 - all variants returned regardless of stock
      finalPrice: size.finalPrice,
      createdAt: size.createdAt,
      updatedAt: size.updatedAt,
    };
  });

  return {
    shirt: shirt as unknown as IShirt,
    shirtSizes,
  };
};

/**
 * Lists shirts with filtering, pagination, and caching
 * Joins Shirt and ShirtSize models
 * Supports grouping by design (name + type)
 */
export const listShirts = async (
  filters: ListShirtsInput
): Promise<{
  shirts: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  grouped?: boolean;
}> => {
  // Try to get from cache first (only for non-grouped results)
  const cached = await getCachedShirtList(filters);
  if (cached) {
    return JSON.parse(cached);
  }

  // Build query for ShirtSize (where price, stock, finalPrice are)
  const matchQuery: any = {};

  // Resolve size filter - accept both sizeReferenceId and size (alias)
  const sizeParam = (filters as any).sizeReferenceId || (filters as any).size;
  if (sizeParam) {
    try {
      const sizeId = resolveSizeReference(sizeParam);
      matchQuery.sizeReferenceId = new mongoose.Types.ObjectId(sizeId);
    } catch (error: any) {
      // Return error response for invalid size
      throw new Error(error.message || 'Invalid size parameter');
    }
  }

  // Resolve type filter - will be applied in aggregation pipeline
  let resolvedShirtTypeId: mongoose.Types.ObjectId | null = null;
  const typeParam = (filters as any).shirtTypeId || (filters as any).type;
  if (typeParam) {
    try {
      const typeId = resolveShirtType(typeParam);
      resolvedShirtTypeId = new mongoose.Types.ObjectId(typeId);
    } catch (error: any) {
      // Return error response for invalid type
      throw new Error(error.message || 'Invalid shirt type parameter');
    }
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    matchQuery.finalPrice = {};
    if (filters.minPrice !== undefined) {
      matchQuery.finalPrice.$gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      matchQuery.finalPrice.$lte = filters.maxPrice;
    }
  }

  if (filters.groupBy === 'design') {
    // Group by design (name + type) using aggregation
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'shirts',
          localField: 'shirtId',
          foreignField: '_id',
          as: 'shirt',
        },
      },
      { $unwind: '$shirt' },
      {
        $lookup: {
          from: 'shirttypes',
          localField: 'shirt.shirtTypeId',
          foreignField: '_id',
          as: 'shirtType',
        },
      },
      { $unwind: '$shirtType' },
      {
        $lookup: {
          from: 'sizereferences',
          localField: 'sizeReferenceId',
          foreignField: '_id',
          as: 'sizeReference',
        },
      },
      { $unwind: '$sizeReference' },
      // Filter by type if provided (using resolved ObjectId)
      ...(resolvedShirtTypeId ? [{
        $match: {
          'shirt.shirtTypeId': resolvedShirtTypeId,
        },
      }] : []),
      {
        $group: {
          _id: {
            shirtId: '$shirtId',
            name: '$shirt.name',
            shirtTypeId: '$shirt.shirtTypeId',
          },
          shirt: { $first: '$shirt' },
          shirtType: { $first: '$shirtType' },
          discount: { $first: '$shirt.discount' },
          variants: {
            $push: {
              _id: '$_id',
              sizeReferenceId: '$sizeReferenceId',
              sizeReference: '$sizeReference',
              price: '$price',
              imageURL: '$imageURL',
              stock: '$stock',
              finalPrice: '$finalPrice',
            },
          },
          totalStock: { $sum: '$stock' },
        },
      },
      {
        $project: {
          _id: '$shirt._id',
          userId: '$shirt.userId',
          name: '$shirt.name',
          description: '$shirt.description',
          shirtTypeId: '$shirt.shirtTypeId',
          shirtType: '$shirtType.name',
          discount: 1,
          variants: 1,
          totalStock: 1,
        },
      },
      { $sort: { name: 1, 'shirtType.name': 1 } },
    ];

    // Count total grouped designs
    const totalGroupedDesigns = await ShirtSize.aggregate([
      ...pipeline.slice(0, pipeline.length - 1), // Exclude sorting for count
      { $count: 'total' },
    ]);

    const total = totalGroupedDesigns.length > 0 ? totalGroupedDesigns[0].total : 0;

    // Apply pagination
    const skip = (filters.page - 1) * filters.limit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: filters.limit });

    const groupedShirts = await ShirtSize.aggregate(pipeline);

    // Sort variants within each grouped shirt by size order
    const sizeOrderMap = new Map(
      (await SizeReference.find({ isActive: true }).sort({ order: 1 }).lean())
        .map(sr => [sr._id.toString(), sr.order])
    );

    const sortedGroupedShirts = groupedShirts.map((design: any) => {
      const sortedVariants = design.variants.sort((a: any, b: any) => {
        const orderA = sizeOrderMap.get(a.sizeReferenceId.toString()) || 999;
        const orderB = sizeOrderMap.get(b.sizeReferenceId.toString()) || 999;
        return orderA - orderB;
      });

      const availableSizes = sortedVariants
        .filter((v: any) => v.stock > 0)
        .map((v: any) => v.sizeReference.name);

      return {
        ...design,
        variants: sortedVariants,
        availableSizes,
      };
    });

    return {
      shirts: sortedGroupedShirts,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      grouped: true,
    };
  } else {
    // Standard listing (no grouping) - join Shirt and ShirtSize
    const skip = (filters.page - 1) * filters.limit;

    // Use aggregation to join ShirtSize with Shirt
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'shirts',
          localField: 'shirtId',
          foreignField: '_id',
          as: 'shirt',
        },
      },
      { $unwind: '$shirt' },
      // Filter by type if provided (using resolved ObjectId)
      ...(resolvedShirtTypeId ? [{ $match: { 'shirt.shirtTypeId': resolvedShirtTypeId } }] : []),
      {
        $lookup: {
          from: 'shirttypes',
          localField: 'shirt.shirtTypeId',
          foreignField: '_id',
          as: 'shirtType',
        },
      },
      { $unwind: '$shirtType' },
      {
        $lookup: {
          from: 'sizereferences',
          localField: 'sizeReferenceId',
          foreignField: '_id',
          as: 'sizeReference',
        },
      },
      { $unwind: '$sizeReference' },
      {
        $project: {
          _id: '$_id',
          shirtId: '$shirtId',
          userId: '$shirt.userId',
          name: '$shirt.name',
          description: '$shirt.description',
          shirtTypeId: '$shirt.shirtTypeId',
          shirtType: '$shirtType.name',
          discount: '$shirt.discount',
          sizeReferenceId: '$sizeReferenceId',
          sizeReference: {
            _id: '$sizeReference._id',
            name: '$sizeReference.name',
            displayName: '$sizeReference.displayName',
          },
          price: '$price',
          imageURL: '$imageURL',
          stock: '$stock',
          finalPrice: '$finalPrice',
          createdAt: '$createdAt',
          updatedAt: '$updatedAt',
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: filters.limit },
    ];

    const [shirts, totalResult] = await Promise.all([
      ShirtSize.aggregate(pipeline),
      ShirtSize.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'shirts',
            localField: 'shirtId',
            foreignField: '_id',
            as: 'shirt',
          },
        },
        { $unwind: '$shirt' },
        // Filter by type if provided (using resolved ObjectId)
        ...(resolvedShirtTypeId ? [{ $match: { 'shirt.shirtTypeId': resolvedShirtTypeId } }] : []),
        { $count: 'total' },
      ]),
    ]);

    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    const result = {
      shirts,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      grouped: false,
    };

    // Cache the result
    await setCachedShirtList(filters, JSON.stringify(result));

    return result;
  }
};

/**
 * Deletes a shirt and all its size variants
 * Only allows user to delete their own shirts
 */
export const deleteShirt = async (
  shirtId: string,
  userId: string
): Promise<boolean> => {
  // Verify ownership
  const shirt = await Shirt.findOne({ _id: shirtId, userId });
  if (!shirt) {
    return false;
  }

  // Delete all ShirtSize entries for this shirt
  await ShirtSize.deleteMany({ shirtId: shirt._id });

  // Delete the shirt
  const result = await Shirt.deleteOne({ _id: shirtId, userId });

  if (result.deletedCount && result.deletedCount > 0) {
    await invalidateShirtListCache();
    try {
      const queue = getQueue();
      if (queue) {
        await queue.add('log-event', {
          message: `Shirt deleted: ${shirtId} by user ${userId}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('Queue operation failed:', error);
    }
    return true;
  }
  return false;
};
