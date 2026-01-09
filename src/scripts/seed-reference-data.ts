/**
 * Seed script for reference data (UserTypes, ShirtTypes, ShirtSizes)
 * Run this before using the new model structure
 * Run with: tsx src/scripts/seed-reference-data.ts
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserType } from '../models/UserType.js';
import { ShirtType } from '../models/ShirtType.js';
import { SizeReference } from '../models/SizeReference.js';

const seedReferenceData = async () => {
  try {
    await connectDatabase();

    console.log('🌱 Seeding reference data...\n');

    // Clear existing reference data before seeding
    console.log('🗑️  Clearing existing reference data...');
    await UserType.deleteMany({});
    await ShirtType.deleteMany({});
    await SizeReference.deleteMany({});
    console.log('✅ Cleared existing reference data\n');

    // Seed UserTypes
    console.log('📝 Creating UserTypes...');
    const userTypes = [
      { name: 'Seller', description: 'Product seller' },
      { name: 'Admin', description: 'Administrator' },
      { name: 'Customer', description: 'Regular customer' },
    ];

    for (const userTypeData of userTypes) {
      const existing = await UserType.findOne({ name: userTypeData.name });
      if (!existing) {
        await UserType.create(userTypeData);
        console.log(`  ✅ Created UserType: ${userTypeData.name}`);
      } else {
        console.log(`  ⏭️  UserType already exists: ${userTypeData.name}`);
      }
    }

    // Seed ShirtTypes
    console.log('\n📝 Creating ShirtTypes...');
    const shirtTypes = [
      { name: 'Casual', description: 'Casual wear' },
      { name: 'Formal', description: 'Formal attire' },
      { name: 'Wedding', description: 'Wedding attire' },
      { name: 'Sports', description: 'Sports wear' },
      { name: 'Vintage', description: 'Vintage style' },
    ];

    for (const shirtTypeData of shirtTypes) {
      const existing = await ShirtType.findOne({ name: shirtTypeData.name });
      if (!existing) {
        await ShirtType.create(shirtTypeData);
        console.log(`  ✅ Created ShirtType: ${shirtTypeData.name}`);
      } else {
        console.log(`  ⏭️  ShirtType already exists: ${shirtTypeData.name}`);
      }
    }

    // Seed SizeReferences
    console.log('\n📝 Creating SizeReferences...');
    const sizeReferences = [
      { name: 'M', displayName: 'Medium', order: 0 },
      { name: 'L', displayName: 'Large', order: 1 },
      { name: 'XL', displayName: 'Extra Large', order: 2 },
      { name: 'XXL', displayName: 'Double Extra Large', order: 3 },
    ];

    for (const sizeRefData of sizeReferences) {
      const existing = await SizeReference.findOne({ name: sizeRefData.name });
      if (!existing) {
        await SizeReference.create(sizeRefData);
        console.log(`  ✅ Created SizeReference: ${sizeRefData.name} (${sizeRefData.displayName})`);
      } else {
        console.log(`  ⏭️  SizeReference already exists: ${sizeRefData.name}`);
      }
    }

    console.log('\n🎉 Reference data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
};

seedReferenceData()
  .then(() => {
    console.log('✅ Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
  });
