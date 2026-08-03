interface GetOrderRequest {
  orderId: string;
}

interface GetUserOrdersRequest {
  userId: string;
  page: number;
  limit: number;
}

interface GetUserOrdersResponse {
  orders: OrderResponse[];
  total: number;
}

interface CreateOrderRequest {
  userId: string;
}

interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
}

interface UpdateOrderStatusRequest {
  orderId: string;
  status: string;
}

interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  total: number;
  items: OrderItemResponse[];
  shippingAddress: string;
  createdAt: string;
}

interface OrderItemResponse {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export {
  GetOrderRequest,
  GetUserOrdersRequest,
  GetUserOrdersResponse,
  CreateOrderRequest,
  OrderItemInput,
  UpdateOrderStatusRequest,
  OrderResponse,
  OrderItemResponse,
};
