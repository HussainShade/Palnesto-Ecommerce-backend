import mongoose, { Schema, Document } from 'mongoose';
/**
 * SizeReference schema
 * Stores different shirt size names for reference
 */
const sizeReferenceSchema = new Schema({
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
}, {
    timestamps: true,
});
export const SizeReference = mongoose.model('SizeReference', sizeReferenceSchema);
