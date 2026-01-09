import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Seller } from '../models/Seller.js';
import { Shirt } from '../models/Shirt.js';
/**
 * Seed script to populate database with initial data
 * Run with: npm run seed
 *
 * This is optional - you don't need to run this unless you want test data
 */
const seed = async () => {
    try {
        // Connect to database
        await connectDatabase();
        // Clear existing data (optional - remove if you want to keep existing data)
        await Seller.deleteMany({});
        await Shirt.deleteMany({});
        console.log('🗑️  Cleared existing data');
        // Create test seller
        const seller = new Seller({
            email: 'seller@example.com',
            password: 'password123', // Will be hashed automatically by pre-save hook
            name: 'Test Seller',
        });
        await seller.save();
        console.log('✅ Created test seller:', seller.email);
        // Helper function to calculate finalPrice (same logic as pre-save hook)
        // insertMany() bypasses middleware, so we need to calculate manually
        const calculateFinalPrice = (price, discount) => {
            let finalPrice = price;
            if (discount) {
                if (discount.type === 'amount') {
                    finalPrice = Math.max(0, price - discount.value);
                }
                else if (discount.type === 'percentage') {
                    finalPrice = Math.max(0, price * (1 - discount.value / 100));
                }
            }
            return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
        };
        // Create sample shirts
        const shirtData = [
            {
                sellerId: seller._id,
                name: 'Classic White Formal Shirt',
                description: 'Perfect for business meetings and formal occasions',
                size: 'L',
                type: 'Formal',
                price: 2500,
                discount: { type: 'percentage', value: 10 },
                stock: 50,
            },
            {
                sellerId: seller._id,
                name: 'Casual Blue Denim Shirt',
                description: 'Comfortable everyday wear',
                size: 'M',
                type: 'Casual',
                price: 1800,
                discount: { type: 'amount', value: 200 },
                stock: 30,
            },
            {
                sellerId: seller._id,
                name: 'Elegant Wedding Shirt',
                description: 'Premium quality for special occasions',
                size: 'XL',
                type: 'Wedding',
                price: 4500,
                stock: 20,
            },
            {
                sellerId: seller._id,
                name: 'Sporty Performance Shirt',
                description: 'Moisture-wicking fabric for active wear',
                size: 'L',
                type: 'Sports',
                price: 2200,
                discount: { type: 'percentage', value: 15 },
                stock: 40,
            },
            {
                sellerId: seller._id,
                name: 'Vintage Retro Shirt',
                description: 'Classic style with modern comfort',
                size: 'M',
                type: 'Vintage',
                price: 1900,
                stock: 25,
            },
        ];
        // Calculate finalPrice for each shirt and create documents
        const shirts = shirtData.map((data) => ({
            ...data,
            finalPrice: calculateFinalPrice(data.price, data.discount),
        }));
        const createdShirts = await Shirt.insertMany(shirts);
        console.log(`✅ Created ${createdShirts.length} sample shirts`);
        console.log('\n🎉 Seeding completed successfully!');
        console.log('\nTest credentials:');
        console.log('Email: seller@example.com');
        console.log('Password: password123');
    }
    catch (error) {
        console.error('❌ Seeding error:', error);
        throw error;
    }
    finally {
        await disconnectDatabase();
    }
};
// Run seed script
seed()
    .then(() => {
    console.log('✅ Seed script completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
});
export { seed };
