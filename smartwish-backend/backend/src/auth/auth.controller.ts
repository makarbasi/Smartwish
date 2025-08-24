import {
  Controller,
  Post,
  Get,
  Body,
  UnauthorizedException,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Post('login')
  @Public()
  async login(
    @Body() loginDto: { email: string; password: string },
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    console.log('LOGIN: Received login request for email:', loginDto.email);

    const ipAddress: string =
      (typeof (req as { ip?: unknown }).ip === 'string' &&
        (req as { ip?: string }).ip) ||
      ((req as { connection?: { remoteAddress?: unknown } }).connection &&
        typeof (req as { connection: { remoteAddress?: unknown } }).connection
          .remoteAddress === 'string' &&
        (req as { connection: { remoteAddress: string } }).connection
          .remoteAddress) ||
      ((req as { headers?: { [key: string]: unknown } }).headers &&
        typeof (req as { headers: { [key: string]: unknown } }).headers[
          'x-forwarded-for'
        ] === 'string' &&
        (req as { headers: { [key: string]: string } }).headers[
          'x-forwarded-for'
        ]) ||
      'unknown';

    const userResult: unknown = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
      ipAddress,
      userAgent,
    );
    const user: { id: string; email: string } | null =
      typeof userResult === 'object' &&
      userResult !== null &&
      'id' in userResult &&
      'email' in userResult
        ? (userResult as { id: string; email: string })
        : null;
    console.log('LOGIN: validateUser result:', user);
    if (!user) {
      console.log('LOGIN: Invalid credentials, throwing UnauthorizedException');
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user, ipAddress, userAgent);
    console.log('LOGIN: Returning login result:', result);
    return result;
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() refreshDto: { refresh_token: string },
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress =
      (req as { ip?: string }).ip ||
      (req as { connection?: { remoteAddress?: string } }).connection
        ?.remoteAddress ||
      (req.headers as unknown as { [key: string]: string | undefined })[
        'x-forwarded-for'
      ] ||
      'unknown';

    return this.authService.refreshTokenWithRefreshToken(
      refreshDto.refresh_token,
      ipAddress,
      userAgent,
    );
  }

  @Post('refresh-legacy')
  @UseGuards(JwtAuthGuard)
  async refreshLegacy(
    @Req() req: AuthenticatedRequest,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('Invalid token');
    }

    const ipAddress =
      (req as { ip?: string }).ip ||
      (req as { connection?: { remoteAddress?: string } }).connection
        ?.remoteAddress ||
      (req.headers as unknown as { [key: string]: string | undefined })[
        'x-forwarded-for'
      ] ||
      'unknown';

    return this.authService.refreshToken(req.user.id, ipAddress, userAgent);
  }
  @Post('signup')
  @Public()
  async signup(
    @Body() signupDto: { email: string; password: string; name: string },
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress =
      (typeof req.ip === 'string' && req.ip) ||
      (req.socket &&
        typeof req.socket.remoteAddress === 'string' &&
        req.socket.remoteAddress) ||
      (req.headers &&
        typeof (
          req.headers as { [key: string]: string | string[] | undefined }
        )['x-forwarded-for'] === 'string' &&
        (req.headers as { [key: string]: string })['x-forwarded-for']) ||
      'unknown';

    return this.authService.signup(
      signupDto.email,
      signupDto.password,
      signupDto.name,
      ipAddress,
      userAgent,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('Invalid token');
    }

    const maybeIp = typeof req.ip === 'string' ? req.ip : undefined;
    const maybeRemote =
      typeof (req as { connection?: { remoteAddress?: string } }).connection
        ?.remoteAddress === 'string'
        ? (req as { connection: { remoteAddress: string } }).connection
            .remoteAddress
        : undefined;
    const maybeForwarded =
      typeof (req.headers as { [key: string]: string | undefined })[
        'x-forwarded-for'
      ] === 'string'
        ? (req.headers as { [key: string]: string })['x-forwarded-for']
        : undefined;
    const ipAddress = maybeIp || maybeRemote || maybeForwarded || 'unknown';

    return this.authService.logout(req.user.id, ipAddress, userAgent);
  }

  @Get('users')
  async getUsers() {
    return this.userService.getAllUsers();
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(
    @Body() forgotPasswordDto: { email: string },
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress =
      (req as { ip?: string }).ip ||
      (req as { connection?: { remoteAddress?: string } }).connection
        ?.remoteAddress ||
      (req.headers as unknown as { [key: string]: string | undefined })[
        'x-forwarded-for'
      ] ||
      'unknown';

    try {
      const { token, expiresAt } = await this.userService.initiatePasswordReset(
        forgotPasswordDto.email,
        ipAddress,
        userAgent,
      );

      // In production, send email with reset link
      // For development, return the token
      return {
        message: 'If the email exists, a password reset link has been sent',
        // Remove in production
        resetToken: token,
        expiresAt,
      };
    } catch (error) {
      // Always return success message to prevent email enumeration
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }
  }

  @Post('verify-reset-token')
  @Public()
  async verifyResetToken(@Body() verifyDto: { token: string }) {
    try {
      // This would be used to verify if a reset token is valid
      // Implementation depends on your frontend needs
      return { message: 'Token verification endpoint', valid: true };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
