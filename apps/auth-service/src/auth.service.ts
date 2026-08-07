import * as bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  UserResponse,
  ValidateTokenResponse,
} from '@shopflow/proto';
import { PrismaService, type User } from '@shopflow/prisma';
import { KafkaProducerService, KAFKA_TOPICS } from '@shopflow/kafka';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async register(dto: RegisterRequest): Promise<RegisterResponse> {
    const { email, password, name } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new RpcException({ code: status.ALREADY_EXISTS, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.prisma.user.create({
      data: { email, passwordHash: hashedPassword, name },
    });

    const accessToken = await this.tokenService.generateAccessToken({
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    const refreshToken = await this.tokenService.generateRefreshToken({
      sub: newUser.id,
    });

    try {
      await this.kafkaProducer.emit(KAFKA_TOPICS.USER_REGISTERED, {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name ?? '',
        registeredAt: newUser.createdAt.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to publish user.registered event', error);
    }

    return {
      user: this.toUserResponse(newUser),
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginRequest): Promise<LoginResponse> {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash ?? '');

    if (!isPasswordValid) {
      throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Invalid credentials' });
    }

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await this.tokenService.generateRefreshToken({
      sub: user.id,
    });

    return {
      user: this.toUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  async validateToken(token: string): Promise<ValidateTokenResponse> {
    try {
      const payload = await this.tokenService.verifyAccessToken(token);
      return {
        valid: true,
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      return { valid: false, userId: '', email: '', role: '' };
    }
  }

  async getUserById(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({ code: status.NOT_FOUND, message: 'User not found' });
    }

    return this.toUserResponse(user);
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      role: user.role,
      avatarUrl: user.avatarUrl ?? '',
      createdAt: user.createdAt.toISOString(),
    };
  }
}
