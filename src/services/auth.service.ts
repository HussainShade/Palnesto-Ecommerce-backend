import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { UserType } from '../models/UserType.js';
import type { IUser } from '../models/User.js';

/**
 * JWT payload interface
 * Supports both userId and sellerId for migration compatibility
 */
export interface JWTPayload {
  userId?: string;
  sellerId?: string; // For backward compatibility
  email: string;
}

/**
 * Generates JWT token for authenticated seller
 * Token expires in 7 days for production security
 */
export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(payload, secret, {
    expiresIn: '7d',
  });
};

/**
 * Verifies JWT token and returns payload
 * Used in authentication middleware
 */
export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Authenticates user with email and password
 * Verifies user is a seller (has Seller UserType)
 * Returns user document if credentials are valid
 */
export const authenticateSeller = async (
  email: string,
  password: string
): Promise<IUser> => {
  const user = await User.findOne({ email, isActive: true })
    .select('+password')
    .populate('userTypeId');
  
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify user is a seller
  const userType = user.userTypeId as any;
  if (!userType || userType.name !== 'Seller') {
    throw new Error('Access denied. Seller account required.');
  }

  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  return user;
};

/**
 * Authenticates user with email and password
 * Verifies user is a customer (has Customer UserType)
 * Returns user document if credentials are valid
 */
export const authenticateCustomer = async (
  email: string,
  password: string
): Promise<IUser> => {
  const user = await User.findOne({ email, isActive: true })
    .select('+password')
    .populate('userTypeId');
  
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify user is a customer
  const userType = user.userTypeId as any;
  if (!userType || userType.name !== 'Customer') {
    throw new Error('Access denied. Customer account required.');
  }

  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  return user;
};

/**
 * Creates a new user (signup)
 * Automatically assigns UserType based on userType parameter
 * Returns created user document
 */
/**
 * Authenticates user with email and password
 * Verifies user is an admin (has Admin UserType)
 * Returns user document if credentials are valid
 */
export const authenticateAdmin = async (
  email: string,
  password: string
): Promise<IUser> => {
  const user = await User.findOne({ email, isActive: true })
    .select('+password')
    .populate('userTypeId');
  
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify user is an admin
  const userType = user.userTypeId as any;
  if (!userType || userType.name !== 'Admin') {
    throw new Error('Access denied. Administrator account required.');
  }

  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  return user;
};

export const createUser = async (
  email: string,
  password: string,
  name: string,
  userTypeName: 'Seller' | 'Customer' | 'Admin' = 'Customer'
): Promise<IUser> => {
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Get UserType
  const userType = await UserType.findOne({ name: userTypeName, isActive: true });
  if (!userType) {
    throw new Error(`UserType '${userTypeName}' not found. Please ensure reference data is seeded.`);
  }

  // Create user
  const user = new User({
    email,
    password, // Will be hashed by pre-save hook
    name,
    userTypeId: userType._id,
    isActive: true,
  });

  await user.save();
  return user;
};
