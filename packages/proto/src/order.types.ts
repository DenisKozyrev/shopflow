export interface GetOrderRequest {
  orderId: string;
}

export interface GetUserOrdersRequest {
  userId: string;
  page: number;
  limit: number;
}

export interface GetUserOrdersResponse {
  orders: OrderResponse[];
  total: number;
}

export interface CreateOrderRequest {
  userId: string;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: string;
}

export interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  total: number;
  items: OrderItemResponse[];
  shippingAddress: string;
  createdAt: string;
}

export interface OrderItemResponse {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}
