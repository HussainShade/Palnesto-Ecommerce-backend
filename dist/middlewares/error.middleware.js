/**
 * Global error handler middleware
 * Catches unhandled errors and returns consistent error response
 */
export const errorHandler = (error, c) => {
    console.error('Unhandled error:', error);
    return c.json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
    }, 500);
};
/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (c) => {
    return c.json({
        success: false,
        message: 'Route not found',
    }, 404);
};
