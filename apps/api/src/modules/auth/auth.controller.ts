import { Controller, Post, Put, Body, Get, Res, HttpCode, UseGuards, Req } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { companyName: string; username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.companyName, body.username, body.password);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Also return the refresh token so the web client can store it (the axios
    // interceptor refreshes from localStorage). Cookie is kept for other clients.
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() body: { refreshToken: string }, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(body.refreshToken);
    res.clearCookie('refreshToken');
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('tenant')
  @UseGuards(JwtAuthGuard)
  async getTenant(@Req() req: any) {
    return this.authService.getTenant(req.user.tenantId);
  }

  @Put('tenant')
  @UseGuards(JwtAuthGuard)
  async updateTenant(@Req() req: any, @Body() body: any) {
    return this.authService.updateTenant(req.user.tenantId, body);
  }
}
