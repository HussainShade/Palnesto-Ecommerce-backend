import { z } from 'zod';
import mongoose from 'mongoose';
/**
 * Shirt size enum validation
 */
const shirtSizeEnum = z.enum(['M', 'L', 'XL', 'XXL']);
/**
 * Shirt type enum validation
 */
const shirtTypeEnum = z.enum(['Casual', 'Formal', 'Wedding', 'Sports', 'Vintage']);
/**
 * Discount validation schema
 * Supports both fixed amount and percentage discounts
 */
const discountSchema = z.object({
    type: z.enum(['amount', 'percentage']),
    value: z.number().min(0),
}).optional();
/**
 * Custom schema for MongoDB ObjectId validation
 */
const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
});
/**
 * Size variant schema for create shirt
 * Each size variant has its own price, imageURL, and stock
 */
const sizeVariantSchema = z.object({
    sizeReferenceId: objectIdSchema, // Foreign key to SizeReference
    price: z
        .number()
        .min(0, 'Price must be positive')
        .max(10000, 'Price cannot exceed 10000'),
    imageURL: z.string().url('Invalid image URL format').optional(),
    stock: z
        .number()
        .int('Stock must be an integer')
        .min(0, 'Stock cannot be negative')
        .default(0),
});
/**
 * Create shirt validation schema
 * Validates all required fields and business rules
 * Uses foreign keys and nested sizeVariant structure
 */
export const createShirtSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name must be less than 200 characters')
        .trim(),
    description: z
        .string()
        .max(1000, 'Description must be less than 1000 characters')
        .trim()
        .optional(),
    shirtTypeId: objectIdSchema, // Foreign key to ShirtType
    discount: discountSchema,
    sizeVariant: sizeVariantSchema, // Single size variant for initial creation
});
/**
 * Update shirt validation schema
 * All fields optional for partial updates
 * Includes optional sizes array for creating/updating size variants
 */
export const updateShirtSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name must be less than 200 characters')
        .trim()
        .optional(),
    description: z
        .string()
        .max(1000, 'Description must be less than 1000 characters')
        .trim()
        .optional(),
    shirtTypeId: objectIdSchema.optional(), // Foreign key to ShirtType
    discount: discountSchema,
    currentSizeVariant: sizeVariantSchema.partial().optional(), // Update for the main shirt's size variant
    sizes: z
        .array(sizeVariantSchema.extend({
        _id: objectIdSchema.optional(), // Allow _id for existing variants
    }))
        .optional()
        .refine((sizes) => {
        if (!sizes)
            return true;
        // Ensure no duplicate sizes
        const sizeSet = new Set(sizes.map((s) => s.sizeReferenceId.toString()));
        return sizeSet.size === sizes.length;
    }, {
        message: 'Duplicate sizes are not allowed',
    }),
}).partial(); // Make all top-level fields optional
/**
 * Custom schema for ObjectId or string validation
 * Accepts both MongoDB ObjectId and string values
 */
const objectIdOrStringSchema = z.string().refine((val) => {
    // Accept valid ObjectId or any non-empty string
    if (mongoose.Types.ObjectId.isValid(val) && val.length === 24) {
        return true;
    }
    return val.length > 0;
}, {
    message: 'Must be a valid ObjectId or non-empty string',
});
/**
 * Shirt listing query parameters validation
 * Handles filtering, pagination, and sorting
 * Accepts both ObjectId and string values for sizeReferenceId and shirtTypeId
 */
export const listShirtsSchema = z.object({
    // Accept both ObjectId and string (M, L, XL, XXL) - aliases supported
    sizeReferenceId: objectIdOrStringSchema.optional(),
    size: objectIdOrStringSchema.optional(), // Alias for sizeReferenceId
    // Accept both ObjectId and string (Casual, Formal, etc.) - aliases supported
    shirtTypeId: objectIdOrStringSchema.optional(),
    type: objectIdOrStringSchema.optional(), // Alias for shirtTypeId
    minPrice: z
        .string()
        .optional()
        .transform((val) => (val ? parseFloat(val) : undefined))
        .pipe(z.number().min(0).optional()),
    maxPrice: z
        .string()
        .optional()
        .transform((val) => (val ? parseFloat(val) : undefined))
        .pipe(z.number().min(0).optional()),
    page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .pipe(z.number().int().min(1))
        .default(1),
    limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 10))
        .pipe(z.number().int().min(1).max(100))
        .default(10),
    groupBy: z
        .enum(['design'])
        .optional(),
});
/**
 * Batch create shirt validation schema
 * Creates one shirt design with multiple size variants
 * Each size variant can have different price and imageURL
 */
export const batchCreateShirtSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name must be less than 200 characters')
        .trim(),
    description: z
        .string()
        .max(1000, 'Description must be less than 1000 characters')
        .trim()
        .optional(),
    shirtTypeId: objectIdSchema, // Foreign key to ShirtType
    discount: discountSchema,
    sizes: z
        .array(sizeVariantSchema)
        .min(1, 'At least one size with stock is required')
        .refine((sizes) => {
        // Ensure no duplicate sizes
        const sizeSet = new Set(sizes.map((s) => s.sizeReferenceId.toString()));
        return sizeSet.size === sizes.length;
    }, {
        message: 'Duplicate sizes are not allowed',
    })
        .refine((sizes) => {
        // At least one size must have stock > 0
        return sizes.some((s) => s.stock > 0);
    }, {
        message: 'At least one size must have stock greater than 0',
    }),
});
