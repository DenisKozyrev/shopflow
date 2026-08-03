export interface GetProductRequest {
  productId: string;
}

export interface GetProductsRequest {
  page: number;
  limit: number;
  categoryId: string;
  search: string;
}

export interface GetProductsResponse {
  products: ProductResponse[];
  total: number;
}

export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  imageUrls: string[];
  createdAt: string;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
}

export interface UpdateProductRequest {
  productId: string;
  name?: string;
  price?: number;
  stock?: number;
}

export interface DecrementStockRequest {
  productId: string;
  quantity: number;
}

export interface DecrementStockResponse {
  success: boolean;
  remainingStock: number;
}
