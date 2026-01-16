import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { SavedDesignsService } from '../saved-designs/saved-designs.service';

export interface ECard {
    id: string;
    cardId: string;
    userId: string;
    recipientEmail: string;
    senderName: string;
    senderEmail: string;
    message: string;
    createdAt: Date;
    expiresAt: Date;
    cardData?: any; // The actual card data for viewing
}

@Injectable()
export class ECardService {
    private eCardsFile = path.join(process.cwd(), 'ecards.json');
    private eCards: ECard[] = [];

    constructor(private readonly savedDesignsService: SavedDesignsService) {
        this.loadECards();
    }

    private loadECards() {
        try {
            if (fs.existsSync(this.eCardsFile)) {
                const data = fs.readFileSync(this.eCardsFile, 'utf8');
                this.eCards = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading E-Cards:', error);
            this.eCards = [];
        }
    }

    private saveECards() {
        try {
            fs.writeFileSync(
                this.eCardsFile,
                JSON.stringify(this.eCards, null, 2),
            );
        } catch (error) {
            console.error('Error saving E-Cards:', error);
        }
    }

    async sendECard(
        cardId: string,
        userId: string,
        recipientEmail: string,
        message: string,
        senderName: string,
        senderEmail: string,
    ): Promise<{ success: boolean; shareId?: string; error?: string }> {
        try {
            console.log('🔍 ECard Service - Attempting to find card:', { cardId, userId });

            // First try to get the card as a saved design
            let cardData = await this.savedDesignsService.getDesignById(userId, cardId);
            console.log('📋 Found saved design:', !!cardData);

            // If not found, try to get it as a public design (for published cards)
            if (!cardData) {
                console.log('🔍 Trying to get public design...');
                cardData = await this.savedDesignsService.getPublicDesignById(cardId);
                console.log('📋 Found public design:', !!cardData);

                // Verify the user is the author of the public design
                // Check multiple possible user ID fields
                const cardUserId = cardData?.userId || cardData?.createdByUserId || cardData?.authorId;
                if (cardData && cardUserId !== userId) {
                    console.log('❌ User is not the author of this public design', {
                        expectedUserId: userId,
                        cardUserId,
                        cardData: {
                            id: cardData.id,
                            userId: cardData.userId,
                            createdByUserId: cardData.createdByUserId,
                            authorId: cardData.authorId
                        }
                    });
                    cardData = null;
                }
            }

            if (!cardData) {
                console.log('❌ Card not found:', { cardId, userId });
                return { success: false, error: 'Card not found or you do not have permission to share it' };
            }

            console.log('✅ Card found, proceeding with E-Card creation');

            // Generate unique share ID
            const shareId = uuidv4();

            // Create E-Card record
            const eCard: ECard = {
                id: shareId,
                cardId,
                userId,
                recipientEmail,
                senderName,
                senderEmail,
                message,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                cardData, // Store the card data for viewing
            };

            // Save to storage
            this.eCards.push(eCard);
            this.saveECards();

            // Send email
            console.log('📧 Attempting to send E-Card email...');
            const emailSent = await this.sendECardEmail(eCard);

            if (emailSent) {
                console.log('✅ E-Card created and email sent successfully');
                return { success: true, shareId };
            } else {
                console.log('❌ E-Card created but email sending failed');
                // Remove the eCard from storage since email failed
                this.eCards = this.eCards.filter(card => card.id !== shareId);
                this.saveECards();
                return { success: false, error: 'Failed to send email. Please check your email configuration or try again later.' };
            }
        } catch (error) {
            console.error('❌ Error in sendECard method:', error);
            
            // Log specific error details
            if (error instanceof Error) {
                console.error('❌ Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            
            return { success: false, error: 'Internal server error occurred while sending E-Card' };
        }
    }

    async getECard(shareId: string): Promise<ECard | null> {
        const eCard = this.eCards.find((card) => card.id === shareId);

        if (!eCard) {
            return null;
        }

        // Check if expired
        if (new Date() > new Date(eCard.expiresAt)) {
            return null;
        }

        return eCard;
    }

    private async sendECardEmail(eCard: ECard): Promise<boolean> {
        try {
            console.log('📧 Attempting to send E-Card email to:', eCard.recipientEmail);
            console.log('📧 Email configuration:', {
                user: process.env.EMAIL_USER ? 'configured' : 'missing',
                pass: process.env.EMAIL_PASS ? 'configured' : 'missing'
            });

            // Check if email configuration is available
            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
                console.error('❌ Email configuration missing');
                return false;
            }

            // Create transporter with SMTP configuration (supports Office 365, Gmail, GoDaddy, and other SMTP servers)
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.office365.com',
                port: parseInt(process.env.SMTP_PORT || '587', 10),
                secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
                tls: {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2' // Office 365 requires TLS 1.2+
                },
            });

            // Test the connection
            console.log('🔍 Testing email connection...');
            await transporter.verify();
            console.log('✅ Email connection verified');

            const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/ecard/${eCard.id}`;

            const mailOptions = {
                from: process.env.EMAIL_USER || 'your-email@gmail.com',
                to: eCard.recipientEmail,
                subject: `${eCard.senderName} sent you a beautiful E-Card from SmartWish! 🎉`,
                html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>You received an E-Card!</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                <div style="background: rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 20px; display: inline-block; margin-bottom: 20px;">
                  <div style="width: 60px; height: 60px; background: white; border-radius: 15px; display: inline-flex; align-items: center; justify-content: center; font-size: 30px;">
                    🎁
                  </div>
                </div>
                <h1 style="margin: 0; font-size: 32px; color: white; font-weight: 700; margin-bottom: 10px;">SmartWish</h1>
                <p style="margin: 0; font-size: 18px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">Digital Greeting Cards</p>
              </div>
              
              <!-- Main Content -->
              <div style="padding: 40px 30px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="color: #1a202c; margin: 0 0 15px 0; font-size: 28px; font-weight: 700;">You received a special E-Card! ✨</h2>
                  <p style="color: #4a5568; margin: 0; font-size: 18px; line-height: 1.6;">
                    <strong style="color: #2d3748;">${eCard.senderName}</strong> has sent you a beautiful digital greeting card
                  </p>
                </div>
                
                <!-- Card Preview Box -->
                <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 20px; padding: 30px; margin: 30px 0; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);">
                      <span style="font-size: 40px; color: white;">📧</span>
                    </div>
                    <h3 style="color: #2d3748; margin: 0; font-size: 20px; font-weight: 600;">Digital Greeting Card</h3>
                  </div>
                  
                  ${eCard.message ? `
                  <div style="background: white; border-radius: 15px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                    <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.6; font-style: italic;">
                      "${eCard.message}"
                    </p>
                    <p style="color: #718096; margin: 10px 0 0 0; font-size: 14px; text-align: right;">
                      — ${eCard.senderName}
                    </p>
                  </div>
                  ` : ''}
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${shareUrl}" 
                     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                    🎁 View Your E-Card
                  </a>
                </div>
                
                <!-- Features -->
                <div style="background: #f8fafc; border-radius: 15px; padding: 25px; margin: 30px 0;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h4 style="color: #2d3748; margin: 0; font-size: 18px; font-weight: 600;">What you can do:</h4>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">
                    <div style="flex: 1; min-width: 150px; text-align: center; padding: 15px;">
                      <div style="font-size: 24px; margin-bottom: 8px;">📱</div>
                      <p style="color: #4a5568; margin: 0; font-size: 14px; font-weight: 500;">View on any device</p>
                    </div>
                    <div style="flex: 1; min-width: 150px; text-align: center; padding: 15px;">
                      <div style="font-size: 24px; margin-bottom: 8px;">🔄</div>
                      <p style="color: #4a5568; margin: 0; font-size: 14px; font-weight: 500;">Flip through pages</p>
                    </div>
                    <div style="flex: 1; min-width: 150px; text-align: center; padding: 15px;">
                      <div style="font-size: 24px; margin-bottom: 8px;">🎨</div>
                      <p style="color: #4a5568; margin: 0; font-size: 14px; font-weight: 500;">Beautiful animations</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #1a202c; padding: 30px; text-align: center;">
                <div style="margin-bottom: 20px;">
                  <h4 style="color: white; margin: 0 0 10px 0; font-size: 20px; font-weight: 600;">Create Your Own E-Cards</h4>
                  <p style="color: #a0aec0; margin: 0; font-size: 14px; line-height: 1.5;">
                    Send beautiful digital greeting cards to your loved ones
                  </p>
                </div>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                   style="display: inline-block; background: transparent; color: white; text-decoration: none; padding: 12px 25px; border: 2px solid white; border-radius: 25px; font-size: 14px; font-weight: 600; margin-bottom: 20px;">
                  Visit SmartWish
                </a>
                <div style="border-top: 1px solid #2d3748; margin: 20px 0; padding-top: 20px;">
                  <p style="color: #718096; margin: 0; font-size: 12px;">
                    This E-Card will be available for 90 days. If you have any issues viewing it, please contact us.
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
            };

            console.log('📤 Sending email...');
            const result = await transporter.sendMail(mailOptions);
            console.log('✅ E-Card email sent successfully to:', eCard.recipientEmail);
            console.log('📧 Email result:', { messageId: result.messageId, response: result.response });
            return true;
        } catch (error) {
            console.error('❌ Error sending E-Card email:', error);
            
            // Log specific error details
            if (error instanceof Error) {
                console.error('❌ Error name:', error.name);
                console.error('❌ Error message:', error.message);
                if ('code' in error) {
                    console.error('❌ Error code:', error.code);
                }
            }
            
            return false;
        }
    }
}
