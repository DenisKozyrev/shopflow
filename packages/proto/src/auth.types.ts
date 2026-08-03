interface ValidateTokenRequest {
  token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  userId: string;
  email: string;
  role: string;
}

interface GetUserByIdRequest {
  userId: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string;
  createdAt: string;
}

export { ValidateTokenRequest, ValidateTokenResponse, GetUserByIdRequest, UserResponse };
