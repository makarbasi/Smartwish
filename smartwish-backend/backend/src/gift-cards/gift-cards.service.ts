import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { GiftCardBrand } from './gift-card-brand.entity';
import { GiftCard, GiftCardStatus } from './gift-card.entity';
import { GiftCardTransaction, TransactionType } from './gift-card-transaction.entity';
import {
  CreateGiftCardBrandDto,
  UpdateGiftCardBrandDto,
  PurchaseGiftCardDto,
  CheckBalanceDto,
  RedeemGiftCardDto,
  UpdateGiftCardStatusDto,
} from './dto/gift-card.dto';

@Injectable()
export class GiftCardsService {
  constructor(
    @InjectRepository(GiftCardBrand)
    private readonly brandRepo: Repository<GiftCardBrand>,
    @InjectRepository(GiftCard)
    private readonly cardRepo: Repository<GiftCard>,
    @InjectRepository(GiftCardTransaction)
    private readonly transactionRepo: Repository<GiftCardTransaction>,
  ) {}

  // ==================== Brand Methods ====================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async listBrands(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.brandRepo.find({
      where,
      order: { isPromoted: 'DESC', name: 'ASC' },
    });
  }

  async getBrandById(id: string) {
    const brand = await this.brandRepo.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async createBrand(dto: CreateGiftCardBrandDto) {
    // Validate min/max
    if (dto.minAmount >= dto.maxAmount) {
      throw new BadRequestException('Minimum amount must be less than maximum amount');
    }

    // Generate slug
    let slug = this.generateSlug(dto.name);

    // Check for existing name/slug
    const existing = await this.brandRepo.findOne({
      where: [{ name: dto.name }, { slug }],
    });
    if (existing) {
      throw new ConflictException('A brand with this name already exists');
    }

    const brand = this.brandRepo.create({
      name: dto.name,
      slug,
      description: dto.description,
      logoUrl: dto.logoUrl,
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      expiryMonths: dto.expiryMonths ?? 12,
      isPromoted: dto.isPromoted ?? false,
      isSmartWishBrand: dto.isSmartWishBrand ?? true,
      isActive: true,
    });

    return this.brandRepo.save(brand);
  }

  async updateBrand(id: string, dto: UpdateGiftCardBrandDto) {
    const brand = await this.getBrandById(id);

    // Validate min/max if both provided
    const newMin = dto.minAmount ?? brand.minAmount;
    const newMax = dto.maxAmount ?? brand.maxAmount;
    if (newMin >= newMax) {
      throw new BadRequestException('Minimum amount must be less than maximum amount');
    }

    // Check for name/slug conflicts
    if (dto.name && dto.name !== brand.name) {
      const newSlug = this.generateSlug(dto.name);
      const existing = await this.brandRepo.findOne({
        where: [{ name: dto.name }, { slug: newSlug }],
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('A brand with this name already exists');
      }
      brand.slug = newSlug;
    }

    // Update fields
    Object.assign(brand, {
      name: dto.name ?? brand.name,
      description: dto.description ?? brand.description,
      logoUrl: dto.logoUrl ?? brand.logoUrl,
      minAmount: dto.minAmount ?? brand.minAmount,
      maxAmount: dto.maxAmount ?? brand.maxAmount,
      expiryMonths: dto.expiryMonths ?? brand.expiryMonths,
      isActive: dto.isActive ?? brand.isActive,
      isPromoted: dto.isPromoted ?? brand.isPromoted,
      isSmartWishBrand: dto.isSmartWishBrand ?? brand.isSmartWishBrand,
    });

    return this.brandRepo.save(brand);
  }

  async deleteBrand(id: string) {
    const brand = await this.getBrandById(id);

    // Check for active cards
    const activeCards = await this.cardRepo.count({
      where: { brandId: id, status: GiftCardStatus.ACTIVE },
    });

    if (activeCards > 0) {
      // Soft delete - just deactivate
      brand.isActive = false;
      await this.brandRepo.save(brand);
      return { success: true, deactivated: true, activeCards };
    }

    // Hard delete if no active cards
    await this.brandRepo.remove(brand);
    return { success: true, deleted: true };
  }

  // ==================== Gift Card Methods ====================

  private generateCardNumber(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let number = 'SW';
    for (let i = 0; i < 14; i++) {
      number += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return number;
  }

  private generatePIN(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async purchaseGiftCard(dto: PurchaseGiftCardDto) {
    // Validate brand
    const brand = await this.brandRepo.findOne({
      where: { id: dto.brandId, isActive: true },
    });
    if (!brand) {
      throw new NotFoundException('Gift card brand not found or inactive');
    }

    // Validate amount
    if (dto.amount < brand.minAmount || dto.amount > brand.maxAmount) {
      throw new BadRequestException(
        `Amount must be between $${brand.minAmount} and $${brand.maxAmount}`,
      );
    }

    // Generate credentials
    let cardNumber = this.generateCardNumber();
    const cardCode = randomUUID();
    const pin = this.generatePIN();
    const pinHash = await bcrypt.hash(pin, 10);

    // Ensure unique card number
    let attempts = 0;
    while (attempts < 5) {
      const existing = await this.cardRepo.findOne({ where: { cardNumber } });
      if (!existing) break;
      cardNumber = this.generateCardNumber();
      attempts++;
    }
    if (attempts >= 5) {
      throw new BadRequestException('Failed to generate unique card number');
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + brand.expiryMonths);

    // Create card
    const card = this.cardRepo.create({
      brandId: dto.brandId,
      cardNumber,
      cardCode,
      pinHash,
      initialBalance: dto.amount,
      currentBalance: dto.amount,
      status: GiftCardStatus.ACTIVE,
      expiresAt,
      purchaseOrderId: dto.paymentIntentId,
      kioskId: dto.kioskId,
    });
    const savedCard = await this.cardRepo.save(card);

    // Create purchase transaction
    await this.transactionRepo.save({
      giftCardId: savedCard.id,
      transactionType: TransactionType.PURCHASE,
      amount: dto.amount,
      balanceBefore: 0,
      balanceAfter: dto.amount,
      description: `Initial purchase of ${brand.name} gift card`,
      kioskId: dto.kioskId,
      referenceId: dto.paymentIntentId,
    });

    // Build QR content
    const qrContent = JSON.stringify({
      type: 'smartwish_giftcard',
      code: cardCode,
      v: 1,
    });

    return {
      id: savedCard.id,
      cardNumber,
      cardCode,
      pin, // Plain PIN for printing
      balance: dto.amount,
      expiresAt: expiresAt.toISOString(),
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logoUrl,
        isSmartWishBrand: brand.isSmartWishBrand,
      },
      qrContent,
      source: 'smartwish',
    };
  }

  async lookupCard(cardCode?: string, cardNumber?: string) {
    let card: GiftCard | null = null;

    if (cardCode) {
      // Try parsing as QR content first
      try {
        const qrData = JSON.parse(cardCode);
        if (qrData.type === 'smartwish_giftcard' && qrData.code) {
          card = await this.cardRepo.findOne({
            where: { cardCode: qrData.code },
            relations: ['brand'],
          });
        }
      } catch {
        // Not JSON, try as raw UUID
        card = await this.cardRepo.findOne({
          where: { cardCode },
          relations: ['brand'],
        });
      }
    } else if (cardNumber) {
      card = await this.cardRepo.findOne({
        where: { cardNumber },
        relations: ['brand'],
      });
    }

    if (!card) {
      throw new NotFoundException('Gift card not found');
    }

    // Check expiry
    if (new Date() > card.expiresAt && card.status === GiftCardStatus.ACTIVE) {
      card.status = GiftCardStatus.EXPIRED;
      await this.cardRepo.save(card);
    }

    return {
      id: card.id,
      cardNumber: card.cardNumber,
      status: card.status,
      expiresAt: card.expiresAt,
      brand: card.brand ? {
        id: card.brand.id,
        name: card.brand.name,
        slug: card.brand.slug,
        logo: card.brand.logoUrl,
      } : null,
    };
  }

  async checkBalance(dto: CheckBalanceDto) {
    // Find card
    let card: GiftCard | null = null;

    if (dto.cardCode) {
      try {
        const qrData = JSON.parse(dto.cardCode);
        if (qrData.type === 'smartwish_giftcard' && qrData.code) {
          card = await this.cardRepo.findOne({
            where: { cardCode: qrData.code },
            relations: ['brand'],
          });
        }
      } catch {
        card = await this.cardRepo.findOne({
          where: { cardCode: dto.cardCode },
          relations: ['brand'],
        });
      }
    } else if (dto.cardNumber) {
      card = await this.cardRepo.findOne({
        where: { cardNumber: dto.cardNumber },
        relations: ['brand'],
      });
    }

    if (!card) {
      throw new NotFoundException('Gift card not found');
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(dto.pin, card.pinHash);
    if (!pinValid) {
      throw new BadRequestException('Invalid PIN');
    }

    // Check expiry
    if (new Date() > card.expiresAt && card.status === GiftCardStatus.ACTIVE) {
      card.status = GiftCardStatus.EXPIRED;
      await this.cardRepo.save(card);
    }

    return {
      id: card.id,
      cardNumber: card.cardNumber,
      currentBalance: card.currentBalance,
      initialBalance: card.initialBalance,
      status: card.status,
      expiresAt: card.expiresAt,
      brand: card.brand ? {
        id: card.brand.id,
        name: card.brand.name,
        slug: card.brand.slug,
        logo: card.brand.logoUrl,
        isSmartWishBrand: card.brand.isSmartWishBrand,
      } : null,
    };
  }

  async redeemGiftCard(dto: RedeemGiftCardDto, performedBy?: string) {
    const card = await this.cardRepo.findOne({
      where: { id: dto.cardId },
      relations: ['brand'],
    });

    if (!card) {
      throw new NotFoundException('Gift card not found');
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(dto.pin, card.pinHash);
    if (!pinValid) {
      throw new BadRequestException('Invalid PIN');
    }

    // Check status
    if (card.status !== GiftCardStatus.ACTIVE) {
      throw new BadRequestException(`Gift card is ${card.status}`);
    }

    // Check expiry
    if (new Date() > card.expiresAt) {
      card.status = GiftCardStatus.EXPIRED;
      await this.cardRepo.save(card);
      throw new BadRequestException('Gift card has expired');
    }

    // Check amount
    const currentBalance = Number(card.currentBalance);
    if (dto.amount > currentBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: $${currentBalance.toFixed(2)}`,
      );
    }

    // Update balance
    const newBalance = currentBalance - dto.amount;
    card.currentBalance = newBalance;

    // Set activated if first use
    if (!card.activatedAt) {
      card.activatedAt = new Date();
    }

    // Update status if depleted
    if (newBalance <= 0) {
      card.status = GiftCardStatus.DEPLETED;
    }

    await this.cardRepo.save(card);

    // Create transaction
    await this.transactionRepo.save({
      giftCardId: card.id,
      transactionType: TransactionType.REDEMPTION,
      amount: -dto.amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: dto.description || 'Redemption',
      performedBy,
    });

    return {
      success: true,
      amountRedeemed: dto.amount,
      previousBalance: currentBalance,
      newBalance,
      cardStatus: card.status,
    };
  }

  // ==================== Admin Methods ====================

  async listCards(options: {
    page?: number;
    pageSize?: number;
    brandId?: string;
    status?: string;
    search?: string;
  }) {
    const { page = 0, pageSize = 20, brandId, status, search } = options;

    const qb = this.cardRepo
      .createQueryBuilder('card')
      .leftJoinAndSelect('card.brand', 'brand')
      .orderBy('card.issuedAt', 'DESC');

    if (brandId) {
      qb.andWhere('card.brandId = :brandId', { brandId });
    }
    if (status) {
      qb.andWhere('card.status = :status', { status });
    }
    if (search) {
      qb.andWhere('card.cardNumber ILIKE :search', { search: `%${search}%` });
    }

    const [cards, total] = await qb
      .skip(page * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      cards,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCardById(id: string) {
    const card = await this.cardRepo.findOne({
      where: { id },
      relations: ['brand'],
    });
    if (!card) throw new NotFoundException('Gift card not found');
    return card;
  }

  async getCardTransactions(cardId: string) {
    const card = await this.getCardById(cardId);
    const transactions = await this.transactionRepo.find({
      where: { giftCardId: cardId },
      order: { createdAt: 'DESC' },
    });
    return { card, transactions };
  }

  async updateCardStatus(id: string, dto: UpdateGiftCardStatusDto, performedBy?: string) {
    const card = await this.getCardById(id);

    if (dto.status === 'active' && card.currentBalance <= 0) {
      throw new BadRequestException('Cannot reactivate depleted card');
    }

    const oldStatus = card.status;
    card.status = dto.status as GiftCardStatus;

    // If voiding, create void transaction
    if (dto.status === 'voided' && Number(card.currentBalance) > 0) {
      const currentBalance = Number(card.currentBalance);
      await this.transactionRepo.save({
        giftCardId: id,
        transactionType: TransactionType.VOID,
        amount: -currentBalance,
        balanceBefore: currentBalance,
        balanceAfter: 0,
        description: dto.reason || 'Card voided by admin',
        performedBy,
      });
      card.currentBalance = 0;
    }

    await this.cardRepo.save(card);

    return { success: true, oldStatus, newStatus: dto.status };
  }

  async getReports(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Overall stats
    const allCards = await this.cardRepo.find();
    const totalIssued = allCards.length;
    const totalInitialValue = allCards.reduce((sum, c) => sum + Number(c.initialBalance), 0);
    const totalOutstandingBalance = allCards.reduce((sum, c) => sum + Number(c.currentBalance), 0);
    const totalRedeemed = totalInitialValue - totalOutstandingBalance;

    // Status counts
    const statusCounts = {
      active: allCards.filter(c => c.status === GiftCardStatus.ACTIVE).length,
      depleted: allCards.filter(c => c.status === GiftCardStatus.DEPLETED).length,
      expired: allCards.filter(c => c.status === GiftCardStatus.EXPIRED).length,
      voided: allCards.filter(c => c.status === GiftCardStatus.VOIDED).length,
      suspended: allCards.filter(c => c.status === GiftCardStatus.SUSPENDED).length,
    };

    // Period transactions
    const periodTransactions = await this.transactionRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.giftCard', 'card')
      .leftJoinAndSelect('card.brand', 'brand')
      .where('tx.createdAt >= :startDate', { startDate })
      .orderBy('tx.createdAt', 'DESC')
      .limit(50)
      .getMany();

    const periodPurchases = periodTransactions.filter(t => t.transactionType === TransactionType.PURCHASE);
    const periodRedemptions = periodTransactions.filter(t => t.transactionType === TransactionType.REDEMPTION);

    // Brand stats
    const brands = await this.brandRepo.find();
    const brandStats = await Promise.all(
      brands.map(async (brand) => {
        const cards = await this.cardRepo.find({ where: { brandId: brand.id } });
        return {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          logo: brand.logoUrl,
          isActive: brand.isActive,
          isPromoted: brand.isPromoted,
          isSmartWishBrand: brand.isSmartWishBrand,
          totalCardsIssued: cards.length,
          activeCards: cards.filter(c => c.status === GiftCardStatus.ACTIVE).length,
          depletedCards: cards.filter(c => c.status === GiftCardStatus.DEPLETED).length,
          expiredCards: cards.filter(c => c.status === GiftCardStatus.EXPIRED).length,
          totalValueIssued: cards.reduce((sum, c) => sum + Number(c.initialBalance), 0),
          outstandingBalance: cards.reduce((sum, c) => sum + Number(c.currentBalance), 0),
          totalRedeemed: cards.reduce((sum, c) => sum + Number(c.initialBalance) - Number(c.currentBalance), 0),
        };
      }),
    );

    return {
      summary: {
        totalIssued,
        totalInitialValue,
        totalOutstandingBalance,
        totalRedeemed,
        statusCounts,
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        purchases: {
          count: periodPurchases.length,
          total: periodPurchases.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
        },
        redemptions: {
          count: periodRedemptions.length,
          total: periodRedemptions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
        },
      },
      brandStats,
      recentTransactions: periodTransactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: t.amount,
        timestamp: t.createdAt,
        cardNumber: t.giftCard?.cardNumber,
        brandName: t.giftCard?.brand?.name,
      })),
    };
  }
}
