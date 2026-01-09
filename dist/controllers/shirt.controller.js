import { createShirtSchema, updateShirtSchema, listShirtsSchema, batchCreateShirtSchema, } from '../validators/shirt.validator.js';
import { createShirt, updateShirt, getShirtById, listShirts, deleteShirt, batchCreateShirts, } from '../services/shirt.service.js';
/**
 * Creates a new shirt
 * Requires authenticated seller
 */
export const createShirtHandler = async (c) => {
    try {
        const sellerId = c.get('sellerId');
        const body = await c.req.json();
        const validatedData = createShirtSchema.parse(body);
        const shirt = await createShirt(sellerId, validatedData);
        return c.json({
            success: true,
            message: 'Shirt created successfully',
            data: { shirt },
        }, 201);
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return c.json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            }, 400);
        }
        return c.json({
            success: false,
            message: error.message || 'Failed to create shirt',
        }, 500);
    }
};
/**
 * Creates multiple shirts in batch with different sizes and stocks
 * Requires authenticated seller
 */
export const batchCreateShirtsHandler = async (c) => {
    try {
        const sellerId = c.get('sellerId');
        const body = await c.req.json();
        const validatedData = batchCreateShirtSchema.parse(body);
        const shirts = await batchCreateShirts(sellerId, validatedData);
        return c.json({
            success: true,
            message: `Successfully created ${shirts.length} shirt(s)`,
            data: { shirts },
        }, 201);
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return c.json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            }, 400);
        }
        return c.json({
            success: false,
            message: error.message || 'Failed to create shirts',
        }, 500);
    }
};
/**
 * Updates an existing shirt
 * Only allows seller to update their own shirts
 */
export const updateShirtHandler = async (c) => {
    try {
        const sellerId = c.get('sellerId');
        const shirtId = c.req.param('id');
        const body = await c.req.json();
        const validatedData = updateShirtSchema.parse(body);
        const result = await updateShirt(shirtId, sellerId, validatedData);
        if (!result) {
            return c.json({
                success: false,
                message: 'Shirt not found or unauthorized',
            }, 404);
        }
        const { shirt, updatedShirts, createdShirts, updatedCount, createdCount } = result;
        // Build response message
        let message = 'Shirt updated successfully';
        const messageParts = [];
        if (updatedCount > 0) {
            messageParts.push(`${updatedCount} variant(s) updated`);
        }
        if (createdCount > 0) {
            messageParts.push(`${createdCount} variant(s) created`);
        }
        if (messageParts.length > 0) {
            message += `. ${messageParts.join(', ')}.`;
        }
        return c.json({
            success: true,
            message,
            data: {
                shirt,
                updatedShirts,
                createdShirts,
                updatedCount,
                createdCount,
            },
        });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return c.json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            }, 400);
        }
        return c.json({
            success: false,
            message: error.message || 'Failed to update shirt',
        }, 500);
    }
};
/**
 * Retrieves a single shirt by ID
 */
export const getShirtHandler = async (c) => {
    try {
        const shirtId = c.req.param('id');
        const shirt = await getShirtById(shirtId);
        if (!shirt) {
            return c.json({
                success: false,
                message: 'Shirt not found',
            }, 404);
        }
        return c.json({
            success: true,
            data: { shirt },
        });
    }
    catch (error) {
        return c.json({
            success: false,
            message: error.message || 'Failed to retrieve shirt',
        }, 500);
    }
};
/**
 * Lists shirts with filtering and pagination
 * Uses Redis caching for performance
 */
export const listShirtsHandler = async (c) => {
    try {
        const queryParams = c.req.query();
        const validatedData = listShirtsSchema.parse(queryParams);
        const result = await listShirts(validatedData);
        return c.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return c.json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            }, 400);
        }
        return c.json({
            success: false,
            message: error.message || 'Failed to retrieve shirts',
        }, 500);
    }
};
/**
 * Deletes a shirt
 * Only allows seller to delete their own shirts
 */
export const deleteShirtHandler = async (c) => {
    try {
        const sellerId = c.get('sellerId');
        const shirtId = c.req.param('id');
        const deleted = await deleteShirt(shirtId, sellerId);
        if (!deleted) {
            return c.json({
                success: false,
                message: 'Shirt not found or unauthorized',
            }, 404);
        }
        return c.json({
            success: true,
            message: 'Shirt deleted successfully',
        });
    }
    catch (error) {
        return c.json({
            success: false,
            message: error.message || 'Failed to delete shirt',
        }, 500);
    }
};
