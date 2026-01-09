import mongoose, { Schema, Document } from 'mongoose';

/**
 * UserType document interface
 * Defines different types of users (e.g., Seller, Admin, Customer)
 */
export interface IUserType extends Document {
  name: string; // e.g., 'Seller', 'Admin', 'Customer'
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserType schema
 * Stores different user roles/types for scalability
 */
const userTypeSchema = new Schema<IUserType>(
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

export const UserType = mongoose.model<IUserType>('UserType', userTypeSchema);
