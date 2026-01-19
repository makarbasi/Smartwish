import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { EarningsLedger, TransactionType } from './earnings-ledger.entity';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { KioskManager } from '../kiosks/kiosk-manager.entity';
import { SalesRepresentative } from '../sales-representatives/sales-representative.entity';

// Constants for fee calculations
const ECARD_PRICE = 1.0;
const ECARD_PROCESSING_FEE = 0.19;
const STRIPE_FEE_PERCENT = 0.029;
const STRIPE_FEE_FIXED = 0.30;

interface PrintProductSaleData {
  kioskId: string;
  orderId?: string;
  printLogId?: string;
  type: 'greeting_card' | 'sticker';
  grossAmount: number;
  processingFees: number;
  stateTax: number;
  productCost?: number;
  productName?: string;
  customerName?: string;
  quantity?: number;
  paymentMethod?: string;
}

interface PromoCodePrintData {
  kioskId: string;
  printLogId: string;
  productType: string;
  productName?: string;
  promoCode?: string;
}

interface EcardSaleData {
  kioskId: string;
  ecardId?: string;
  customerName?: string;
}

interface GenericGiftCardData {
  kioskId: string;
  giftCardId?: string;
  faceValue: number;
  giftCardBrand?: string;
  customerName?: string;
}

interface CustomGiftCardPurchaseData {
  kioskId: string;
  giftCardId?: string;
  faceValue: number;
  smartwishDiscountPercent: number;
  managerDiscountPercent: number;
  storeName?: string;
  customerName?: string;
}

interface CustomGiftCardRedemptionData {
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
}

interface SettlementInput {
  giftCardValue: number;
  totalRedemptionValue: number;
  kioskDiscountPercent: number;
  storeDiscountPercent: number;
  serviceFeePercent: number;
}

interface SettlementOutput {
  storePayout: number;
  managerEarnings: number;
  smartwishEarnings: number;
  stripeFeeReimbursed: number;
}

