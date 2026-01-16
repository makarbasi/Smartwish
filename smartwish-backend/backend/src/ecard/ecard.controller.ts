import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UseGuards,
    Request,
    HttpStatus,
    HttpException,
} from '@nestjs/common';
import { ECardService } from './ecard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/ecard')
export class ECardController {
    constructor(private readonly eCardService: ECardService) { }

    @Get('test')
    async testECard() {
        return { success: true, message: 'E-Card service is working' };
    }

    @Post('send')
    @UseGuards(JwtAuthGuard)
    async sendECard(
        @Request() req: any,
        @Body()
        body: {
            cardId: string;
            recipientEmail: string;
            message?: string;
            senderName?: string;
            senderEmail?: string;
        },
    ) {
        const { cardId, recipientEmail, message, senderName, senderEmail } = body;

        console.log('🔍 ECard Controller - Request details:', {
            cardId,
            recipientEmail,
            user: req.user,
            userId: req.user?.userId || req.user?.id || req.user?.sub,
        });

        if (!cardId || !recipientEmail) {
            return { success: false, error: 'Card ID and recipient email are required' };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return { success: false, error: 'Invalid email address format' };
        }

        // Try different user ID properties from JWT payload
        const userId = req.user?.userId || req.user?.id || req.user?.sub;

        if (!userId) {
            console.log('❌ No user ID found in request:', req.user);
            return { success: false, error: 'Authentication error: User ID not found' };
        }

        const result = await this.eCardService.sendECard(
            cardId,
            userId,
            recipientEmail,
            message || '',
            senderName || req.user.name || 'A SmartWish user',
            senderEmail || req.user.email || '',
        );

        if (result.success) {
            return {
                success: true,
                shareId: result.shareId,
                message: 'E-Card sent successfully!'
            };
        } else {
            // Return appropriate HTTP status codes based on error type
            if (result.error?.includes('not found') || result.error?.includes('permission')) {
                throw new HttpException(
                    { success: false, error: result.error },
                    HttpStatus.NOT_FOUND
                );
            } else if (result.error?.includes('Authentication')) {
                throw new HttpException(
                    { success: false, error: result.error },
                    HttpStatus.UNAUTHORIZED
                );
            } else {
                throw new HttpException(
                    { success: false, error: result.error },
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
        }
    }

    @Get('view/:shareId')
    async getECard(@Param('shareId') shareId: string) {
        const eCard = await this.eCardService.getECard(shareId);

        if (!eCard) {
            return { success: false, error: 'E-Card not found or expired' };
        }

        return { success: true, eCard };
    }
}
