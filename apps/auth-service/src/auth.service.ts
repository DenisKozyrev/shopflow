import { Injectable } from '@nestjs/common';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(private readonly tokenService: TokenService) {}

  async validateToken(token: string) {
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

  async getUserById(_userId: string) {
    // TODO: implement with Prisma in Sprint 1
    throw new Error('Not implemented');
  }
}
