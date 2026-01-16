import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { AuditModule } from '../common/audit/audit.module';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UserModule,
    PassportModule,
    AuditModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
          issuer: configService.get<string>('JWT_ISSUER', 'smartwish-app'),
          audience: configService.get<string>(
            'JWT_AUDIENCE',
            'smartwish-users',
          ),
          algorithm: 'HS256',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, OAuthService, JwtStrategy, LoggerService],
  controllers: [AuthController, OAuthController],
  exports: [AuthService, OAuthService],
})
export class AuthModule {}
