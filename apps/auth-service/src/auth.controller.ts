import { Controller } from '@nestjs/common';
import {
  GetUserByIdRequest,
  UserResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '@shopflow/proto/src/auth.types';
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
}
