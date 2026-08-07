import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export interface JwtAccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}
export interface JwtRefreshTokenPayload {
  sub: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(payload: JwtAccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  async generateRefreshToken(payload: JwtRefreshTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
      // Ensures two tokens for the same user are never byte-identical, even if
      // issued within the same second (jsonwebtoken's `iat` is second-precision) —
      // otherwise concurrent logins can collide on RefreshToken.token's unique index.
      jwtid: randomUUID(),
    });
  }

  async verifyAccessToken(token: string): Promise<JwtAccessTokenPayload> {
    return this.jwtService.verifyAsync<JwtAccessTokenPayload>(token);
  }

  decodeExpiry(token: string): Date {
    const payload = this.jwtService.decode<{ exp: number }>(token);
    if (!payload || typeof payload.exp !== 'number') {
      throw new RpcException({ code: status.INTERNAL, message: 'Cannot decode token expiry' });
    }
    return new Date(payload.exp * 1000);
  }
}
