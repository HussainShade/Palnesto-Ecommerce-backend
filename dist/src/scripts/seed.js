import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User, UserType, Shirt, ShirtType, SizeReference, ShirtSize } from '../models/index.js';
/**
 * Seed script to populate database with initial data
 * Run with: npm run seed
 *
 * This is optional - you don't need to run this unless you want test data
 * Note: Make sure to run seed-reference-data.ts first to create reference data
 */
const seed = async () => {
    try {
        // Connect to database
        await connectDatabase();
        // Ensure reference data exists (UserTypes, ShirtTypes, ShirtSizes)
        console.log('📋 Checking reference data...');
        // Get or create Seller UserType
        let sellerType = await UserType.findOne({ name: 'Seller' });
        if (!sellerType) {
            sellerType = await UserType.create({ name: 'Seller', description: 'Product seller' });
            console.log('  ✅ Created UserType: Seller');
        }
        // Get or create Admin UserType
        let adminType = await UserType.findOne({ name: 'Admin' });
        if (!adminType) {
            adminType = await UserType.create({ name: 'Admin', description: 'Administrator with full access' });
            console.log('  ✅ Created UserType: Admin');
        }
        // Get ShirtTypes
        const shirtTypes = await ShirtType.find({ isActive: true });
        if (shirtTypes.length === 0) {
            throw new Error('No ShirtTypes found. Please run seed-reference-data.ts first.');
        }
        const shirtTypeMap = new Map(shirtTypes.map(st => [st.name, st._id]));
        // Get SizeReferences (reference table for sizes)
        const sizeReferences = await SizeReference.find({ isActive: true }).sort({ order: 1 });
        if (sizeReferences.length === 0) {
            throw new Error('No SizeReferences found. Please run seed-reference-data.ts first.');
        }
        const sizeReferenceMap = new Map(sizeReferences.map(sr => [sr.name, sr._id]));
        console.log('  ✅ Reference data ready\n');
        // Clear existing data before seeding
        console.log('🗑️  Clearing existing collections...');
        await User.deleteMany({});
        await Shirt.deleteMany({});
        await ShirtSize.deleteMany({});
        console.log('✅ Cleared existing data\n');
        // Create test admin user
        const admin = new User({
            email: 'admin@example.com',
            password: 'admin123', // Will be hashed automatically by pre-save hook
            name: 'Administrator',
            userTypeId: adminType._id,
        });
        await admin.save();
        console.log('✅ Created test admin user:', admin.email);
        // Create test user (seller)
        const user = new User({
            email: 'seller@example.com',
            password: 'password123', // Will be hashed automatically by pre-save hook
            name: 'Test Seller',
            userTypeId: sellerType._id,
        });
        await user.save();
        console.log('✅ Created test user (seller):', user.email);
        // Helper function to calculate finalPrice (same logic as pre-save hook)
        // Applies discount from Shirt to ShirtSize price
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
        // Create sample shirts with new structure (Shirt + ShirtSize)
        const shirtData = [
            {
                userId: user._id,
                name: 'Classic White Formal Shirt',
                description: 'Perfect for business meetings and formal occasions',
                shirtTypeId: shirtTypeMap.get('Formal'),
                discount: { type: 'percentage', value: 10 },
                sizes: [
                    { sizeRefName: 'L', price: 2500, stock: 50 },
                ],
            },
            {
                userId: user._id,
                name: 'Casual Blue Denim Shirt',
                description: 'Comfortable everyday wear',
                shirtTypeId: shirtTypeMap.get('Casual'),
                discount: { type: 'amount', value: 200 },
                sizes: [
                    { sizeRefName: 'M', price: 1800, stock: 30 },
                    { sizeRefName: 'L', price: 1900, stock: 25 },
                ],
            },
            {
                userId: user._id,
                name: 'Elegant Wedding Shirt',
                description: 'Premium quality for special occasions',
                shirtTypeId: shirtTypeMap.get('Wedding'),
                sizes: [
                    { sizeRefName: 'XL', price: 4500, stock: 20 },
                ],
            },
            {
                userId: user._id,
                name: 'Sporty Performance Shirt',
                description: 'Moisture-wicking fabric for active wear',
                shirtTypeId: shirtTypeMap.get('Sports'),
                discount: { type: 'percentage', value: 15 },
                sizes: [
                    { sizeRefName: 'L', price: 2200, stock: 40 },
                    { sizeRefName: 'XL', price: 2300, stock: 35 },
                ],
            },
            {
                userId: user._id,
                name: 'Vintage Retro Shirt',
                description: 'Classic style with modern comfort',
                shirtTypeId: shirtTypeMap.get('Vintage'),
                sizes: [
                    { sizeRefName: 'M', price: 1900, stock: 25 },
                    { sizeRefName: 'L', price: 2000, stock: 20 },
                ],
            },
        ];
        // Create shirts and their size variants
        let totalShirts = 0;
        let totalShirtSizes = 0;
        const imageURL = 'https://fastly.picsum.photos/id/193/200/200.jpg?hmac=JHo5tWHSRWvVbL3HX6rwDNdkvYPFojLtXkEGEUCgz6A';
        for (const data of shirtData) {
            // Create Shirt first
            const shirt = new Shirt({
                userId: data.userId,
                name: data.name,
                description: data.description,
                shirtTypeId: data.shirtTypeId,
                discount: data.discount,
            });
            await shirt.save();
            totalShirts++;
            // Create ShirtSize entries for each size variant
            for (const sizeData of data.sizes) {
                const sizeRefId = sizeReferenceMap.get(sizeData.sizeRefName);
                if (!sizeRefId) {
                    console.warn(`⚠️  SizeReference '${sizeData.sizeRefName}' not found, skipping...`);
                    continue;
                }
                const finalPrice = calculateFinalPrice(sizeData.price, data.discount);
                const shirtSize = new ShirtSize({
                    shirtId: shirt._id,
                    sizeReferenceId: sizeRefId,
                    price: sizeData.price,
                    imageURL,
                    stock: sizeData.stock,
                    finalPrice,
                });
                await shirtSize.save();
                totalShirtSizes++;
            }
        }
        console.log(`✅ Created ${totalShirts} shirts with ${totalShirtSizes} size variants`);
        console.log('\n🎉 Seeding completed successfully!');
        console.log('\nTest credentials:');
        console.log('\nAdministrator:');
        console.log('  Email: admin@example.com');
        console.log('  Password: admin123');
        console.log('\nSeller:');
        console.log('  Email: seller@example.com');
        console.log('  Password: password123');
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
