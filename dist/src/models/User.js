import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
/**
 * User schema with password hashing
 * Uses foreign key to UserType instead of implicit role
 */
const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true, // Indexed for faster login queries
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    userTypeId: {
        type: Schema.Types.ObjectId,
        ref: 'UserType',
        required: true,
        index: true, // Indexed for user type filtering
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
/**
 * Hash password before saving
 * Runs on every save/create operation
 */
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});
/**
 * Compare password method for authentication
 * Used during login to verify credentials
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};
export const User = mongoose.model('User', userSchema);
