import { Hono } from 'hono';
import { login, logout, customerSignup, customerLogin } from '../controllers/auth.controller.js';

/**
 * Authentication routes
 * Public endpoints for seller and customer authentication
 */
const authRoutes = new Hono();

// Seller routes
authRoutes.post('/seller/login', login);
authRoutes.post('/seller/logout', logout);

// Customer routes
authRoutes.post('/customer/signup', customerSignup);
authRoutes.post('/customer/login', customerLogin);
authRoutes.post('/customer/logout', logout);

// Legacy routes (backward compatibility)
authRoutes.post('/login', login);
authRoutes.post('/logout', logout);

export default authRoutes;

