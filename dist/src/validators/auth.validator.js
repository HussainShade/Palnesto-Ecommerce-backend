import { z } from 'zod';
/**
 * Login request validation schema
 * Validates email format and password requirements
 */
export const loginSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters'),
});
/**
 * Signup request validation schema
 * Validates user registration data
 */
export const signupSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters'),
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
    userType: z
        .enum(['Seller', 'Customer'])
        .default('Customer')
        .optional(), // Default to Customer, can be Seller for seller registration
});
/**
 * Create seller request validation schema
 * Used by admin to create new seller accounts
 */
export const createSellerSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters'),
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
});
