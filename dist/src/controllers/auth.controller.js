import { setCookie } from 'hono/cookie';
import { authenticateSeller, authenticateCustomer, createUser, generateToken } from '../services/auth.service.js';
import { loginSchema, signupSchema } from '../validators/auth.validator.js';
/**
 * Handles seller login
 * Sets JWT token in HTTP-only cookie for security
 */
export const login = async (c) => {
    try {
        const body = await c.req.json();
        const validatedData = loginSchema.parse(body);
        const user = await authenticateSeller(validatedData.email, validatedData.password);
        const token = generateToken({
            userId: user._id.toString(),
            sellerId: user._id.toString(), // For backward compatibility
            email: user.email,
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
                    id: user._id,
                    email: user.email,
                    name: user.name,
                },
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                },
                token: token, // Include token in response for testing (also set as HTTP-only cookie)
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
            message: error.message || 'Login failed',
        }, 401);
    }
};
/**
 * Handles customer signup
 * Creates a new customer account
 */
export const customerSignup = async (c) => {
    try {
        const body = await c.req.json();
        const validatedData = signupSchema.parse(body);
        // Ensure userType is Customer for customer signup
        const user = await createUser(validatedData.email, validatedData.password, validatedData.name, 'Customer');
        // Generate token for immediate login after signup
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
            message: 'Customer account created successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                },
                token, // Include token in response for testing
            },
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
            message: error.message || 'Signup failed',
        }, error.message?.includes('already exists') ? 409 : 500);
    }
};
/**
 * Handles customer login
 * Sets JWT token in HTTP-only cookie for security
 */
export const customerLogin = async (c) => {
    try {
        const body = await c.req.json();
        const validatedData = loginSchema.parse(body);
        const user = await authenticateCustomer(validatedData.email, validatedData.password);
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
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                },
                token, // Include token in response for testing
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
            message: error.message || 'Login failed',
        }, 401);
    }
};
/**
 * Handles seller logout
 * Clears the authentication cookie
 */
export const logout = async (c) => {
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
