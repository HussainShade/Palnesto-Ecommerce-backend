import { Hono } from 'hono';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminMiddleware } from '../middlewares/admin.middleware.js';
import { adminLogin, createSeller } from '../controllers/admin.controller.js';
/**
 * Admin routes
 * Protected endpoints for administrator operations
 */
const adminRoutes = new Hono();
// Public admin login endpoint
adminRoutes.post('/login', adminLogin);
// Protected admin endpoints (require authentication + admin role)
adminRoutes.use('/*', authMiddleware); // First check authentication
adminRoutes.use('/*', adminMiddleware); // Then check admin role
// Seller management
adminRoutes.post('/sellers', createSeller);
export default adminRoutes;
