import jwt from 'jsonwebtoken';
import { Seller } from '../models/Seller.js';
import type { ISeller } from '../models/Seller.js';

/**
 * JWT payload interface
 */
export interface JWTPayload {
  sellerId: string;
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
 * Authenticates seller with email and password
 * Returns seller document if credentials are valid
 */
export const authenticateSeller = async (
  email: string,
  password: string
): Promise<ISeller> => {
  const seller = await Seller.findOne({ email }).select('+password');
  
  if (!seller) {
    throw new Error('Invalid email or password');
  }

  const isPasswordValid = await seller.comparePassword(password);
  
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  return seller;
};

