import mongoose from 'mongoose';
import { Seller } from '../models/Seller.js';
import { Shirt } from '../models/Shirt.js';
/**
 * Establishes connection to MongoDB
 * Uses connection pooling and proper error handling for production
 * Ensures indexes are created after connection
 */
export const connectDatabase = async () => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }
    try {
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB connected successfully');
        // Ensure indexes are created
        // Mongoose creates indexes automatically, but this ensures they exist
        // Collections are created automatically when first document is saved
        await Promise.all([
            Seller.createIndexes(),
            Shirt.createIndexes(),
        ]);
        console.log('✅ Database indexes ensured');
    }
    catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
};
/**
 * Gracefully closes MongoDB connection
 */
export const disconnectDatabase = async () => {
    try {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected');
    }
    catch (error) {
        console.error('❌ MongoDB disconnection error:', error);
        throw error;
    }
};
