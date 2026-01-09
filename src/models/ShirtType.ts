import mongoose, { Schema, Document } from 'mongoose';

/**
 * ShirtType document interface
 * Defines different types of shirts (e.g., Casual, Formal, Wedding)
 */
export interface IShirtType extends Document {
  name: string; // e.g., 'Casual', 'Formal', 'Wedding', 'Sports', 'Vintage'
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ShirtType schema
 * Stores different shirt types for scalability (replaces enum)
 */
const shirtTypeSchema = new Schema<IShirtType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ShirtType = mongoose.model<IShirtType>('ShirtType', shirtTypeSchema);
