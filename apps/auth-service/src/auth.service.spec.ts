import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import * as bcrypt from 'bcryptjs';
import { KAFKA_TOPICS } from '@shopflow/kafka';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService, Prisma } from '@shopflow/prisma';
import { KafkaProducerService } from '@shopflow/kafka';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  hashSync: jest.fn().mockReturnValue('dummy-hash'),
}));

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
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: { create: jest.Mock };
  };
  let kafkaProducer: jest.Mocked<KafkaProducerService>;

  const tokenExpiresAt = new Date('2026-01-08T00:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
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
            decodeExpiry: jest.fn(),
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
    tokenService.decodeExpiry.mockReturnValue(tokenExpiresAt);
    prisma.refreshToken.create.mockResolvedValue(undefined);
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

    it('normalizes email casing/whitespace before checking and creating', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      await authService.register({ ...dto, email: '  Denis@ShopFlow.dev ' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: dto.email, passwordHash: 'hashed-password', name: dto.name },
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

    it('throws ALREADY_EXISTS on a unique-constraint race instead of an unhandled error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(authService.register(dto)).rejects.toMatchObject({
        error: { code: status.ALREADY_EXISTS },
      });
    });

    it('wraps unrelated database errors as an internal RpcException, not the raw error', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('connection lost'));

      await expect(authService.register(dto)).rejects.toMatchObject({
        error: { code: status.INTERNAL },
      });
      expect(loggerSpy).toHaveBeenCalledWith('Failed to create user', expect.any(Error));

      loggerSpy.mockRestore();
    });

    it.each([
      ['invalid email', { email: 'not-an-email', password: 'Test1234!', name: 'Denis' }],
      ['short password', { email: 'denis@shopflow.dev', password: 'short', name: 'Denis' }],
    ])('throws INVALID_ARGUMENT for %s', async (_case, badDto) => {
      await expect(authService.register(badDto)).rejects.toMatchObject({
        error: { code: status.INVALID_ARGUMENT },
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('persists the refresh token with its real expiry', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      await authService.register(dto);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: { token: 'refresh-token', userId: mockUser.id, expiresAt: tokenExpiresAt },
      });
    });

    it('does not fail registration if persisting the refresh token fails', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockRejectedValue(new Error('DB unavailable'));

      const result = await authService.register(dto);

      expect(result.refreshToken).toBe('refresh-token');
      expect(loggerSpy).toHaveBeenCalledWith('Failed to persist refresh token', expect.any(Error));

      loggerSpy.mockRestore();
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

    it('normalizes email casing/whitespace before the lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authService.login({ ...dto, email: '  Denis@ShopFlow.dev ' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
    });

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
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(dto)).rejects.toMatchObject({
        error: { code: status.UNAUTHENTICATED },
      });
      // still runs bcrypt.compare against a dummy hash so the response time
      // doesn't leak whether the email is registered (timing-attack fix)
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, 'dummy-hash');
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
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, 'dummy-hash');
    });

    it.each([
      ['invalid email', { email: 'not-an-email', password: 'Test1234!' }],
      ['empty password', { email: 'denis@shopflow.dev', password: '' }],
    ])('throws INVALID_ARGUMENT for %s', async (_case, badDto) => {
      await expect(authService.login(badDto)).rejects.toMatchObject({
        error: { code: status.INVALID_ARGUMENT },
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('persists the refresh token with its real expiry', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authService.login(dto);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: { token: 'refresh-token', userId: mockUser.id, expiresAt: tokenExpiresAt },
      });
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
