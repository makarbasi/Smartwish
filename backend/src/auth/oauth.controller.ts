import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { OAuthService } from './oauth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  @Get('google')
  @Public()
  async googleAuth(@Res() res: Response) {
    const authUrl = this.oauthService.getGoogleAuthUrl();
    res.redirect(authUrl);
  }

  @Get('google/callback')
  @Public()
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      // Exchange code for access token and get user profile
      const profile = await this.exchangeGoogleCode(code);
      const result = await this.oauthService.handleOAuthCallback(profile);

      // Redirect to frontend with token
      const callbackUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log('Google OAuth: Redirecting to frontend with token:', { 
        callbackUrl, 
        hasToken: !!result.access_token,
        tokenLength: result.access_token?.length,
        userInfo: result.user
      });
      res.redirect(
        `${callbackUrl}?token=${result.access_token}&provider=google`,
      );
    } catch (error) {
      console.error('Google OAuth error:', error);
      const errorUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${errorUrl}/auth/error?message=Google authentication failed`,
      );
    }
  }

  @Get('instagram')
  @Public()
  async instagramAuth(@Res() res: Response) {
    const authUrl = this.oauthService.getInstagramAuthUrl();
    res.redirect(authUrl);
  }

  @Get('instagram/callback')
  @Public()
  async instagramCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      // Exchange code for access token and get user profile
      const profile = await this.exchangeInstagramCode(code);
      const result = await this.oauthService.handleOAuthCallback(profile);

      // Redirect to frontend with token
      const callbackUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${callbackUrl}?token=${result.access_token}&provider=instagram`,
      );
    } catch (error) {
      console.error('Instagram OAuth error:', error);
      const errorUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${errorUrl}/auth/error?message=Instagram authentication failed`,
      );
    }
  }

  @Get('whatsapp')
  @Public()
  async whatsappAuth(@Res() res: Response) {
    const authUrl = this.oauthService.getWhatsAppAuthUrl();
    res.redirect(authUrl);
  }

  @Get('whatsapp/callback')
  @Public()
  async whatsappCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      // Exchange code for access token and get user profile
      const profile = await this.exchangeWhatsAppCode(code);
      const result = await this.oauthService.handleOAuthCallback(profile);

      // Redirect to frontend with token
      const callbackUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${callbackUrl}?token=${result.access_token}&provider=whatsapp`,
      );
    } catch (error) {
      console.error('WhatsApp OAuth error:', error);
      const errorUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${errorUrl}/auth/error?message=WhatsApp authentication failed`,
      );
    }
  }

  private async exchangeGoogleCode(code: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URL;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Google OAuth configuration');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange Google code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user profile
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!profileResponse.ok) {
      throw new Error('Failed to get Google user profile');
    }

    const profileData = await profileResponse.json();

    return {
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
      picture: profileData.picture,
      provider: 'google' as const,
    };
  }

  private async exchangeInstagramCode(code: string) {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Instagram OAuth configuration');
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://api.instagram.com/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange Instagram code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userId = tokenData.user_id;

    // Get user profile
    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`,
    );

    if (!profileResponse.ok) {
      throw new Error('Failed to get Instagram user profile');
    }

    const profileData = await profileResponse.json();

    return {
      id: profileData.id,
      email: `${profileData.username}@instagram.com`, // Instagram doesn't provide email
      name: profileData.username,
      picture: undefined, // Instagram doesn't provide profile picture in basic scope
      provider: 'instagram' as const,
    };
  }

  private async exchangeWhatsAppCode(code: string) {
    const clientId = process.env.WHATSAPP_CLIENT_ID;
    const clientSecret = process.env.WHATSAPP_CLIENT_SECRET;
    const redirectUri = process.env.WHATSAPP_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing WhatsApp OAuth configuration');
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange WhatsApp code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user profile
    const profileResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`,
    );

    if (!profileResponse.ok) {
      throw new Error('Failed to get WhatsApp user profile');
    }

    const profileData = await profileResponse.json();

    return {
      id: profileData.id,
      email: profileData.email || `${profileData.name}@whatsapp.com`,
      name: profileData.name,
      picture: undefined, // WhatsApp doesn't provide profile picture in basic scope
      provider: 'whatsapp' as const,
    };
  }
}
