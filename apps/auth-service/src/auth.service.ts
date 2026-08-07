import * as bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  UserResponse,
  ValidateTokenResponse,
} from '@shopflow/proto';
import { PrismaService, Prisma, type User } from '@shopflow/prisma';
import { KafkaProducerService, KAFKA_TOPICS, type UserRegisteredEvent } from '@shopflow/kafka';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { TokenService } from './token.service';

// Compared against on login when no user is found, so the response time for
// "no such user" and "wrong password" stays the same (no email-enumeration timing leak).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password', 10);

const emailSchema = z.string().email();

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  name: z.string(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async register(dto: RegisterRequest): Promise<RegisterResponse> {
    const { password, name } = dto;
    const email = this.normalizeEmail(dto.email);
    this.validate(registerSchema, { email, password, name });

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.throwAlreadyExists();
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let newUser: User;
    try {
      newUser = await this.prisma.user.create({
        data: { email, passwordHash: hashedPassword, name },
      });
    } catch (error) {
      // Two concurrent registrations for the same not-yet-taken email can both
      // pass the findUnique check above before either write commits — the DB's
      // unique constraint is the real guarantee, this just gives it a clean error shape.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.throwAlreadyExists();
      }
      this.logger.error('Failed to create user', error);
      throw new RpcException({ code: status.INTERNAL, message: 'Failed to create user' });
    }

    const tokens = await this.generateTokenPair(newUser);

    const event: UserRegisteredEvent = {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name ?? '',
      registeredAt: newUser.createdAt.toISOString(),
    };

    try {
      await this.kafkaProducer.emit(KAFKA_TOPICS.USER_REGISTERED, event);
    } catch (error) {
      this.logger.error('Failed to publish user.registered event', error);
    }

    return this.buildAuthResponse(newUser, tokens);
  }

  async login(dto: LoginRequest): Promise<LoginResponse> {
    const { password } = dto;
    const email = this.normalizeEmail(dto.email);
    this.validate(loginSchema, { email, password });

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const isPasswordValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid) {
      throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Invalid credentials' });
    }

    const tokens = await this.generateTokenPair(user);

    return this.buildAuthResponse(user, tokens);
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

  private async generateTokenPair(
    user: Pick<User, 'id' | 'email' | 'role'>,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      this.tokenService.generateRefreshToken({ sub: user.id }),
    ]);

    try {
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: this.tokenService.decodeExpiry(refreshToken),
        },
      });
    } catch (error) {
      // The JWT itself is already valid and usable — losing this row only means
      // the session can't be individually revoked later, not that login/register fails.
      this.logger.error('Failed to persist refresh token', error);
    }

    return { accessToken, refreshToken };
  }

  private buildAuthResponse(
    user: User,
    tokens: { accessToken: string; refreshToken: string },
  ): RegisterResponse | LoginResponse {
    return { user: this.toUserResponse(user), ...tokens };
  }

  private throwAlreadyExists(): never {
    throw new RpcException({ code: status.ALREADY_EXISTS, message: 'User already exists' });
  }

  private validate<T>(schema: z.ZodType<T>, dto: T): void {
    const result = schema.safeParse(dto);
    if (!result.success) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: result.error.issues.map((issue) => issue.message).join(', '),
      });
    }
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
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
