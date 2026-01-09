import type { Context, Next } from 'hono';
import { User } from '../models/User.js';

/**
 * Admin authorization middleware
 * Verifies that the authenticated user is an admin
 * Must be used after authMiddleware
 */
export const adminMiddleware = async (c: Context, next: Next) => {
  try {
    const userId = c.get('userId') as string;

    if (!userId) {
      return c.json(
        {
          success: false,
          message: 'Authentication required',
        },
        401
      );
    }

    // Fetch user with populated userTypeId to check role
    const user = await User.findById(userId).populate('userTypeId');
    
    if (!user) {
      return c.json(
        {
          success: false,
          message: 'User not found',
        },
        404
      );
    }

    // Check if user is admin
    const userType = user.userTypeId as any;
    if (!userType || userType.name !== 'Admin') {
      return c.json(
        {
          success: false,
          message: 'Access denied. Administrator privileges required.',
        },
        403
      );
    }

    // Set admin flag in context for use in controllers
    c.set('isAdmin', true);
    c.set('adminId', userId);

    await next();
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || 'Authorization failed',
      },
      500
    );
  }
};
