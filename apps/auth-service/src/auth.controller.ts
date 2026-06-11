import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: { userId: string }) {
    return this.authService.getUserById(data.userId);
  }
}
