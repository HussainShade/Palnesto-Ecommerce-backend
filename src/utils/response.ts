/**
 * Standard API response format
 * Ensures consistent response structure across all endpoints
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}

