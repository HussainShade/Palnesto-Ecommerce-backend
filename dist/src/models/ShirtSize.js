import mongoose, { Schema, Document } from 'mongoose';
/**
 * ShirtSize schema
 * Each entry represents a size variant of a shirt with its own price and image
 * Discount is inherited from the parent Shirt model
 */
const shirtSizeSchema = new Schema({
    shirtId: {
        type: Schema.Types.ObjectId,
        ref: 'Shirt',
        required: true,
        index: true, // Indexed for shirt-specific queries
    },
    sizeReferenceId: {
        type: Schema.Types.ObjectId,
        ref: 'SizeReference',
        required: true,
        index: true, // Indexed for size filtering
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        max: 10000,
    },
    imageURL: {
        type: String,
        trim: true,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    finalPrice: {
        type: Number,
        required: true,
        min: 0,
        index: true, // Indexed for price range filtering and sorting
    },
}, {
    timestamps: true,
});
/**
 * Computes finalPrice before saving
 * Applies discount from parent Shirt to this size's price
 * Runs before validation to ensure finalPrice is always set
 */
shirtSizeSchema.pre('save', async function () {
    if (this.price !== undefined && this.shirtId) {
        // Fetch the parent shirt to get discount
        const Shirt = mongoose.model('Shirt');
        const shirt = await Shirt.findById(this.shirtId);
        let finalPrice = this.price;
        if (shirt && shirt.discount) {
            const discount = shirt.discount;
            if (discount.type === 'amount') {
                finalPrice = Math.max(0, this.price - discount.value);
            }
            else if (discount.type === 'percentage') {
                finalPrice = Math.max(0, this.price * (1 - discount.value / 100));
            }
        }
        this.finalPrice = Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
    }
    else if (this.price !== undefined) {
        // If no shirtId yet, just use price as finalPrice (will be recalculated on update)
        this.finalPrice = this.price;
    }
});
/**
 * Compound index for common query patterns
 * Optimizes queries that filter by size and price range
 */
shirtSizeSchema.index({ sizeReferenceId: 1, finalPrice: 1 });
// Unique index: one size per shirt (sparse to allow null values during migration)
shirtSizeSchema.index({ shirtId: 1, sizeReferenceId: 1 }, { unique: true, sparse: true });
export const ShirtSize = mongoose.model('ShirtSize', shirtSizeSchema);
