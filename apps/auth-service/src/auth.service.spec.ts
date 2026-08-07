import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as bcrypt from 'bcryptjs';
import { KAFKA_TOPICS } from '@shopflow/kafka';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService } from '@shopflow/prisma';
import { KafkaProducerService } from '@shopflow/kafka';

jest.mock('bcryptjs');

const mockUser = {
  id: 'user-1',
  email: 'denis@shopflow.dev',
  name: 'Denis',
  passwordHash: 'hashed-password',
  avatarUrl: null,
  role: 'CUSTOMER',
  isVerified: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let authService: AuthService;
  let tokenService: jest.Mocked<TokenService>;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let kafkaProducer: jest.Mocked<KafkaProducerService>;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: jest.fn().mockResolvedValue('access-token'),
            generateRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
            verifyAccessToken: jest.fn(),
          },
        },
        { provide: PrismaService, useValue: prisma },
        {
          provide: KafkaProducerService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    tokenService = module.get(TokenService);
    kafkaProducer = module.get(KafkaProducerService);

    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    tokenService.generateAccessToken.mockResolvedValue('access-token');
    tokenService.generateRefreshToken.mockResolvedValue('refresh-token');
    kafkaProducer.emit.mockResolvedValue(undefined);
  });

  describe('register', () => {
    const dto = { email: 'denis@shopflow.dev', password: 'Test1234!', name: 'Denis' };

    it('creates a user and returns user + tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: dto.email, passwordHash: 'hashed-password', name: dto.name },
      });
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(tokenService.generateRefreshToken).toHaveBeenCalledWith({ sub: mockUser.id });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          avatarUrl: '',
          createdAt: mockUser.createdAt.toISOString(),
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('publishes a user.registered Kafka event', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      await authService.register(dto);

      expect(kafkaProducer.emit).toHaveBeenCalledWith(KAFKA_TOPICS.USER_REGISTERED, {
        userId: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        registeredAt: mockUser.createdAt.toISOString(),
      });
    });

    it('throws ALREADY_EXISTS when the email is taken', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.register(dto)).rejects.toMatchObject({
        error: { code: status.ALREADY_EXISTS },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('falls back to an empty name in the Kafka payload when name is not set', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...mockUser, name: null });

      await authService.register({ ...dto, name: '' });

      expect(kafkaProducer.emit).toHaveBeenCalledWith(
        KAFKA_TOPICS.USER_REGISTERED,
        expect.objectContaining({ name: '' }),
      );
    });

    it('does not fail registration if Kafka publish fails', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      kafkaProducer.emit.mockRejectedValue(new Error('Kafka unavailable'));

      const result = await authService.register(dto);

      expect(result.accessToken).toBe('access-token');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to publish user.registered event',
        expect.any(Error),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('login', () => {
    const dto = { email: 'denis@shopflow.dev', password: 'Test1234!' };

    it('returns user + tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(dto);

      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, mockUser.passwordHash);
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          avatarUrl: '',
          createdAt: mockUser.createdAt.toISOString(),
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws UNAUTHENTICATED when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(dto)).rejects.toMatchObject({
        error: { code: status.UNAUTHENTICATED },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when the password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(dto)).rejects.toMatchObject({
        error: { code: status.UNAUTHENTICATED },
      });
    });

    it('throws UNAUTHENTICATED for an OAuth-only user with no password set', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: null });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(dto)).rejects.toMatchObject({
        error: { code: status.UNAUTHENTICATED },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, '');
    });
  });

  describe('getUserById', () => {
    it('returns the mapped user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.getUserById(mockUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id } });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        avatarUrl: '',
        createdAt: mockUser.createdAt.toISOString(),
      });
    });

    it('throws NOT_FOUND when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.getUserById('missing-id')).rejects.toMatchObject({
        error: { code: status.NOT_FOUND },
      });
    });

    it('maps missing name/avatarUrl to empty strings', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, name: null, avatarUrl: null });

      const result = await authService.getUserById(mockUser.id);

      expect(result.name).toBe('');
      expect(result.avatarUrl).toBe('');
    });
  });

  describe('validateToken', () => {
    it('returns valid: true with payload data for a valid token', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      const result = await authService.validateToken('valid-token');

      expect(result).toEqual({
        valid: true,
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('returns valid: false for an invalid or expired token', async () => {
      tokenService.verifyAccessToken.mockRejectedValue(new Error('jwt expired'));

      const result = await authService.validateToken('bad-token');

      expect(result).toEqual({ valid: false, userId: '', email: '', role: '' });
    });
  });
});
