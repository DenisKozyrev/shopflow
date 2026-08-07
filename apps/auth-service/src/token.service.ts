import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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
    });
  }

  async verifyAccessToken(token: string): Promise<JwtAccessTokenPayload> {
    return this.jwtService.verifyAsync<JwtAccessTokenPayload>(token);
  }
}
