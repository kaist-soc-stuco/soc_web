import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { AuthService } from './auth.service';

interface SsoCallbackBody {
  code?: string;
  error?: string;
  errorCode?: string;
  state?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login/start')
  async startLogin() {
    return this.authService.createLoginStartPayload();
  }

  @Post('login')
  async handleLoginCallback(
    @Body() body: SsoCallbackBody,
    @Res() response: Response,
  ): Promise<void> {
    const redirectUrl = await this.authService.handleLoginCallback(body);
    response.redirect(302, redirectUrl);
  }
}
