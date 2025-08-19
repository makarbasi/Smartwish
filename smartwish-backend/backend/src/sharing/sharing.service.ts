import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

export interface SharedCard {
  id: string;
  designId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  message: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SharingService {
  private sharedCardsFile = path.join(process.cwd(), 'shared-cards.json');
  private sharedCards: SharedCard[] = [];

  constructor() {
    this.loadSharedCards();
  }

  private loadSharedCards() {
    try {
      if (fs.existsSync(this.sharedCardsFile)) {
        const data = fs.readFileSync(this.sharedCardsFile, 'utf8');
        this.sharedCards = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading shared cards:', error);
      this.sharedCards = [];
    }
  }

  private saveSharedCards() {
    try {
      fs.writeFileSync(
        this.sharedCardsFile,
        JSON.stringify(this.sharedCards, null, 2),
      );
    } catch (error) {
      console.error('Error saving shared cards:', error);
    }
  }

  async shareCard(
    designId: string,
    userId: string,
    recipientEmail: string,
    recipientName: string,
    message: string,
  ): Promise<{ success: boolean; shareId?: string; error?: string }> {
    try {
      // Generate unique share ID
      const shareId = uuidv4();

      // Create shared card record
      const sharedCard: SharedCard = {
        id: shareId,
        designId,
        userId,
        recipientEmail,
        recipientName,
        message,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      // Save to storage
      this.sharedCards.push(sharedCard);
      this.saveSharedCards();

      // Send email
      const emailSent = await this.sendShareEmail(sharedCard);

      if (emailSent) {
        return { success: true, shareId };
      } else {
        return { success: false, error: 'Failed to send email' };
      }
    } catch (error) {
      console.error('Error sharing card:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async getSharedCard(shareId: string): Promise<SharedCard | null> {
    const sharedCard = this.sharedCards.find((card) => card.id === shareId);

    if (!sharedCard) {
      return null;
    }

    // Check if expired
    if (new Date() > sharedCard.expiresAt) {
      return null;
    }

    return sharedCard;
  }

  private async sendShareEmail(sharedCard: SharedCard): Promise<boolean> {
    try {
      // Create transporter (you'll need to configure this with your email service)
      const transporter = nodemailer.createTransport({
        service: 'gmail', // or your preferred email service
        auth: {
          user: process.env.EMAIL_USER || 'your-email@gmail.com',
          pass: process.env.EMAIL_PASS || 'your-app-password',
        },
        tls: {
          rejectUnauthorized: false, // This will bypass SSL certificate validation
        },
        secure: true, // Use SSL
      });

      const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/view/${sharedCard.id}`;

      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: sharedCard.recipientEmail,
        subject: 'You received a greeting card from SmartWish!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 28px;">SmartWish</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Digital Greeting Cards</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333; margin-bottom: 20px;">You have a greeting card waiting for you!</h2>
              
              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <p style="color: #666; margin-bottom: 15px;"><strong>From:</strong> ${sharedCard.recipientName}</p>
                ${sharedCard.message ? `<p style="color: #333; font-style: italic; margin-bottom: 15px;">"${sharedCard.message}"</p>` : ''}
                <p style="color: #666; margin-bottom: 20px;">Click the button below to view your personalized greeting card:</p>
                
                <a href="${shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
                  View Your Card
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This link will expire in 30 days. If you have any issues, please contact the sender.
              </p>
            </div>
            
            <div style="background: #333; padding: 20px; text-align: center; color: white;">
              <p style="margin: 0; font-size: 14px;">© 2024 SmartWish. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Clean up expired shares (can be called periodically)
  cleanupExpiredShares() {
    const now = new Date();
    this.sharedCards = this.sharedCards.filter((card) => now <= card.expiresAt);
    this.saveSharedCards();
  }
}
