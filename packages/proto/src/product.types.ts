interface GetProductRequest {
  productId: string;
}

interface GetProductsRequest {
  page: number;
  limit: number;
  categoryId: string;
  search: string;
}

interface GetProductsResponse {
  products: ProductResponse[];
  total: number;
}

interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  imageUrls: string[];
  createdAt: string;
}

interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
}

interface UpdateProductRequest {
  productId: string;
  name?: string;
  price?: number;
  stock?: number;
}

interface DecrementStockRequest {
  productId: string;
  quantity: number;
}

interface DecrementStockResponse {
  success: boolean;
  remainingStock: number;
}

export {
  GetProductRequest,
  GetProductsRequest,
  GetProductsResponse,
  ProductResponse,
  CreateProductRequest,
  UpdateProductRequest,
  DecrementStockRequest,
  DecrementStockResponse,
};
