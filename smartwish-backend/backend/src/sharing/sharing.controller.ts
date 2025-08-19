import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SharingService } from './sharing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as nodemailer from 'nodemailer';
// @ts-ignore
import * as dotenv from 'dotenv';
dotenv.config();

@Controller('api/sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('share')
  @UseGuards(JwtAuthGuard)
  async shareCard(
    @Request() req: any,
    @Body()
    body: {
      designId: string;
      recipientEmail: string;
      recipientName: string;
      message?: string;
    },
  ) {
    const result = await this.sharingService.shareCard(
      body.designId,
      req.user.userId,
      body.recipientEmail,
      body.recipientName,
      body.message || '',
    );

    if (result.success) {
      return { success: true, shareId: result.shareId };
    } else {
      return { success: false, error: result.error };
    }
  }

  @Get('view/:shareId')
  async getSharedCard(@Param('shareId') shareId: string) {
    const sharedCard = await this.sharingService.getSharedCard(shareId);

    if (!sharedCard) {
      return { success: false, error: 'Card not found or expired' };
    }

    return { success: true, sharedCard };
  }

  @Post('email')
  async sendCardByEmail(
    @Body() body: { recipientEmail: string; message: string; cardId: string },
  ) {
    const { recipientEmail, message, cardId } = body;
    if (!recipientEmail || !cardId) {
      return { success: false, error: 'Missing recipient email or card ID' };
    }

    // Construct the card link (adjust frontend URL as needed)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const cardLink = `${frontendUrl}/card/${cardId}`;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: 'You received a greeting card!',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; padding: 0; margin: 0;">
          <div style="max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 0 24px 0; text-align: center;">
              <img src='${process.env.FRONTEND_URL || 'http://localhost:3000'}/logo.png' alt='SmartWish Logo' style='height: 48px; margin-bottom: 12px;' />
              <h1 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">You've Received a Greeting Card!</h1>
            </div>
            <div style="padding: 32px 32px 16px 32px; text-align: center;">
              <p style="font-size: 1.1rem; color: #333; margin-bottom: 24px;">${message ? `<span style='font-style: italic; color: #764ba2;'>${message}</span>` : 'A friend has sent you a special greeting card.'}</p>
              <a href="${cardLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 8px; font-size: 1.1rem; margin-bottom: 24px;">View Your Card</a>
            </div>
            <div style="background: #f5f7fa; padding: 24px 0; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 0.95rem; margin: 0;">Sent with <span style="color: #e25555;">♥</span> by <b>SmartWish</b></p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="color: #667eea; text-decoration: none; font-size: 0.95rem;">Visit SmartWish</a>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
