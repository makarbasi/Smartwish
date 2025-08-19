import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { AuditService } from '../common/audit/audit.service';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private logger: LoggerService,
  ) {}

  async validateUser(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<any> {
    try {
      const user = await this.userService.findByEmail(email);
      
      if (!user) {
        // Log failed login attempt for non-existent user
        await this.auditService.logLoginAttempt(email, false, ipAddress, userAgent, {
          reason: 'User not found',
          email
        });
        return null;
      }

      // Check if account is locked
      if (user.isLocked()) {
        await this.auditService.logLoginAttempt(email, false, ipAddress, userAgent, {
          reason: 'Account locked',
          userId: user.id,
          lockedUntil: user.lockedUntil
        });
        throw new UnauthorizedException('Account is temporarily locked due to too many failed attempts');
      }

      // Check if user can login
      if (!user.canLogin()) {
        await this.auditService.logLoginAttempt(email, false, ipAddress, userAgent, {
          reason: 'Account not active',
          userId: user.id,
          status: user.status
        });
        throw new UnauthorizedException('Account is not active');
      }

      if (user && (await this.userService.validatePassword(user, password))) {
        // Reset login attempts on successful login
        await this.userService.resetLoginAttempts(user.id);
        
        // Log successful login
        await this.auditService.logLogin(user.id, true, ipAddress, userAgent, {
          email: user.email,
          oauthProvider: user.oauthProvider
        });

        const { password, ...result } = user;
        return result;
      } else {
        // Increment failed login attempts
        await this.userService.incrementLoginAttempts(user.id);
        
        // Log failed login attempt
        await this.auditService.logLoginAttempt(email, false, ipAddress, userAgent, {
          reason: 'Invalid password',
          userId: user.id
        });
        
        return null;
      }
    } catch (error) {
      this.logger.error('User validation failed', error.stack, { email, ipAddress });
      throw error;
    }
  }

  async login(user: any, ipAddress?: string, userAgent?: string) {
    try {
      const payload = { 
        email: user.email, 
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
      };
      
      console.log('AuthService: Creating JWT payload:', payload);
      console.log('AuthService: User object:', user);

      const token = this.jwtService.sign(payload);
      console.log(
        'AuthService: Generated token:',
        token ? 'Token exists' : 'No token',
      );

      // Update last login
      await this.userService.updateLastLogin(user.id);

      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: parseInt(process.env.JWT_EXPIRES_IN || '86400') || 86400, // 24 hours in seconds
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
        },
      };
    } catch (error) {
      this.logger.error('Login failed', error.stack, { userId: user.id, ipAddress });
      throw new UnauthorizedException('Login failed');
    }
  }

  async refreshToken(userId: string, ipAddress?: string, userAgent?: string) {
    try {
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user can still login
      if (!user.canLogin()) {
        throw new UnauthorizedException('Account is not active');
      }

      const payload = { 
        email: user.email, 
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
      };
      
      const token = this.jwtService.sign(payload);

      // Log token refresh
      await this.auditService.log({
        userId,
        eventType: 'token_refresh' as any,
        severity: 'low' as any,
        status: 'success' as any,
        description: 'Token refreshed',
        ipAddress,
        userAgent,
        endpoint: '/auth/refresh',
        httpMethod: 'POST',
      });

      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: parseInt(process.env.JWT_EXPIRES_IN || '86400') || 86400,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
        },
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error.stack, { userId, ipAddress });
      throw error;
    }
  }

  async signup(email: string, password: string, name: string, ipAddress?: string, userAgent?: string) {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException('Invalid email format');
      }

      // Validate password strength
      if (password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters long');
      }

      // Check for common weak passwords
      const weakPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
      if (weakPasswords.includes(password.toLowerCase())) {
        throw new BadRequestException('Password is too weak');
      }

      const existingUser = await this.userService.findByEmail(email);
      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const user = await this.userService.create({ email, password, name });
      const { password: _, ...result } = user;
      
      // Log successful registration
      await this.auditService.logRegistration(user.id, ipAddress, userAgent, {
        email: user.email,
        name: user.name
      });

      // Only call login if user creation was successful
      try {
        return await this.login(result, ipAddress, userAgent);
      } catch (loginError) {
        // If login fails after successful user creation, log it but don't fail the signup
        this.logger.error('Login failed after signup', loginError.stack, { userId: user.id, email });
        throw new BadRequestException('Account created but login failed. Please try logging in.');
      }
    } catch (error) {
      this.logger.error('Signup failed', error.stack, { email, ipAddress });
      throw error;
    }
  }

  async logout(userId: string, ipAddress?: string, userAgent?: string) {
    try {
      // Log logout
      await this.auditService.logLogout(userId, ipAddress, userAgent);
      
      // In a production environment, you might want to blacklist the token
      // This would require Redis or a similar solution
      
      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('Logout failed', error.stack, { userId, ipAddress });
      throw error;
    }
  }
}
