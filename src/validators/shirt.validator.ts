import { z } from 'zod';

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
 * Create shirt validation schema
 * Validates all required fields and business rules
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
  size: shirtSizeEnum,
  type: shirtTypeEnum,
  price: z
    .number()
    .min(0, 'Price must be positive')
    .max(10000, 'Price cannot exceed 10000'),
  discount: discountSchema,
  stock: z
    .number()
    .int('Stock must be an integer')
    .min(0, 'Stock cannot be negative')
    .default(0),
});

export type CreateShirtInput = z.infer<typeof createShirtSchema>;

/**
 * Update shirt validation schema
 * All fields optional for partial updates
 */
export const updateShirtSchema = createShirtSchema.partial();

export type UpdateShirtInput = z.infer<typeof updateShirtSchema>;

/**
 * Shirt listing query parameters validation
 * Handles filtering, pagination, and sorting
 */
export const listShirtsSchema = z.object({
  size: shirtSizeEnum.optional(),
  type: shirtTypeEnum.optional(),
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
});

export type ListShirtsInput = z.infer<typeof listShirtsSchema>;

