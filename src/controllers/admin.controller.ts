import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { authenticateAdmin, createUser, generateToken } from '../services/auth.service.js';
import { loginSchema, createSellerSchema } from '../validators/auth.validator.js';

/**
 * Handles admin login
 * Sets JWT token in HTTP-only cookie for security
 */
export const adminLogin = async (c: Context) => {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);

    const user = await authenticateAdmin(
      validatedData.email,
      validatedData.password
    );

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
    });

    // Set HTTP-only cookie
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return c.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        token, // Include token in response for testing
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
        message: error.message || 'Login failed',
      },
      401
    );
  }
};

/**
 * Creates a new seller account
 * Only accessible by administrators
 */
export const createSeller = async (c: Context) => {
  try {
    const body = await c.req.json();
    const validatedData = createSellerSchema.parse(body);

    // Create seller user
    const seller = await createUser(
      validatedData.email,
      validatedData.password,
      validatedData.name,
      'Seller'
    );

    return c.json(
      {
        success: true,
        message: 'Seller account created successfully',
        data: {
          seller: {
            id: seller._id,
            email: seller.email,
            name: seller.name,
          },
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
        message: error.message || 'Failed to create seller',
      },
      error.message?.includes('already exists') ? 409 : 500
    );
  }
};
