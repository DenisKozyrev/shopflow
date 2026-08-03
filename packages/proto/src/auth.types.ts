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
