import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_SECRET') || 'your-secret-key';
    console.log(
      'JWT Strategy: Using secret:',
      secret ? 'Secret exists' : 'No secret',
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer:
        configService.get<string>('JWT_ISSUER') || 'smartwish-app',
      audience:
        configService.get<string>('JWT_AUDIENCE') || 'smartwish-users',
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
    });
  }

  async validate(payload: any) {
    console.log('JWT Strategy: Validating payload:', payload);
    
    // Validate required fields
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check if token is not expired (additional safety)
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      throw new UnauthorizedException('Token has expired');
    }

    // Check if token was issued in the future (clock skew protection)
    if (payload.iat && payload.iat > currentTime + 60) { // Allow 1 minute clock skew
      throw new UnauthorizedException('Token issued in the future');
    }

    const user = { id: payload.sub, email: payload.email };
    console.log('JWT Strategy: Returning user:', user);
    return user;
  }
}
