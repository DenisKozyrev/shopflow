import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GRPC_SERVICE_TOKENS } from '@shopflow/common';
import {
  AuthServiceClient,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '@shopflow/proto';

@Injectable()
export class AuthClientService implements OnModuleInit {
  private authServiceClient!: AuthServiceClient;

  constructor(@Inject(GRPC_SERVICE_TOKENS.AUTH_SERVICE) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.authServiceClient = this.client.getService<AuthServiceClient>('AuthService');
  }

  register(data: RegisterRequest): Promise<RegisterResponse> {
    return firstValueFrom(this.authServiceClient.register(data));
  }

  login(data: LoginRequest): Promise<LoginResponse> {
    return firstValueFrom(this.authServiceClient.login(data));
  }

  validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return firstValueFrom(this.authServiceClient.validateToken(data));
  }
}