@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(EarningsLedger)
    private readonly earningsRepo: Repository<EarningsLedger>,
    @InjectRepository(KioskConfig)
    private readonly kioskRepo: Repository<KioskConfig>,
    @InjectRepository(KioskManager)
    private readonly kioskManagerRepo: Repository<KioskManager>,
    @InjectRepository(SalesRepresentative)
    private readonly salesRepRepo: Repository<SalesRepresentative>,
  ) {}

  /**
   * Get kiosk with commission info
   */
  private async getKioskWithCommissions(kioskId: string): Promise<{
    kiosk: KioskConfig;
    managerId: string | null;
    managerCommissionRate: number;
    salesRepId: string | null;
    salesRepCommissionRate: number;
  }> {
    const kiosk = await this.kioskRepo.findOne({ where: { id: kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    // Get manager assignment
    const managerAssignment = await this.kioskManagerRepo.findOne({
      where: { kioskId: kiosk.id },
    });

    // Get sales rep info
    let salesRepCommissionRate = 0;
    if (kiosk.salesRepresentativeId) {
      const salesRep = await this.salesRepRepo.findOne({
        where: { id: kiosk.salesRepresentativeId },
      });
      if (salesRep) {
        salesRepCommissionRate = parseFloat(salesRep.commissionPercent?.toString() || '0');
      }
    }

    const managerCommissionRate = parseFloat(kiosk.managerCommissionPercent?.toString() || '20');

    return {
      kiosk,
      managerId: managerAssignment?.userId || null,
      managerCommissionRate,
      salesRepId: kiosk.salesRepresentativeId || null,
      salesRepCommissionRate,
    };
  }

  /**
   * Record earnings for greeting card or sticker sale
   * Commission: YES (both manager and sales rep)
   */
  async recordPrintProductSale(data: PrintProductSaleData): Promise<EarningsLedger> {
    const { kiosk, managerId, managerCommissionRate, salesRepId, salesRepCommissionRate } =
      await this.getKioskWithCommissions(data.kioskId);

    // Calculate net distributable
    const netDistributable =
      data.grossAmount -
      data.processingFees -
      data.stateTax -
      (data.productCost || 0);

    // Calculate commissions on NET amount
    const managerRate = managerCommissionRate / 100;
    const salesRepRate = salesRepCommissionRate / 100;

    const managerEarnings = netDistributable * managerRate;
    const salesRepEarnings = salesRepId ? netDistributable * salesRepRate : 0;
    const smartwishEarnings = netDistributable - managerEarnings - salesRepEarnings;

    const earning = this.earningsRepo.create({
      kioskId: kiosk.id,
      transactionType: data.type,
      transactionId: data.orderId,
      printLogId: data.printLogId,
      paymentMethod: data.paymentMethod || 'card',
      grossAmount: data.grossAmount,
      processingFees: data.processingFees,
      stateTax: data.stateTax,
      costBasis: data.productCost || 0,
      netDistributable,
      smartwishEarnings: Math.round(smartwishEarnings * 100) / 100,
      managerEarnings: Math.round(managerEarnings * 100) / 100,
      managerId,
      managerCommissionRate,
      salesRepEarnings: Math.round(salesRepEarnings * 100) / 100,
      salesRepId,
      salesRepCommissionRate,
      productName: data.productName,
      quantity: data.quantity || 1,
      customerName: data.customerName,
    });

    return this.earningsRepo.save(earning);
  }

  /**
   * Record earnings for promo code print
   * Commission: NO (promo code = free, no revenue to distribute)
   * Still creates a ledger entry for audit/tracking purposes
   */
  async recordPromoCodePrint(data: PromoCodePrintData): Promise<EarningsLedger> {
    const { kiosk, managerId, salesRepId } = await this.getKioskWithCommissions(data.kioskId);

    const transactionType = data.productType === 'sticker' 
      ? TransactionType.STICKER 
      : TransactionType.GREETING_CARD;

    const earning = this.earningsRepo.create({
      kioskId: kiosk.id,
      transactionType,
      transactionId: data.printLogId,
      printLogId: data.printLogId,
      paymentMethod: 'promo_code',
      promoCodeUsed: data.promoCode,
      
      // All amounts = 0 for promo code (no revenue)
      grossAmount: 0,
      processingFees: 0,
      stateTax: 0,
      costBasis: 0,
      netDistributable: 0,
      
      // NO commission for promo code prints
      smartwishEarnings: 0,
      managerEarnings: 0,
      managerId, // Still track who would have earned
      managerCommissionRate: 0,
      salesRepEarnings: 0,
      salesRepId, // Still track who would have earned
      salesRepCommissionRate: 0,
      
      productName: data.productName || 'Promo Print',
      quantity: 1,
      notes: `Promo code: ${data.promoCode || 'unknown'}`,
    });

    return this.earningsRepo.save(earning);
  }

  /**
   * Record earnings for E-card sale
   * Commission: NO (flat $1 + $0.19 processing, all to Smartwish)
   */
  async recordEcardSale(data: EcardSaleData): Promise<EarningsLedger> {
    const { kiosk } = await this.getKioskWithCommissions(data.kioskId);

    const earning = this.earningsRepo.create({
      kioskId: kiosk.id,
      transactionType: TransactionType.ECARD,
      transactionId: data.ecardId,
      grossAmount: ECARD_PRICE + ECARD_PROCESSING_FEE,
      processingFees: ECARD_PROCESSING_FEE,
      stateTax: 0,
      netDistributable: ECARD_PRICE,
      smartwishEarnings: ECARD_PRICE,
      managerEarnings: 0,
      salesRepEarnings: 0,
      productName: 'E-Card',
      customerName: data.customerName,
    });

    return this.earningsRepo.save(earning);
  }

  /**
   * Record earnings for generic (Tillo) gift card sale
   * Commission: NO (pass-through, only Stripe fees)
   */
  async recordGenericGiftCardSale(data: GenericGiftCardData): Promise<EarningsLedger> {
    const { kiosk } = await this.getKioskWithCommissions(data.kioskId);

    const stripeFee = data.faceValue * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED;

    const earning = this.earningsRepo.create({
      kioskId: kiosk.id,
      transactionType: TransactionType.GENERIC_GIFT_CARD,
      transactionId: data.giftCardId,
      grossAmount: data.faceValue + stripeFee,
      processingFees: stripeFee,
      stateTax: 0,
      netDistributable: 0, // Pass-through, no profit
      smartwishEarnings: 0,
      managerEarnings: 0,
      salesRepEarnings: 0,
      productName: data.giftCardBrand || 'Gift Card',
      customerName: data.customerName,
    });

    return this.earningsRepo.save(earning);
  }

  /**
   * Record custom gift card purchase
   * Commission: NO (earnings calculated at redemption)
   */
  async recordCustomGiftCardPurchase(data: CustomGiftCardPurchaseData): Promise<EarningsLedger> {
    const { kiosk } = await this.getKioskWithCommissions(data.kioskId);

    const totalDiscount = data.smartwishDiscountPercent + data.managerDiscountPercent;
    const discountAmount = data.faceValue * (totalDiscount / 100);
    const customerPays = data.faceValue - discountAmount;
    const stripeFee = customerPays * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED;

    const earning = this.earningsRepo.create({
      kioskId: kiosk.id,
      transactionType: TransactionType.CUSTOM_GIFT_CARD_PURCHASE,
      transactionId: data.giftCardId,
      grossAmount: customerPays + stripeFee,
      processingFees: stripeFee,
      stateTax: 0,
      netDistributable: 0, // Earnings at redemption
      smartwishEarnings: 0,
      managerEarnings: 0,
      salesRepEarnings: 0, // NO sales rep commission on custom gift cards
      productName: data.storeName ? `${data.storeName} Gift Card` : 'Custom Gift Card',
      customerName: data.customerName,
    });

    return this.earningsRepo.save(earning);
  }

  /**
   * Record custom gift card redemption
   * Commission: Manager ONLY (from their discount portion)
   */
  async recordCustomGiftCardRedemption(data: CustomGiftCardRedemptionData): Promise<EarningsLedger> {
    const { kiosk, managerId } = await this.getKioskWithCommissions(data.kioskId);

    // Use the settlement calculation logic
    const settlement = this.calculateSettlement({
      giftCardValue: data.faceValue,
      totalRedemptionValue: data.amountRedeemed,
      kioskDiscountPercent: data.smartwishDiscountPercent,
      storeDiscountPercent: data.managerDiscountPercent,
      serviceFeePercent: data.serviceFeePercent,
    });

    const earning = this.earningsRepo.create({
      kioskId: kiosk.id,
      transactionType: TransactionType.CUSTOM_GIFT_CARD_REDEMPTION,
      transactionId: data.redemptionId,
      relatedLedgerId: data.purchaseLedgerId,
      grossAmount: data.amountRedeemed,
      processingFees: settlement.stripeFeeReimbursed,
      netDistributable: settlement.smartwishEarnings + settlement.managerEarnings,
      smartwishEarnings: settlement.smartwishEarnings,
      managerEarnings: settlement.managerEarnings,
      managerId,
      managerCommissionRate: data.managerDiscountPercent,
      salesRepEarnings: 0, // NO sales rep commission
      storePayout: settlement.storePayout,
      storeId: data.storeId,
      productName: data.storeName ? `${data.storeName} Gift Card Redemption` : 'Gift Card Redemption',
      customerName: data.customerName,
    });

    return this.earningsRepo.save(earning);
  }

  /**
   * Settlement calculation for custom gift card redemption
   * Based on the Python calculate.py logic
   */
  private calculateSettlement(data: SettlementInput): SettlementOutput {
    const A = data.giftCardValue;
    const m_total = data.totalRedemptionValue;

    const x_pct = data.kioskDiscountPercent / 100;
    const y_pct = data.storeDiscountPercent / 100;
    const f_pct = data.serviceFeePercent / 100;

    // Stripe fee (calculated on face value, prorated by usage)
    const stripeFeeTotal = STRIPE_FEE_PERCENT * A + STRIPE_FEE_FIXED;
    const usageRatio = m_total / A;
    const stripeFeeShare = stripeFeeTotal * usageRatio;

    // Calculate on total swiped amount
    const serviceFeeAmt = f_pct * m_total;
    const storeDiscountAmt = y_pct * m_total;
    const kioskDiscountAmt = x_pct * m_total;

    // Store payout
    const storePayout = m_total - serviceFeeAmt - stripeFeeShare - storeDiscountAmt;

    // Manager earnings = store discount amount (what manager "funded")
    const managerEarnings = storeDiscountAmt;

    // Kiosk (Smartwish) net profit
    const kioskNetProfit = serviceFeeAmt - kioskDiscountAmt;

    return {
      storePayout: Math.round(storePayout * 100) / 100,
      managerEarnings: Math.round(managerEarnings * 100) / 100,
      smartwishEarnings: Math.round(kioskNetProfit * 100) / 100,
      stripeFeeReimbursed: Math.round(stripeFeeShare * 100) / 100,
    };
  }

  /**
   * Get earnings for a manager
   */
  async getManagerEarnings(
    managerId: string,
    filters?: {
      kioskId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    transactions: any[];
    totalEarnings: number;
    earningsByKiosk: any[];
    total: number;
  }> {
    let query = this.earningsRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.kiosk', 'kiosk')
      .where('e.manager_id = :managerId', { managerId })
      .orderBy('e.transaction_date', 'DESC');

    if (filters?.kioskId) {
      query = query.andWhere('kiosk.kiosk_id = :kioskId', { kioskId: filters.kioskId });
    }
    if (filters?.startDate) {
      query = query.andWhere('e.transaction_date >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query = query.andWhere('e.transaction_date <= :endDate', { endDate: filters.endDate });
    }

    const total = await query.getCount();

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const earnings = await query.getMany();

    // Calculate totals
    const totalEarnings = earnings.reduce(
      (sum, e) => sum + parseFloat(e.managerEarnings?.toString() || '0'),
      0,
    );

    // Group by kiosk
    const kioskMap = new Map<string, { kioskId: string; kioskName: string; total: number; count: number }>();
    for (const e of earnings) {
      const kioskKey = e.kioskId;
      const existing = kioskMap.get(kioskKey);
      if (existing) {
        existing.total += parseFloat(e.managerEarnings?.toString() || '0');
        existing.count += 1;
      } else {
        kioskMap.set(kioskKey, {
          kioskId: e.kiosk?.kioskId || kioskKey,
          kioskName: e.kiosk?.name || 'Unknown',
          total: parseFloat(e.managerEarnings?.toString() || '0'),
          count: 1,
        });
      }
    }

    return {
      transactions: earnings.map((e) => ({
        id: e.id,
        date: e.transactionDate,
        kioskName: e.kiosk?.name || 'Unknown',
        kioskId: e.kiosk?.kioskId,
        productType: e.transactionType,
        productName: e.productName,
        yourEarnings: parseFloat(e.managerEarnings?.toString() || '0'),
      })),
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      earningsByKiosk: Array.from(kioskMap.values()),
      total,
    };
  }

  /**
   * Get all earnings for admin
   */
  async getAllEarnings(filters?: {
    kioskId?: string;
    transactionType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    earnings: EarningsLedger[];
    total: number;
    summary: {
      totalGross: number;
      totalSmartwise: number;
      totalManager: number;
      totalSalesRep: number;
    };
  }> {
    let query = this.earningsRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.kiosk', 'kiosk')
      .leftJoinAndSelect('e.manager', 'manager')
      .leftJoinAndSelect('e.salesRep', 'salesRep')
      .orderBy('e.transaction_date', 'DESC');

    if (filters?.kioskId) {
      query = query.andWhere('kiosk.kiosk_id = :kioskId', { kioskId: filters.kioskId });
    }
    if (filters?.transactionType) {
      query = query.andWhere('e.transaction_type = :type', { type: filters.transactionType });
    }
    if (filters?.startDate) {
      query = query.andWhere('e.transaction_date >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query = query.andWhere('e.transaction_date <= :endDate', { endDate: filters.endDate });
    }

    const total = await query.getCount();

    // Get summary
    const summaryQuery = await this.earningsRepo
      .createQueryBuilder('e')
      .select('SUM(e.gross_amount)', 'totalGross')
      .addSelect('SUM(e.smartwish_earnings)', 'totalSmartwise')
      .addSelect('SUM(e.manager_earnings)', 'totalManager')
      .addSelect('SUM(e.sales_rep_earnings)', 'totalSalesRep')
      .getRawOne();

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const earnings = await query.getMany();

    return {
      earnings,
      total,
      summary: {
        totalGross: parseFloat(summaryQuery.totalGross || '0'),
        totalSmartwise: parseFloat(summaryQuery.totalSmartwise || '0'),
        totalManager: parseFloat(summaryQuery.totalManager || '0'),
        totalSalesRep: parseFloat(summaryQuery.totalSalesRep || '0'),
      },
    };
  }

  /**
   * Get earnings summary by kiosk
   */
  async getEarningsByKiosk(
    kioskId: string,
    days: number = 30,
  ): Promise<{
    byDay: any[];
    byType: any[];
    totals: any;
  }> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException('Kiosk not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // By day
    const byDay = await this.earningsRepo
      .createQueryBuilder('e')
      .select("DATE_TRUNC('day', e.transaction_date)", 'day')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(e.gross_amount)', 'gross')
      .addSelect('SUM(e.net_distributable)', 'net')
      .addSelect('SUM(e.smartwish_earnings)', 'smartwish')
      .addSelect('SUM(e.manager_earnings)', 'manager')
      .addSelect('SUM(e.sales_rep_earnings)', 'salesRep')
      .where('e.kiosk_id = :kioskId', { kioskId: kiosk.id })
      .andWhere('e.transaction_date >= :startDate', { startDate })
      .groupBy("DATE_TRUNC('day', e.transaction_date)")
      .orderBy("DATE_TRUNC('day', e.transaction_date)", 'ASC')
      .getRawMany();

    // By type
    const byType = await this.earningsRepo
      .createQueryBuilder('e')
      .select('e.transaction_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(e.gross_amount)', 'gross')
      .addSelect('SUM(e.net_distributable)', 'net')
      .where('e.kiosk_id = :kioskId', { kioskId: kiosk.id })
      .andWhere('e.transaction_date >= :startDate', { startDate })
      .groupBy('e.transaction_type')
      .getRawMany();

    // Totals
    const totals = await this.earningsRepo
      .createQueryBuilder('e')
      .select('COUNT(*)', 'transactionCount')
      .addSelect('SUM(e.gross_amount)', 'totalGross')
      .addSelect('SUM(e.net_distributable)', 'totalNet')
      .addSelect('SUM(e.smartwish_earnings)', 'totalSmartwise')
      .addSelect('SUM(e.manager_earnings)', 'totalManager')
      .addSelect('SUM(e.sales_rep_earnings)', 'totalSalesRep')
      .where('e.kiosk_id = :kioskId', { kioskId: kiosk.id })
      .andWhere('e.transaction_date >= :startDate', { startDate })
      .getRawOne();

    return { byDay, byType, totals };
  }
}
