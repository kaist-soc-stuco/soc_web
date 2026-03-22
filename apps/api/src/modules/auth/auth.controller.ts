import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { AuthService } from './auth.service';

interface SsoCallbackBody {
  code?: string;
  state?: string;
  error?: string;
  errorCode?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login/start')
  @HttpCode(200)
  async startLogin(@Res() response: Response): Promise<void> {
    const html = await this.authService.createLoginStartHtml();

    response.type('html');
    response.send(html);
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
