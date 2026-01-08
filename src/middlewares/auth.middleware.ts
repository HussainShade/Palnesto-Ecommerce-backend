import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyToken } from '../services/auth.service.js';

/**
 * Authentication middleware
 * Verifies JWT token from HTTP-only cookie
 * Attaches sellerId to context for use in controllers
 */
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    const token = getCookie(c, 'auth_token');

    if (!token) {
      return c.json(
        {
          success: false,
          message: 'Authentication required',
        },
        401
      );
    }

    const payload = verifyToken(token);
    c.set('sellerId', payload.sellerId);
    c.set('sellerEmail', payload.email);

    await next();
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Invalid or expired token',
      },
      401
    );
  }
};

