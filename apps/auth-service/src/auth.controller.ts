import { Controller } from '@nestjs/common';
import {
  GetUserByIdRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UserResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '@shopflow/proto';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(data.token);
  }

  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: GetUserByIdRequest): Promise<UserResponse> {
    return this.authService.getUserById(data.userId);
  }

  @GrpcMethod('AuthService', 'Register')
  async register(dto: RegisterRequest): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @GrpcMethod('AuthService', 'Login')
  async login(dto: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(dto);
  }
}
