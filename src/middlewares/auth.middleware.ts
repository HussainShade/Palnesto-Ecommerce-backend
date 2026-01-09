import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyToken } from '../services/auth.service.js';

/**
 * Authentication middleware
 * Verifies JWT token from HTTP-only cookie
 * Attaches userId to context for use in controllers
 * Also sets sellerId for backward compatibility
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
    // Set userId (new structure)
    c.set('userId', payload.userId || payload.sellerId); // Support both for migration
    // Keep sellerId for backward compatibility during migration
    c.set('sellerId', payload.userId || payload.sellerId);
    c.set('userEmail', payload.email);
    c.set('sellerEmail', payload.email); // Backward compatibility

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

