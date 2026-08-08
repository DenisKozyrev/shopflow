export interface ValidateTokenRequest {
  token: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId: string;
  email: string;
  role: string;
}

export interface GetUserByIdRequest {
  userId: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}
