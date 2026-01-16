import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

// ==================== Admin Earnings Endpoints ====================

@Controller('admin/earnings')
@UseGuards(JwtAuthGuard)
export class AdminEarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  /**
   * Get all earnings (admin view)
   */
  @Get()
  async getAllEarnings(
    @Query('kioskId') kioskId?: string,
    @Query('transactionType') transactionType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.earningsService.getAllEarnings({
      kioskId,
      transactionType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get earnings for a specific kiosk
   */
  @Get('kiosk/:kioskId')
  async getKioskEarnings(
    @Param('kioskId') kioskId: string,
    @Query('days') days?: string,
  ) {
    return this.earningsService.getEarningsByKiosk(kioskId, days ? parseInt(days) : 30);
  }

  /**
   * Manually record a print product sale (for testing/backfilling)
   */
  @Post('record/print-product')
  async recordPrintProduct(
    @Body() body: {
      kioskId: string;
      type: 'greeting_card' | 'sticker';
      grossAmount: number;
      processingFees: number;
      stateTax: number;
      productCost?: number;
      productName?: string;
      customerName?: string;
      orderId?: string;
    },
  ) {
    if (!body.kioskId || !body.type || body.grossAmount === undefined) {
      throw new BadRequestException('kioskId, type, and grossAmount are required');
    }
    return this.earningsService.recordPrintProductSale(body);
  }

  /**
   * Manually record an e-card sale
   */
  @Post('record/ecard')
  async recordEcard(
    @Body() body: {
      kioskId: string;
      ecardId?: string;
      customerName?: string;
    },
  ) {
    if (!body.kioskId) {
      throw new BadRequestException('kioskId is required');
    }
    return this.earningsService.recordEcardSale(body);
  }

  /**
   * Manually record a generic gift card sale
   */
  @Post('record/generic-gift-card')
  async recordGenericGiftCard(
    @Body() body: {
      kioskId: string;
      giftCardId?: string;
      faceValue: number;
      giftCardBrand?: string;
      customerName?: string;
    },
  ) {
    if (!body.kioskId || body.faceValue === undefined) {
      throw new BadRequestException('kioskId and faceValue are required');
    }
    return this.earningsService.recordGenericGiftCardSale(body);
  }

  /**
   * Manually record a custom gift card purchase
   */
  @Post('record/custom-gift-card-purchase')
  async recordCustomGiftCardPurchase(
    @Body() body: {
      kioskId: string;
      giftCardId?: string;
      faceValue: number;
      smartwishDiscountPercent: number;
      managerDiscountPercent: number;
      storeName?: string;
      customerName?: string;
    },
  ) {
    if (
      !body.kioskId ||
      body.faceValue === undefined ||
      body.smartwishDiscountPercent === undefined ||
      body.managerDiscountPercent === undefined
    ) {
      throw new BadRequestException(
        'kioskId, faceValue, smartwishDiscountPercent, and managerDiscountPercent are required',
      );
    }
    return this.earningsService.recordCustomGiftCardPurchase(body);
  }

  /**
   * Manually record a custom gift card redemption
   */
  @Post('record/custom-gift-card-redemption')
  async recordCustomGiftCardRedemption(
    @Body() body: {
      kioskId: string;
      redemptionId?: string;
      purchaseLedgerId?: string;
      faceValue: number;
      amountRedeemed: number;
      smartwishDiscountPercent: number;
      managerDiscountPercent: number;
      serviceFeePercent: number;
      storeId?: string;
      storeName?: string;
      customerName?: string;
    },
  ) {
    if (
      !body.kioskId ||
      body.faceValue === undefined ||
      body.amountRedeemed === undefined ||
      body.serviceFeePercent === undefined
    ) {
      throw new BadRequestException(
        'kioskId, faceValue, amountRedeemed, and serviceFeePercent are required',
      );
    }
    return this.earningsService.recordCustomGiftCardRedemption(body);
  }
}

// ==================== Manager Earnings Endpoints ====================

@Controller('manager/earnings')
@UseGuards(JwtAuthGuard)
export class ManagerEarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  /**
   * Get earnings for the authenticated manager
   */
  @Get()
  async getMyEarnings(
    @Request() req: any,
    @Query('kioskId') kioskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.earningsService.getManagerEarnings(req.user.id, {
      kioskId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get earnings summary for a specific kiosk
   */
  @Get('kiosk/:kioskId')
  async getKioskEarnings(
    @Param('kioskId') kioskId: string,
    @Query('days') days?: string,
  ) {
    return this.earningsService.getEarningsByKiosk(kioskId, days ? parseInt(days) : 30);
  }
}

// ==================== Public Earnings Recording (called by kiosk) ====================

@Controller('kiosk/earnings')
export class KioskEarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  /**
   * Record print product sale from kiosk
   */
  @Public()
  @Post('print-product')
  async recordPrintProduct(
    @Body() body: {
      kioskId: string;
      type: 'greeting_card' | 'sticker';
      grossAmount: number;
      processingFees: number;
      stateTax: number;
      productCost?: number;
      productName?: string;
      customerName?: string;
      orderId?: string;
    },
  ) {
    if (!body.kioskId || !body.type || body.grossAmount === undefined) {
      throw new BadRequestException('kioskId, type, and grossAmount are required');
    }
    return this.earningsService.recordPrintProductSale(body);
  }

  /**
   * Record e-card sale from kiosk
   */
  @Public()
  @Post('ecard')
  async recordEcard(
    @Body() body: {
      kioskId: string;
      ecardId?: string;
      customerName?: string;
    },
  ) {
    if (!body.kioskId) {
      throw new BadRequestException('kioskId is required');
    }
    return this.earningsService.recordEcardSale(body);
  }

  /**
   * Record generic gift card sale from kiosk
   */
  @Public()
  @Post('generic-gift-card')
  async recordGenericGiftCard(
    @Body() body: {
      kioskId: string;
      giftCardId?: string;
      faceValue: number;
      giftCardBrand?: string;
      customerName?: string;
    },
  ) {
    if (!body.kioskId || body.faceValue === undefined) {
      throw new BadRequestException('kioskId and faceValue are required');
    }
    return this.earningsService.recordGenericGiftCardSale(body);
  }

  /**
   * Record custom gift card purchase from kiosk
   */
  @Public()
  @Post('custom-gift-card-purchase')
  async recordCustomGiftCardPurchase(
    @Body() body: {
      kioskId: string;
      giftCardId?: string;
      faceValue: number;
      smartwishDiscountPercent: number;
      managerDiscountPercent: number;
      storeName?: string;
      customerName?: string;
    },
  ) {
    if (!body.kioskId || body.faceValue === undefined) {
      throw new BadRequestException('kioskId and faceValue are required');
    }
    return this.earningsService.recordCustomGiftCardPurchase({
      ...body,
      smartwishDiscountPercent: body.smartwishDiscountPercent || 0,
      managerDiscountPercent: body.managerDiscountPercent || 0,
    });
  }

  /**
   * Record custom gift card redemption
   */
  @Public()
  @Post('custom-gift-card-redemption')
  async recordCustomGiftCardRedemption(
    @Body() body: {
      kioskId: string;
      redemptionId?: string;
      purchaseLedgerId?: string;
      faceValue: number;
      amountRedeemed: number;
      smartwishDiscountPercent: number;
      managerDiscountPercent: number;
      serviceFeePercent: number;
      storeId?: string;
      storeName?: string;
      customerName?: string;
    },
  ) {
    if (!body.kioskId || body.faceValue === undefined || body.amountRedeemed === undefined) {
      throw new BadRequestException('kioskId, faceValue, and amountRedeemed are required');
    }
    return this.earningsService.recordCustomGiftCardRedemption({
      ...body,
      smartwishDiscountPercent: body.smartwishDiscountPercent || 0,
      managerDiscountPercent: body.managerDiscountPercent || 0,
      serviceFeePercent: body.serviceFeePercent || 0,
    });
  }
}
