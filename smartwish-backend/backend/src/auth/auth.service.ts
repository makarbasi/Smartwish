import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
    private configService: ConfigService,
  ) {}

  /**
   * Convert JWT duration string (like '24h', '7d') to seconds
   */
  private parseJwtDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Default to 24 hours if parsing fails
      return 24 * 60 * 60;
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 60 * 60;
      case 'd': return num * 24 * 60 * 60;
      default: return 24 * 60 * 60; // default 24h
    }
  }

  async validateUser(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    try {
      const user = await this.userService.findByEmail(email);

      if (!user) {
        // Log failed login attempt for non-existent user
        await this.auditService.logLoginAttempt(
          email,
          false,
          ipAddress,
          userAgent,
          {
            reason: 'User not found',
            email,
          },
        );
        return null;
      }

      // Check if account is locked
      if (user.isLocked()) {
        await this.auditService.logLoginAttempt(
          email,
          false,
          ipAddress,
          userAgent,
          {
            reason: 'Account locked',
            userId: user.id,
            lockedUntil: user.lockedUntil,
          },
        );
        throw new UnauthorizedException(
          'Account is temporarily locked due to too many failed attempts',
        );
      }

      // Check if user can login
      if (!user.canLogin()) {
        await this.auditService.logLoginAttempt(
          email,
          false,
          ipAddress,
          userAgent,
          {
            reason: 'Account not active',
            userId: user.id,
            status: user.status,
          },
        );
        throw new UnauthorizedException('Account is not active');
      }

      if (user && (await this.userService.validatePassword(user, password))) {
        // Reset login attempts on successful login
        await this.userService.resetLoginAttempts(user.id);

        // Log successful login
        await this.auditService.logLogin(user.id, true, ipAddress, userAgent, {
          email: user.email,
          oauthProvider: user.oauthProvider,
        });

        const { password, ...result } = user;
        return result;
      } else {
        // Increment failed login attempts
        await this.userService.incrementLoginAttempts(user.id);

        // Log failed login attempt
        await this.auditService.logLoginAttempt(
          email,
          false,
          ipAddress,
          userAgent,
          {
            reason: 'Invalid password',
            userId: user.id,
          },
        );

        return null;
      }
    } catch (error) {
      this.logger.error('User validation failed', error.stack, {
        email,
        ipAddress,
      });
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

      const refreshPayload = {
        sub: user.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
      };

      console.log('AuthService: Creating JWT payload:', payload);
      console.log('AuthService: User object:', user);

      const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
      const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');
      
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: accessExpiresIn,
      });
      const refreshToken = this.jwtService.sign(refreshPayload, {
        expiresIn: refreshExpiresIn,
      });
      
      console.log(`[AUTH_SERVICE] 🎫 Login - Token expiration settings:`);
      console.log(`  - Access token expires in: ${accessExpiresIn}`);
      console.log(`  - Refresh token expires in: ${refreshExpiresIn}`);
      
      console.log(
        'AuthService: Generated tokens:',
        accessToken ? 'Access token exists' : 'No access token',
        refreshToken ? 'Refresh token exists' : 'No refresh token',
      );

      // Update last login
      await this.userService.updateLastLogin(user.id);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: this.parseJwtDurationToSeconds(this.configService.get<string>('JWT_EXPIRES_IN', '24h')),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
        },
      };
    } catch (error) {
      this.logger.error('Login failed', error.stack, {
        userId: user.id,
        ipAddress,
      });
      throw new UnauthorizedException('Login failed');
    }
  }

  async refreshTokenWithRefreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    try {
      const shortRefreshToken = refreshToken.substring(0, 20) + '...';
      console.log(`[AUTH_SERVICE] 🔄 Token refresh requested:`);
      console.log(`  - Refresh token: ${shortRefreshToken}`);
      console.log(`  - IP Address: ${ipAddress || 'Unknown'}`);
      console.log(`  - User Agent: ${userAgent || 'Unknown'}`);
      console.log(`  - Time: ${new Date().toISOString()}`);
      
      // Verify the refresh token with explicit options
      const decoded = this.jwtService.verify(refreshToken, {
        ignoreExpiration: false, // Ensure expiration is checked
      });
      
      if (!decoded.sub || decoded.type !== 'refresh') {
        console.error(`[AUTH_SERVICE] ❌ Invalid refresh token format`);
        throw new UnauthorizedException('Invalid refresh token');
      }
      
      // Additional expiration check
      const currentTime = Math.floor(Date.now() / 1000);
      console.log(`[AUTH_SERVICE] ⏰ Token timing check:`);
      console.log(`  - Current time: ${currentTime} (${new Date(currentTime * 1000).toISOString()})`);
      console.log(`  - Token exp time: ${decoded.exp} (${decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'N/A'})`);
      console.log(`  - Token issued time: ${decoded.iat} (${decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'N/A'})`);
      
      if (decoded.exp && decoded.exp < currentTime) {
        const expiredSince = currentTime - decoded.exp;
        console.error(`[AUTH_SERVICE] ❌ Refresh token has expired ${expiredSince} seconds ago`);
        throw new UnauthorizedException('Refresh token has expired');
      }

      console.log(`[AUTH_SERVICE] ✅ Refresh token verified for user: ${decoded.sub}`);

      const user = await this.userService.findById(decoded.sub);
      if (!user) {
        console.error(`[AUTH_SERVICE] ❌ User not found: ${decoded.sub}`);
        throw new UnauthorizedException('User not found');
      }

      console.log(`[AUTH_SERVICE] 👤 User found: ${user.email}`);

      // Check if user can still login
      if (!user.canLogin()) {
        throw new UnauthorizedException('Account is not active');
      }

      const payload = {
        email: user.email,
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
      };

      const refreshPayload = {
        sub: user.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
      };

      const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
      const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');
      
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: accessExpiresIn,
      });
      
      // DO NOT create a new refresh token - reuse the original one for absolute expiration
      // This prevents sliding expiration and enforces absolute 2-minute limit
      console.log(`[AUTH_SERVICE] ♻️ Reusing original refresh token instead of creating new one`);
      const newRefreshToken = refreshToken; // Reuse the original refresh token

      const accessExpiresInSeconds = this.parseJwtDurationToSeconds(accessExpiresIn);
      
      console.log(`[AUTH_SERVICE] 🎫 Generating new tokens:`);
      console.log(`  - Access token expires in: ${accessExpiresIn} (${accessExpiresInSeconds} seconds)`);
      console.log(`  - Refresh token expires in: ${refreshExpiresIn}`);
      console.log(`  - New access token: ${accessToken.substring(0, 20)}...`);
      console.log(`  - New refresh token: ${newRefreshToken.substring(0, 20)}...`);

      // Log token refresh
      await this.auditService.log({
        userId: user.id,
        action: 'token_refresh',
        tableName: 'users',
        recordId: user.id,
        ipAddress,
        userAgent,
      });

      console.log(`[AUTH_SERVICE] ✅ Token refresh completed successfully for ${user.email}`);

      return {
        access_token: accessToken,
        // DO NOT return refresh_token - force frontend to keep using the original one
        token_type: 'Bearer',
        expires_in: accessExpiresInSeconds,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
        },
      };
    } catch (error) {
      this.logger.error('Token refresh with refresh token failed', error.stack, {
        ipAddress,
      });
      throw new UnauthorizedException('Invalid refresh token');
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

      const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');
      const token = this.jwtService.sign(payload, {
        expiresIn: accessExpiresIn,
      });

      // Log token refresh
      await this.auditService.log({
        userId,
        action: 'token_refresh',
        tableName: 'users',
        recordId: userId,
        ipAddress,
        userAgent,
      });

      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: this.parseJwtDurationToSeconds(this.configService.get<string>('JWT_EXPIRES_IN', '24h')),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
        },
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error.stack, {
        userId,
        ipAddress,
      });
      throw error;
    }
  }

  async signup(
    email: string,
    password: string,
    name: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException('Invalid email format');
      }

      // Validate password strength
      if (password.length < 8) {
        throw new BadRequestException(
          'Password must be at least 8 characters long',
        );
      }

      // Check for common weak passwords
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'admin',
        'letmein',
      ];
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
        name: user.name,
      });

      // Only call login if user creation was successful
      try {
        return await this.login(result, ipAddress, userAgent);
      } catch (loginError) {
        // If login fails after successful user creation, log it but don't fail the signup
        this.logger.error('Login failed after signup', loginError.stack, {
          userId: user.id,
          email,
        });
        throw new BadRequestException(
          'Account created but login failed. Please try logging in.',
        );
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
