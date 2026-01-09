import { SizeReference, ShirtType } from '../models/index.js';
import mongoose from 'mongoose';
/**
 * In-memory cache for reference data
 * Maps string names to MongoDB ObjectIds for fast lookups
 */
const sizeReferenceCache = new Map(); // name -> ObjectId
const shirtTypeCache = new Map(); // name -> ObjectId
/**
 * Initializes the reference data cache
 * Should be called on application startup
 */
export const initializeReferenceCache = async () => {
    try {
        // Load SizeReferences
        const sizes = await SizeReference.find({ isActive: true }).lean();
        sizeReferenceCache.clear();
        sizes.forEach((size) => {
            sizeReferenceCache.set(size.name.toUpperCase(), size._id.toString());
        });
        // Load ShirtTypes
        const types = await ShirtType.find({ isActive: true }).lean();
        shirtTypeCache.clear();
        types.forEach((type) => {
            shirtTypeCache.set(type.name.toLowerCase(), type._id.toString());
        });
        console.log(`✅ Reference cache initialized: ${sizes.length} sizes, ${types.length} types`);
    }
    catch (error) {
        console.error('❌ Failed to initialize reference cache:', error);
        throw error;
    }
};
/**
 * Refreshes the reference data cache
 * Useful when reference data is updated
 */
export const refreshReferenceCache = async () => {
    await initializeReferenceCache();
};
/**
 * Checks if a string is a valid MongoDB ObjectId
 */
const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(value) && value.length === 24;
};
/**
 * Resolves a size reference parameter to an ObjectId
 * Accepts both ObjectId strings and size names (M, L, XL, XXL)
 *
 * @param sizeParam - ObjectId string or size name (case-insensitive)
 * @returns ObjectId string
 * @throws Error if size is invalid
 */
export const resolveSizeReference = (sizeParam) => {
    // If it's already a valid ObjectId, return it
    if (isValidObjectId(sizeParam)) {
        return sizeParam;
    }
    // Otherwise, treat it as a string name and look it up in cache
    const normalizedName = sizeParam.toUpperCase();
    const sizeId = sizeReferenceCache.get(normalizedName);
    if (!sizeId) {
        const validSizes = Array.from(sizeReferenceCache.keys()).join(', ');
        throw new Error(`Invalid size: '${sizeParam}'. Valid sizes are: ${validSizes || 'M, L, XL, XXL'}`);
    }
    return sizeId;
};
/**
 * Resolves a shirt type parameter to an ObjectId
 * Accepts both ObjectId strings and type names (Casual, Formal, etc.)
 *
 * @param typeParam - ObjectId string or type name (case-insensitive)
 * @returns ObjectId string
 * @throws Error if type is invalid
 */
export const resolveShirtType = (typeParam) => {
    // If it's already a valid ObjectId, return it
    if (isValidObjectId(typeParam)) {
        return typeParam;
    }
    // Otherwise, treat it as a string name and look it up in cache
    const normalizedName = typeParam.toLowerCase();
    const typeId = shirtTypeCache.get(normalizedName);
    if (!typeId) {
        const validTypes = Array.from(shirtTypeCache.keys())
            .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
            .join(', ');
        throw new Error(`Invalid shirt type: '${typeParam}'. Valid types are: ${validTypes || 'Casual, Formal, Wedding, Sports, Vintage'}`);
    }
    return typeId;
};
/**
 * Gets all available size names from cache
 */
export const getAvailableSizes = () => {
    return Array.from(sizeReferenceCache.keys());
};
/**
 * Gets all available shirt type names from cache
 */
export const getAvailableShirtTypes = () => {
    return Array.from(shirtTypeCache.keys()).map((t) => t.charAt(0).toUpperCase() + t.slice(1));
};
