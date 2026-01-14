import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';
import {
  CreateGiftCardBrandDto,
  UpdateGiftCardBrandDto,
  PurchaseGiftCardDto,
  CheckBalanceDto,
  RedeemGiftCardDto,
  UpdateGiftCardStatusDto,
} from './dto/gift-card.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

// ==================== Public Brand Endpoints ====================

@Controller('gift-card-brands')
export class GiftCardBrandsPublicController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  /**
   * Get all active gift card brands (for marketplace)
   */
  @Public()
  @Get()
  async listBrands(@Query('promoted') promoted?: string) {
    const brands = await this.giftCardsService.listBrands(false);
    if (promoted === 'true') {
      return { brands: brands.filter(b => b.isPromoted), count: brands.filter(b => b.isPromoted).length };
    }
    return { brands, count: brands.length };
  }
}

// ==================== Public Gift Card Endpoints ====================

@Controller('gift-cards')
export class GiftCardsPublicController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  /**
   * Purchase a new gift card
   */
  @Public()
  @Post('purchase')
  async purchase(@Body() dto: PurchaseGiftCardDto) {
    const giftCard = await this.giftCardsService.purchaseGiftCard(dto);
    return { success: true, giftCard };
  }

  /**
   * Lookup gift card by code or number (public info only)
   */
  @Public()
  @Get('lookup')
  async lookup(
    @Query('cardCode') cardCode?: string,
    @Query('cardNumber') cardNumber?: string,
  ) {
    const card = await this.giftCardsService.lookupCard(cardCode, cardNumber);
    return { success: true, card };
  }
}

// ==================== Manager Gift Card Endpoints ====================

@Controller('manager/gift-cards')
@UseGuards(JwtAuthGuard)
export class ManagerGiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  /**
   * Check balance (requires PIN)
   */
  @Post('check-balance')
  async checkBalance(@Body() dto: CheckBalanceDto) {
    const card = await this.giftCardsService.checkBalance(dto);
    return { success: true, card };
  }

  /**
   * Redeem gift card
   */
  @Post('redeem')
  async redeem(@Body() dto: RedeemGiftCardDto, @Request() req: any) {
    const result = await this.giftCardsService.redeemGiftCard(dto, req.user?.id);
    return result;
  }

  /**
   * Get transaction history for a card
   */
  @Get(':id/transactions')
  async getTransactions(@Param('id') id: string) {
    const { card, transactions } = await this.giftCardsService.getCardTransactions(id);
    return {
      success: true,
      cardNumber: card.cardNumber,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description,
        timestamp: t.createdAt,
        referenceId: t.referenceId,
      })),
      count: transactions.length,
    };
  }
}

// ==================== Admin Brand Endpoints ====================

@Controller('admin/gift-card-brands')
@UseGuards(JwtAuthGuard)
export class AdminGiftCardBrandsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  /**
   * List all brands (including inactive)
   */
  @Get()
  async listBrands(@Query('includeInactive') includeInactive?: string) {
    const brands = await this.giftCardsService.listBrands(includeInactive === 'true');
    return { brands, count: brands.length };
  }

  /**
   * Get single brand
   */
  @Get(':id')
  async getBrand(@Param('id') id: string) {
    const brand = await this.giftCardsService.getBrandById(id);
    return { brand };
  }

  /**
   * Create brand
   */
  @Post()
  async createBrand(@Body() dto: CreateGiftCardBrandDto) {
    const brand = await this.giftCardsService.createBrand(dto);
    return { success: true, brand };
  }

  /**
   * Update brand
   */
  @Patch(':id')
  async updateBrand(@Param('id') id: string, @Body() dto: UpdateGiftCardBrandDto) {
    const brand = await this.giftCardsService.updateBrand(id, dto);
    return { success: true, brand };
  }

  /**
   * Delete/deactivate brand
   */
  @Delete(':id')
  async deleteBrand(@Param('id') id: string) {
    return this.giftCardsService.deleteBrand(id);
  }
}

// ==================== Admin Gift Card Endpoints ====================

@Controller('admin/gift-cards')
@UseGuards(JwtAuthGuard)
export class AdminGiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  /**
   * List all gift cards with filtering
   */
  @Get()
  async listCards(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('brandId') brandId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.giftCardsService.listCards({
      page: page ? parseInt(page) : 0,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      brandId,
      status,
      search,
    });

    return {
      success: true,
      cards: result.cards.map(card => ({
        id: card.id,
        cardNumber: card.cardNumber,
        initialBalance: card.initialBalance,
        currentBalance: card.currentBalance,
        status: card.status,
        issuedAt: card.issuedAt,
        activatedAt: card.activatedAt,
        expiresAt: card.expiresAt,
        purchaseOrderId: card.purchaseOrderId,
        kioskId: card.kioskId,
        brand: card.brand ? {
          id: card.brand.id,
          name: card.brand.name,
          slug: card.brand.slug,
          logo: card.brand.logoUrl,
        } : null,
      })),
      pagination: result.pagination,
    };
  }

  /**
   * Get single card with transactions
   */
  @Get(':id')
  async getCard(@Param('id') id: string) {
    const { card, transactions } = await this.giftCardsService.getCardTransactions(id);
    return {
      success: true,
      card: {
        id: card.id,
        cardNumber: card.cardNumber,
        initialBalance: card.initialBalance,
        currentBalance: card.currentBalance,
        status: card.status,
        issuedAt: card.issuedAt,
        activatedAt: card.activatedAt,
        expiresAt: card.expiresAt,
        purchaseOrderId: card.purchaseOrderId,
        kioskId: card.kioskId,
        metadata: card.metadata,
        brand: card.brand ? {
          id: card.brand.id,
          name: card.brand.name,
          slug: card.brand.slug,
          logo: card.brand.logoUrl,
          isSmartWishBrand: card.brand.isSmartWishBrand,
        } : null,
      },
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description,
        performedBy: t.performedBy,
        kioskId: t.kioskId,
        referenceId: t.referenceId,
        timestamp: t.createdAt,
      })),
    };
  }

  /**
   * Update card status (void, suspend, etc.)
   */
  @Patch(':id')
  async updateCardStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGiftCardStatusDto,
    @Request() req: any,
  ) {
    return this.giftCardsService.updateCardStatus(id, dto, req.user?.id);
  }

  /**
   * Get analytics reports
   */
  @Get('reports/summary')
  async getReports(@Query('days') days?: string) {
    return this.giftCardsService.getReports(days ? parseInt(days) : 30);
  }
}
