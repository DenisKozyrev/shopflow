// Kafka topic constants — single source of truth for all services
export const KAFKA_TOPICS = {
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_FAILED: 'payment.failed',
  INVENTORY_LOW: 'inventory.low',
  USER_REGISTERED: 'user.registered',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// Event payload types
export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  userEmail: string;
  total: number;
  items: Array<{ productId: string; name: string; quantity: number; price: number }>;
  shippingAddress: string;
  createdAt: string;
}

export interface OrderPaidEvent {
  orderId: string;
  userId: string;
  userEmail: string;
  paymentIntentId: string;
  total: number;
  paidAt: string;
}

export interface OrderShippedEvent {
  orderId: string;
  userId: string;
  userEmail: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery: string;
}

export interface InventoryLowEvent {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
}

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  name: string;
  registeredAt: string;
}

export * from './kafka.config';
export * from './kafka-producer.service';
export * from './kafka.module';
