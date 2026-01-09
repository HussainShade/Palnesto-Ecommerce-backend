import mongoose, { Schema, Document } from 'mongoose';

/**
 * Discount type - can be fixed amount or percentage
 */
export interface IDiscount {
  type: 'amount' | 'percentage';
  value: number;
}

/**
 * Shirt document interface
 * Represents a shirt design/product
 * Price and imageURL are now in ShirtSize (varies by size)
 * Discount is common to all sizes of this shirt
 */
export interface IShirt extends Document {
  userId: mongoose.Types.ObjectId; // Foreign key to User (replaces sellerId)
  name: string;
  description?: string;
  shirtTypeId: mongoose.Types.ObjectId; // Foreign key to ShirtType
  discount?: IDiscount; // Common discount applied to all size variants
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shirt schema
 * Represents a shirt design/product
 * Price, imageURL, and stock are now in ShirtSize model (varies by size)
 * Discount is common to all sizes of this shirt
 */
const shirtSchema = new Schema<IShirt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Indexed for user-specific queries
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    shirtTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'ShirtType',
      required: true,
      index: true, // Indexed for type filtering
    },
    discount: {
      type: {
        type: String,
        enum: ['amount', 'percentage'],
      },
      value: {
        type: Number,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index for common query patterns
 * Optimizes queries that filter by user and type
 */
shirtSchema.index({ userId: 1, shirtTypeId: 1 });

export const Shirt = mongoose.model<IShirt>('Shirt', shirtSchema);

