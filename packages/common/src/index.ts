// Shared enums
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// Shared response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// gRPC service tokens (for NestJS DI)
export const GRPC_SERVICE_TOKENS = {
  AUTH_SERVICE: 'AUTH_SERVICE',
  PRODUCT_SERVICE: 'PRODUCT_SERVICE',
  ORDER_SERVICE: 'ORDER_SERVICE',
  PAYMENT_SERVICE: 'PAYMENT_SERVICE',
} as const;
