import { Hono } from 'hono';
import { login, logout } from '../controllers/auth.controller.js';
/**
 * Authentication routes
 * Public endpoints for seller login/logout
 */
const authRoutes = new Hono();
authRoutes.post('/login', login);
authRoutes.post('/logout', logout);
export default authRoutes;
