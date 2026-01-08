import { Hono } from 'hono';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createShirtHandler,
  updateShirtHandler,
  getShirtHandler,
  listShirtsHandler,
  deleteShirtHandler,
} from '../controllers/shirt.controller.js';

/**
 * Shirt routes
 * GET endpoints are public (anyone can view shirts)
 * POST, PUT, DELETE require authentication (only sellers can modify)
 */
const shirtRoutes = new Hono();

// Public routes - no authentication required
shirtRoutes.get('/', listShirtsHandler);
shirtRoutes.get('/:id', getShirtHandler);

// Protected routes - require authentication
shirtRoutes.use('/*', authMiddleware);
shirtRoutes.post('/', createShirtHandler);
shirtRoutes.put('/:id', updateShirtHandler);
shirtRoutes.delete('/:id', deleteShirtHandler);

export default shirtRoutes;

