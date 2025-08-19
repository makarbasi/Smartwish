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
import { AuthService } from './auth.service';
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
  async login(
    @Body() loginDto: { email: string; password: string },
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    console.log('LOGIN: Received login request for email:', loginDto.email);
    
    // Extract IP address
    const ipAddress = (req as any).ip || (req as any).connection?.remoteAddress || (req.headers as any)['x-forwarded-for'] || 'unknown';
    
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
      ipAddress,
      userAgent,
    );
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
  @UseGuards(JwtAuthGuard)
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('Invalid token');
    }
    
    // Extract IP address
    const ipAddress = (req as any).ip || (req as any).connection?.remoteAddress || (req.headers as any)['x-forwarded-for'] || 'unknown';
    
    return this.authService.refreshToken(req.user.id, ipAddress, userAgent);
  }

  @Post('signup')
  async signup(
    @Body() signupDto: { email: string; password: string; name: string },
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    // Extract IP address
    const ipAddress = (req as any).ip || (req as any).connection?.remoteAddress || (req.headers as any)['x-forwarded-for'] || 'unknown';
    
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
    
    // Extract IP address
    const ipAddress = (req as any).ip || (req as any).connection?.remoteAddress || (req.headers as any)['x-forwarded-for'] || 'unknown';
    
    return this.authService.logout(req.user.id, ipAddress, userAgent);
  }

  @Get('users')
  async getUsers() {
    return this.userService.getAllUsers();
  }
}
