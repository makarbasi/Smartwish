import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { OAuthProvider } from '../user/user.entity';
import * as crypto from 'crypto';

interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'instagram' | 'whatsapp';
}

@Injectable()
export class OAuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  private mapProviderToEnum(provider: string): OAuthProvider {
    switch (provider) {
      case 'google':
        return OAuthProvider.GOOGLE;
      case 'instagram':
        return OAuthProvider.INSTAGRAM;
      case 'whatsapp':
        return OAuthProvider.WHATSAPP;
      default:
        return OAuthProvider.LOCAL;
    }
  }

  async handleOAuthCallback(profile: OAuthProfile) {
    try {
      const oauthProvider = this.mapProviderToEnum(profile.provider);

      // Check if user exists by OAuth ID
      let user = await this.userService.findByOAuthId(
        oauthProvider,
        profile.id,
      );

      if (!user) {
        // Check if user exists by email
        user = await this.userService.findByEmail(profile.email);

        if (user) {
          // Link existing account with OAuth provider
          user = await this.userService.linkOAuthProvider(
            user.id,
            oauthProvider,
            profile.id,
            profile.picture,
          );
        } else {
          // Create new user with OAuth
          user = await this.userService.createOAuthUser({
            email: profile.email,
            name: profile.name,
            oauthProvider: oauthProvider,
            oauthId: profile.id,
            profileImage: profile.picture,
          });
        }
      }

      // Update last login
      await this.userService.updateLastLogin(user.id);

      // Generate JWT token with all necessary user information
      const payload = {
        email: user.email,
        sub: user.id,
        name: user.name,
        picture: user.profileImage,
        iat: Math.floor(Date.now() / 1000),
        iss: process.env.JWT_ISSUER || 'smartwish-app',
        aud: process.env.JWT_AUDIENCE || 'smartwish-users',
      };
      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          oauthProvider: user.oauthProvider,
        },
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw new UnauthorizedException('OAuth authentication failed');
    }
  }

  async generateOAuthState(): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }

  async validateOAuthState(
    state: string,
    storedState: string,
  ): Promise<boolean> {
    return state === storedState;
  }

  getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URL;
    const scope = 'email profile';

    if (!clientId || !redirectUri) {
      throw new Error('Missing Google OAuth configuration');
    }

    return (
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`
    );
  }

  getInstagramAuthUrl(): string {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    const scope = 'user_profile';

    if (!clientId || !redirectUri) {
      throw new Error('Missing Instagram OAuth configuration');
    }

    return (
      `https://api.instagram.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code`
    );
  }

  getWhatsAppAuthUrl(): string {
    const clientId = process.env.WHATSAPP_CLIENT_ID;
    const redirectUri = process.env.WHATSAPP_REDIRECT_URI;
    const scope = 'whatsapp_business_management';

    if (!clientId || !redirectUri) {
      throw new Error('Missing WhatsApp OAuth configuration');
    }

    return (
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `state=whatsapp_auth`
    );
  }
}
