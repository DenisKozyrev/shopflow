"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRPC_SERVICE_TOKENS = exports.PaymentStatus = exports.OrderStatus = exports.UserRole = void 0;
// Shared enums
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PAID"] = "PAID";
    OrderStatus["PROCESSING"] = "PROCESSING";
    OrderStatus["SHIPPED"] = "SHIPPED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["REFUNDED"] = "REFUNDED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["SUCCEEDED"] = "SUCCEEDED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
// gRPC service tokens (for NestJS DI)
exports.GRPC_SERVICE_TOKENS = {
    AUTH_SERVICE: 'AUTH_SERVICE',
    PRODUCT_SERVICE: 'PRODUCT_SERVICE',
    ORDER_SERVICE: 'ORDER_SERVICE',
    PAYMENT_SERVICE: 'PAYMENT_SERVICE',
};
//# sourceMappingURL=index.js.map