import mongoose, { Schema, Document } from 'mongoose';

/**
 * Shirt size enum
 */
export type ShirtSize = 'M' | 'L' | 'XL' | 'XXL';

/**
 * Shirt type enum
 */
export type ShirtType = 'Casual' | 'Formal' | 'Wedding' | 'Sports' | 'Vintage';

/**
 * Discount type - can be fixed amount or percentage
 */
export interface IDiscount {
  type: 'amount' | 'percentage';
  value: number;
}

/**
 * Shirt document interface
 */
export interface IShirt extends Document {
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  size: ShirtSize;
  type: ShirtType;
  price: number;
  discount?: IDiscount;
  finalPrice: number; // Computed field
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shirt schema with computed finalPrice
 * Includes indexes for efficient filtering and sorting
 */
const shirtSchema = new Schema<IShirt>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true, // Indexed for seller-specific queries
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
    size: {
      type: String,
      enum: ['M', 'L', 'XL', 'XXL'],
      required: true,
      index: true, // Indexed for size filtering
    },
    type: {
      type: String,
      enum: ['Casual', 'Formal', 'Wedding', 'Sports', 'Vintage'],
      required: true,
      index: true, // Indexed for type filtering
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
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
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
      index: true, // Indexed for price range filtering and sorting
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Computes finalPrice before saving
 * Handles both amount and percentage discounts
 * Runs before validation to ensure finalPrice is always set
 */
shirtSchema.pre('save', function () {
  // Always calculate finalPrice if price exists (for both new and updated documents)
  if (this.price !== undefined) {
    let finalPrice = this.price;

    if (this.discount) {
      if (this.discount.type === 'amount') {
        finalPrice = Math.max(0, this.price - this.discount.value);
      } else if (this.discount.type === 'percentage') {
        finalPrice = Math.max(0, this.price * (1 - this.discount.value / 100));
      }
    }

    this.finalPrice = Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
  }
});

/**
 * Compound index for common query patterns
 * Optimizes queries that filter by size, type, and price range
 */
shirtSchema.index({ size: 1, type: 1, finalPrice: 1 });

export const Shirt = mongoose.model<IShirt>('Shirt', shirtSchema);

