import mongoose from 'mongoose';
import { User, UserType, Shirt, ShirtType, SizeReference, ShirtSize } from '../models/index.js';
import { initializeReferenceCache } from '../services/reference-cache.service.js';
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
        // Clean up old ShirtSize collection/indexes before creating new ones
        // This handles migration from old model structure
        try {
            const db = mongoose.connection.db;
            if (!db) {
                console.warn('⚠️  Database connection not ready, skipping cleanup');
            }
            else {
                const collections = await db.listCollections({ name: 'shirtsizes' }).toArray();
                if (collections.length > 0) {
                    // Drop old indexes that might conflict
                    const collection = db.collection('shirtsizes');
                    try {
                        await collection.dropIndexes();
                        console.log('🗑️  Dropped old ShirtSize indexes');
                    }
                    catch (error) {
                        // Ignore errors if indexes don't exist
                        if (error.code !== 27 && error.codeName !== 'IndexNotFound') {
                            console.warn('⚠️  Could not drop old indexes:', error.message);
                        }
                    }
                    // Delete documents with null values or old structure
                    const deletedCount = await collection.deleteMany({
                        $or: [
                            { shirtId: null },
                            { sizeReferenceId: null },
                            { name: { $exists: true } }, // Old structure had 'name' field
                        ],
                    });
                    if (deletedCount.deletedCount > 0) {
                        console.log(`🗑️  Cleaned up ${deletedCount.deletedCount} old ShirtSize documents`);
                    }
                }
            }
        }
        catch (error) {
            // Collection might not exist yet, ignore error
            if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') {
                console.warn('⚠️  Cleanup warning:', error.message);
            }
        }
        await Promise.all([
            User.createIndexes(),
            UserType.createIndexes(),
            Shirt.createIndexes(),
            ShirtType.createIndexes(),
            SizeReference.createIndexes(),
            ShirtSize.createIndexes(),
        ]);
        console.log('✅ Database indexes ensured');
        // Initialize reference data cache for fast filter lookups
        try {
            await initializeReferenceCache();
        }
        catch (error) {
            console.warn('⚠️  Failed to initialize reference cache:', error);
            // Don't throw - cache is optional, app can still work
        }
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
