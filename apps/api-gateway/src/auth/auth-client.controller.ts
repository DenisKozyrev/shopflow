import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthClientService } from './auth-client.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authClientService: AuthClientService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authClientService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authClientService.login(loginDto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: Request) {
    return request.user;
  }
}
