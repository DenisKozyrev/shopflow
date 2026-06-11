export declare enum UserRole {
    CUSTOMER = "CUSTOMER",
    MANAGER = "MANAGER",
    ADMIN = "ADMIN"
}
export declare enum OrderStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    PAID = "PAID",
    PROCESSING = "PROCESSING",
    SHIPPED = "SHIPPED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED"
}
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
export declare const GRPC_SERVICE_TOKENS: {
    readonly AUTH_SERVICE: "AUTH_SERVICE";
    readonly PRODUCT_SERVICE: "PRODUCT_SERVICE";
    readonly ORDER_SERVICE: "ORDER_SERVICE";
    readonly PAYMENT_SERVICE: "PAYMENT_SERVICE";
};
//# sourceMappingURL=index.d.ts.map