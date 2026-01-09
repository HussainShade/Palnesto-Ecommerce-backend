import type { Context } from 'hono';
import {
  createShirtSchema,
  updateShirtSchema,
  listShirtsSchema,
  batchCreateShirtSchema,
} from '../validators/shirt.validator.js';
import {
  createShirt,
  updateShirt,
  getShirtById,
  listShirts,
  deleteShirt,
  batchCreateShirts,
} from '../services/shirt.service.js';

/**
 * Creates a new shirt
 * Requires authenticated seller
 */
export const createShirtHandler = async (c: Context) => {
  try {
    const userId = c.get('userId') as string; // Changed from sellerId to userId
    const body = await c.req.json();
    const validatedData = createShirtSchema.parse(body);

    const result = await createShirt(userId, validatedData);

    return c.json(
      {
        success: true,
        message: 'Shirt created successfully',
        data: { 
          shirt: result.shirt,
          shirtSize: result.shirtSize,
        },
      },
      201
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json(
        {
          success: false,
          message: 'Validation error',
          errors: error.errors,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        message: error.message || 'Failed to create shirt',
      },
      500
    );
  }
};

/**
 * Creates multiple shirts in batch with different sizes and stocks
 * Requires authenticated seller
 */
export const batchCreateShirtsHandler = async (c: Context) => {
  try {
    const userId = c.get('userId') as string; // Changed from sellerId to userId
    const body = await c.req.json();
    const validatedData = batchCreateShirtSchema.parse(body);

    const result = await batchCreateShirts(userId, validatedData);

    return c.json(
      {
        success: true,
        message: `Successfully created ${result.shirtSizes.length} size variant(s)`,
        data: { 
          shirt: result.shirt,
          shirtSizes: result.shirtSizes,
        },
      },
      201
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json(
        {
          success: false,
          message: 'Validation error',
          errors: error.errors,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        message: error.message || 'Failed to create shirts',
      },
      500
    );
  }
};

/**
 * Updates an existing shirt
 * Only allows seller to update their own shirts
 */
export const updateShirtHandler = async (c: Context) => {
  try {
    const userId = c.get('userId') as string; // Changed from sellerId to userId
    const shirtId = c.req.param('id');
    const body = await c.req.json();
    const validatedData = updateShirtSchema.parse(body);

    const result = await updateShirt(shirtId, userId, validatedData);

    if (!result) {
      return c.json(
        {
          success: false,
          message: 'Shirt not found or unauthorized',
        },
        404
      );
    }

    const { shirt, updatedShirtSizes, createdShirtSizes, updatedCount, createdCount } = result;

    // Build response message
    let message = 'Shirt updated successfully';
    const messageParts: string[] = [];
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
        updatedShirtSizes,
        createdShirtSizes,
        updatedCount,
        createdCount,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json(
        {
          success: false,
          message: 'Validation error',
          errors: error.errors,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        message: error.message || 'Failed to update shirt',
      },
      500
    );
  }
};

/**
 * Retrieves a single shirt by ID
 */
export const getShirtHandler = async (c: Context) => {
  try {
    const shirtId = c.req.param('id');
    const result = await getShirtById(shirtId);

    if (!result) {
      return c.json(
        {
          success: false,
          message: 'Shirt not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: { 
        shirt: result.shirt,
        shirtSizes: result.shirtSizes, // All variants including stock = 0
        sizes: result.shirtSizes, // Alias for backward compatibility
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Failed to retrieve shirt',
      },
      500
    );
  }
};

/**
 * Lists shirts with filtering and pagination
 * Uses Redis caching for performance
 */
export const listShirtsHandler = async (c: Context) => {
  try {
    const queryParams = c.req.query();
    const validatedData = listShirtsSchema.parse(queryParams);

    const result = await listShirts(validatedData);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json(
        {
          success: false,
          message: 'Validation error',
          errors: error.errors,
        },
        400
      );
    }

    // Handle filter resolution errors (invalid size/type)
    if (error.message?.includes('Invalid size') || error.message?.includes('Invalid shirt type')) {
      return c.json(
        {
          success: false,
          message: error.message || 'Invalid filter parameters',
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        message: error.message || 'Failed to retrieve shirts',
      },
      500
    );
  }
};

/**
 * Deletes a shirt
 * Only allows seller to delete their own shirts
 */
export const deleteShirtHandler = async (c: Context) => {
  try {
    const userId = c.get('userId') as string; // Changed from sellerId to userId
    const shirtId = c.req.param('id');

    const deleted = await deleteShirt(shirtId, userId);

    if (!deleted) {
      return c.json(
        {
          success: false,
          message: 'Shirt not found or unauthorized',
        },
        404
      );
    }

    return c.json({
      success: true,
      message: 'Shirt deleted successfully',
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Failed to delete shirt',
      },
      500
    );
  }
};

