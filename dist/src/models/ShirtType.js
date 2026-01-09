import mongoose, { Schema, Document } from 'mongoose';
/**
 * ShirtType schema
 * Stores different shirt types for scalability (replaces enum)
 */
const shirtTypeSchema = new Schema({
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
export const ShirtType = mongoose.model('ShirtType', shirtTypeSchema);
