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

@Controller('sharing')
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
}
