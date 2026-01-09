import mongoose, { Schema, Document } from 'mongoose';
/**
 * UserType schema
 * Stores different user roles/types for scalability
 */
const userTypeSchema = new Schema({
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
}, {
    timestamps: true,
});
export const UserType = mongoose.model('UserType', userTypeSchema);
