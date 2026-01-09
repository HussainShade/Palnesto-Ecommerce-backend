import mongoose, { Schema, Document } from 'mongoose';

/**
 * SizeReference document interface
 * Reference table for available shirt sizes (e.g., M, L, XL, XXL)
 * This is a lookup table, not the actual size variants
 */
export interface ISizeReference extends Document {
  name: string; // e.g., 'M', 'L', 'XL', 'XXL'
  displayName: string; // e.g., 'Medium', 'Large'
  order: number; // For consistent sorting (e.g., M=0, L=1)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SizeReference schema
 * Stores different shirt size names for reference
 */
const sizeReferenceSchema = new Schema<ISizeReference>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SizeReference = mongoose.model<ISizeReference>('SizeReference', sizeReferenceSchema);
