import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevenueRecord, PayoutStatus } from './revenue-record.entity';
import { TemplatePurchase } from '../purchases/template-purchase.entity';

@Injectable()
export class AuthorEarningsService {
  constructor(
    @InjectRepository(RevenueRecord)
    private revenueRepository: Repository<RevenueRecord>,
    @InjectRepository(TemplatePurchase)
    private purchasesRepository: Repository<TemplatePurchase>,
  ) {}

  async getAuthorEarnings(authorId: string, timeRange: string) {
    const dateFilter = this.getDateFilter(timeRange);
    
    // Get earnings over time
    const earningsOverTime = await this.revenueRepository
      .createQueryBuilder('revenue')
      .select([
        "DATE_TRUNC('month', revenue.transactionDate) as month",
        'SUM(revenue.authorEarnings) as earnings',
        'COUNT(revenue.id) as sales',
        'SUM(revenue.grossAmount) as grossRevenue',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .andWhere('revenue.transactionDate >= :startDate', { startDate: dateFilter })
      .groupBy("DATE_TRUNC('month', revenue.transactionDate)")
      .orderBy('month', 'ASC')
      .getRawMany();

    // Get revenue breakdown by source
    const revenueBreakdown = await this.revenueRepository
      .createQueryBuilder('revenue')
      .leftJoin('revenue.template', 'template')
      .leftJoin('revenue.bundle', 'bundle')
      .select([
        'CASE WHEN revenue.templateId IS NOT NULL THEN \'Individual Templates\' ELSE \'Bundles\' END as name',
        'SUM(revenue.authorEarnings) as value',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .andWhere('revenue.transactionDate >= :startDate', { startDate: dateFilter })
      .groupBy('CASE WHEN revenue.templateId IS NOT NULL THEN \'Individual Templates\' ELSE \'Bundles\' END')
      .getRawMany();

    // Get top performing templates
    const topTemplates = await this.revenueRepository
      .createQueryBuilder('revenue')
      .leftJoin('revenue.template', 'template')
      .leftJoin('template.category', 'category')
      .select([
        'template.id as id',
        'template.title as name',
        'template.coverImage as coverImage',
        'category.displayName as category',
        'SUM(revenue.authorEarnings) as revenue',
        'COUNT(revenue.id) as sales',
        'AVG(template.averageRating) as rating',
        '0 as trend', // You would calculate this based on historical data
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .andWhere('revenue.templateId IS NOT NULL')
      .andWhere('revenue.transactionDate >= :startDate', { startDate: dateFilter })
      .groupBy('template.id, template.title, template.coverImage, category.displayName, template.averageRating')
      .orderBy('SUM(revenue.authorEarnings)', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      earningsOverTime: earningsOverTime.map(item => ({
        month: item.month,
        earnings: parseFloat(item.earnings) || 0,
        sales: parseInt(item.sales) || 0,
        downloads: parseInt(item.sales) || 0, // Assuming sales = downloads for now
      })),
      revenueBreakdown: revenueBreakdown.map(item => ({
        name: item.name,
        value: parseFloat(item.value) || 0,
      })),
      topTemplates: topTemplates.map(item => ({
        id: item.id,
        name: item.name,
        coverImage: item.coverImage,
        category: item.category,
        revenue: parseFloat(item.revenue) || 0,
        sales: parseInt(item.sales) || 0,
        rating: parseFloat(item.rating) || 0,
        trend: parseInt(item.trend) || 0,
      })),
    };
  }

  async getEarningsSummary(authorId: string) {
    const summary = await this.revenueRepository
      .createQueryBuilder('revenue')
      .select([
        'SUM(revenue.authorEarnings) as totalEarnings',
        'COUNT(revenue.id) as totalSales',
        'SUM(CASE WHEN revenue.payoutStatus = :pending THEN revenue.authorEarnings ELSE 0 END) as pendingEarnings',
        'SUM(CASE WHEN revenue.payoutStatus = :paid THEN revenue.authorEarnings ELSE 0 END) as paidEarnings',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .setParameter('pending', PayoutStatus.PENDING)
      .setParameter('paid', PayoutStatus.PAID)
      .getRawOne();

    // Get total downloads (assuming each purchase = 1 download)
    const downloadsResult = await this.purchasesRepository
      .createQueryBuilder('purchase')
      .leftJoin('purchase.template', 'template')
      .leftJoin('template.author', 'author')
      .select('COUNT(purchase.id) as totalDownloads')
      .where('author.userId = :authorId', { authorId })
      .getRawOne();

    return {
      totalEarnings: parseFloat(summary?.totalEarnings) || 0,
      totalSales: parseInt(summary?.totalSales) || 0,
      totalDownloads: parseInt(downloadsResult?.totalDownloads) || 0,
      pendingEarnings: parseFloat(summary?.pendingEarnings) || 0,
      paidEarnings: parseFloat(summary?.paidEarnings) || 0,
    };
  }

  async getAuthorPayouts(authorId: string, page: number, limit: number) {
    // Group revenue records by payout period (monthly)
    const payouts = await this.revenueRepository
      .createQueryBuilder('revenue')
      .select([
        "DATE_TRUNC('month', revenue.transactionDate) as payoutPeriod",
        'SUM(revenue.authorEarnings) as amount',
        'revenue.payoutStatus as status',
        'MIN(revenue.payoutDate) as payoutDate',
        'MIN(revenue.payoutReference) as payoutReference',
        'COUNT(revenue.id) as transactionCount',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .groupBy("DATE_TRUNC('month', revenue.transactionDate), revenue.payoutStatus")
      .orderBy('payoutPeriod', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany();

    const total = await this.revenueRepository
      .createQueryBuilder('revenue')
      .select("COUNT(DISTINCT DATE_TRUNC('month', revenue.transactionDate))", 'count')
      .where('revenue.authorUserId = :authorId', { authorId })
      .getRawOne();

    return {
      payouts: payouts.map(payout => ({
        period: payout.payoutPeriod,
        amount: parseFloat(payout.amount) || 0,
        status: payout.status,
        payoutDate: payout.payoutDate,
        payoutReference: payout.payoutReference,
        transactionCount: parseInt(payout.transactionCount) || 0,
      })),
      total: parseInt(total?.count) || 0,
      page,
      totalPages: Math.ceil((parseInt(total?.count) || 0) / limit),
    };
  }

  async getTopPerformingTemplates(authorId: string, limit: number, timeRange: string) {
    const dateFilter = this.getDateFilter(timeRange);

    const templates = await this.revenueRepository
      .createQueryBuilder('revenue')
      .leftJoin('revenue.template', 'template')
      .leftJoin('template.category', 'category')
      .select([
        'template.id as id',
        'template.title as name',
        'template.coverImage as coverImage',
        'category.displayName as category',
        'SUM(revenue.authorEarnings) as revenue',
        'COUNT(revenue.id) as sales',
        'template.averageRating as rating',
        'template.downloadCount as downloads',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .andWhere('revenue.templateId IS NOT NULL')
      .andWhere('revenue.transactionDate >= :startDate', { startDate: dateFilter })
      .groupBy('template.id, template.title, template.coverImage, category.displayName, template.averageRating, template.downloadCount')
      .orderBy('SUM(revenue.authorEarnings)', 'DESC')
      .limit(limit)
      .getRawMany();

    return templates.map(template => ({
      id: template.id,
      name: template.name,
      coverImage: template.coverImage,
      category: template.category,
      revenue: parseFloat(template.revenue) || 0,
      sales: parseInt(template.sales) || 0,
      rating: parseFloat(template.rating) || 0,
      downloads: parseInt(template.downloads) || 0,
    }));
  }

  async getDetailedAnalytics(authorId: string, timeRange: string, granularity: string) {
    const dateFilter = this.getDateFilter(timeRange);
    const truncateFormat = granularity === 'daily' ? 'day' : 'month';

    // Revenue analytics
    const revenueAnalytics = await this.revenueRepository
      .createQueryBuilder('revenue')
      .select([
        `DATE_TRUNC('${truncateFormat}', revenue.transactionDate) as period`,
        'SUM(revenue.authorEarnings) as earnings',
        'SUM(revenue.grossAmount) as grossRevenue',
        'SUM(revenue.platformFeeAmount) as platformFees',
        'COUNT(revenue.id) as transactions',
        'COUNT(DISTINCT revenue.buyerUserId) as uniqueBuyers',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .andWhere('revenue.transactionDate >= :startDate', { startDate: dateFilter })
      .groupBy(`DATE_TRUNC('${truncateFormat}', revenue.transactionDate)`)
      .orderBy('period', 'ASC')
      .getRawMany();

    // Category performance
    const categoryPerformance = await this.revenueRepository
      .createQueryBuilder('revenue')
      .leftJoin('revenue.template', 'template')
      .leftJoin('template.category', 'category')
      .select([
        'category.displayName as category',
        'SUM(revenue.authorEarnings) as earnings',
        'COUNT(revenue.id) as sales',
      ])
      .where('revenue.authorUserId = :authorId', { authorId })
      .andWhere('revenue.transactionDate >= :startDate', { startDate: dateFilter })
      .andWhere('revenue.templateId IS NOT NULL')
      .groupBy('category.displayName')
      .orderBy('SUM(revenue.authorEarnings)', 'DESC')
      .getRawMany();

    return {
      revenueAnalytics: revenueAnalytics.map(item => ({
        period: item.period,
        earnings: parseFloat(item.earnings) || 0,
        grossRevenue: parseFloat(item.grossRevenue) || 0,
        platformFees: parseFloat(item.platformFees) || 0,
        transactions: parseInt(item.transactions) || 0,
        uniqueBuyers: parseInt(item.uniqueBuyers) || 0,
      })),
      categoryPerformance: categoryPerformance.map(item => ({
        category: item.category,
        earnings: parseFloat(item.earnings) || 0,
        sales: parseInt(item.sales) || 0,
      })),
    };
  }

  private getDateFilter(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1month':
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      case '3months':
        return new Date(now.getFullYear(), now.getMonth() - 3, 1);
      case '6months':
        return new Date(now.getFullYear(), now.getMonth() - 6, 1);
      case '1year':
        return new Date(now.getFullYear() - 1, now.getMonth(), 1);
      case '2years':
        return new Date(now.getFullYear() - 2, now.getMonth(), 1);
      default:
        return new Date(now.getFullYear(), now.getMonth() - 6, 1);
    }
  }
}
