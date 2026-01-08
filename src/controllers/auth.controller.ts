import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { authenticateSeller, generateToken } from '../services/auth.service.js';
import { loginSchema } from '../validators/auth.validator.js';

/**
 * Handles seller login
 * Sets JWT token in HTTP-only cookie for security
 */
export const login = async (c: Context) => {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);

    const seller = await authenticateSeller(
      validatedData.email,
      validatedData.password
    );

    const token = generateToken({
      sellerId: seller._id.toString(),
      email: seller.email,
    });

    // Set HTTP-only cookie for security
    // SameSite=Strict prevents CSRF attacks
    // Secure=true in production (requires HTTPS)
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return c.json({
      success: true,
      message: 'Login successful',
      data: {
        seller: {
          id: seller._id,
          email: seller.email,
          name: seller.name,
        },
        token: token, // Include token in response for testing (also set as HTTP-only cookie)
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
 * Handles seller logout
 * Clears the authentication cookie
 */
export const logout = async (c: Context) => {
  setCookie(c, 'auth_token', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });

  return c.json({
    success: true,
    message: 'Logout successful',
  });
};

