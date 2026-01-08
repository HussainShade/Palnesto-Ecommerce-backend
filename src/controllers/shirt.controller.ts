import type { Context } from 'hono';
import {
  createShirtSchema,
  updateShirtSchema,
  listShirtsSchema,
} from '../validators/shirt.validator.js';
import {
  createShirt,
  updateShirt,
  getShirtById,
  listShirts,
  deleteShirt,
} from '../services/shirt.service.js';

/**
 * Creates a new shirt
 * Requires authenticated seller
 */
export const createShirtHandler = async (c: Context) => {
  try {
    const sellerId = c.get('sellerId') as string;
    const body = await c.req.json();
    const validatedData = createShirtSchema.parse(body);

    const shirt = await createShirt(sellerId, validatedData);

    return c.json(
      {
        success: true,
        message: 'Shirt created successfully',
        data: { shirt },
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
 * Updates an existing shirt
 * Only allows seller to update their own shirts
 */
export const updateShirtHandler = async (c: Context) => {
  try {
    const sellerId = c.get('sellerId') as string;
    const shirtId = c.req.param('id');
    const body = await c.req.json();
    const validatedData = updateShirtSchema.parse(body);

    const shirt = await updateShirt(shirtId, sellerId, validatedData);

    if (!shirt) {
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
      message: 'Shirt updated successfully',
      data: { shirt },
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
    const shirt = await getShirtById(shirtId);

    if (!shirt) {
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
      data: { shirt },
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
    const sellerId = c.get('sellerId') as string;
    const shirtId = c.req.param('id');

    const deleted = await deleteShirt(shirtId, sellerId);

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

