import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateBundle } from './template-bundle.entity';
import { TemplateBundleItem } from './template-bundle-item.entity';
import { TemplatePurchase, PurchaseType } from '../purchases/template-purchase.entity';
import { CreateBundleDto, UpdateBundleDto, PurchaseBundleDto } from './dto/bundle.dto';

@Injectable()
export class TemplateBundlesService {
  constructor(
    @InjectRepository(TemplateBundle)
    private bundlesRepository: Repository<TemplateBundle>,
    @InjectRepository(TemplateBundleItem)
    private bundleItemsRepository: Repository<TemplateBundleItem>,
    @InjectRepository(TemplatePurchase)
    private purchasesRepository: Repository<TemplatePurchase>,
  ) {}

  async getBundles(page: number, limit: number, filters: any, userId?: string) {
    const queryBuilder = this.bundlesRepository
      .createQueryBuilder('bundle')
      .leftJoinAndSelect('bundle.category', 'category')
      .leftJoinAndSelect('bundle.culture', 'culture')
      .leftJoinAndSelect('bundle.region', 'region')
      .leftJoinAndSelect('bundle.createdByUser', 'createdByUser')
      .leftJoinAndSelect('bundle.items', 'items')
      .leftJoinAndSelect('items.template', 'template')
      .where('bundle.isActive = :isActive', { isActive: true });

    if (filters.categoryId) {
      queryBuilder.andWhere('bundle.categoryId = :categoryId', { categoryId: filters.categoryId });
    }

    if (filters.cultureId) {
      queryBuilder.andWhere('bundle.cultureId = :cultureId', { cultureId: filters.cultureId });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(bundle.name ILIKE :search OR bundle.description ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'newest':
        queryBuilder.orderBy('bundle.createdAt', 'DESC');
        break;
      case 'price_low':
        queryBuilder.orderBy('bundle.bundlePrice', 'ASC');
        break;
      case 'price_high':
        queryBuilder.orderBy('bundle.bundlePrice', 'DESC');
        break;
      case 'savings':
        queryBuilder.orderBy('(bundle.individualPrice - bundle.bundlePrice)', 'DESC');
        break;
      default:
        queryBuilder.orderBy('bundle.downloadCount', 'DESC');
    }

    const [bundles, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      bundles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeaturedBundles(userId?: string) {
    return this.bundlesRepository.find({
      where: { isFeatured: true, isActive: true },
      relations: ['category', 'culture', 'createdByUser', 'items', 'items.template'],
      order: { downloadCount: 'DESC' },
      take: 6,
    });
  }

  async getBundleById(id: string, userId?: string) {
    const bundle = await this.bundlesRepository.findOne({
      where: { id },
      relations: [
        'category',
        'culture',
        'region',
        'createdByUser',
        'items',
        'items.template',
        'items.template.category'
      ],
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }

    // Check if user has purchased this bundle
    let isPurchased = false;
    if (userId) {
      const purchase = await this.purchasesRepository.findOne({
        where: { bundleId: id, userId, isActive: true },
      });
      isPurchased = !!purchase;
    }

    return { ...bundle, isPurchased };
  }

  async createBundle(createBundleDto: CreateBundleDto, userId: string) {
    const bundle = this.bundlesRepository.create({
      ...createBundleDto,
      createdByUserId: userId,
    });

    return this.bundlesRepository.save(bundle);
  }

  async updateBundle(id: string, updateBundleDto: UpdateBundleDto, userId: string) {
    const bundle = await this.bundlesRepository.findOne({
      where: { id, createdByUserId: userId },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found or you do not have permission to edit it');
    }

    Object.assign(bundle, updateBundleDto);
    return this.bundlesRepository.save(bundle);
  }

  async deleteBundle(id: string, userId: string) {
    const bundle = await this.bundlesRepository.findOne({
      where: { id, createdByUserId: userId },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found or you do not have permission to delete it');
    }

    await this.bundlesRepository.remove(bundle);
    return { message: 'Bundle deleted successfully' };
  }

  async purchaseBundle(bundleId: string, purchaseDto: PurchaseBundleDto, userId: string) {
    const bundle = await this.bundlesRepository.findOne({
      where: { id: bundleId },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }

    // Check if already purchased
    const existingPurchase = await this.purchasesRepository.findOne({
      where: { bundleId, userId, isActive: true },
    });

    if (existingPurchase) {
      throw new ForbiddenException('You have already purchased this bundle');
    }

    // Create purchase record
    const purchase = this.purchasesRepository.create({
      userId,
      bundleId,
      purchaseType: PurchaseType.BUNDLE,
      purchasePrice: bundle.bundlePrice,
      originalPrice: bundle.individualPrice,
      discountApplied: bundle.individualPrice - bundle.bundlePrice,
      currency: 'USD',
      paymentMethod: purchaseDto.paymentMethod,
      isActive: true,
    });

    await this.purchasesRepository.save(purchase);

    // Update download count
    await this.bundlesRepository.increment({ id: bundleId }, 'downloadCount', 1);

    return { message: 'Bundle purchased successfully', purchaseId: purchase.id };
  }

  async incrementViewCount(id: string) {
    await this.bundlesRepository.increment({ id }, 'viewCount', 1);
    return { message: 'View count updated' };
  }

  async getUserBundles(userId: string, page: number, limit: number) {
    const [bundles, total] = await this.bundlesRepository.findAndCount({
      where: { createdByUserId: userId },
      relations: ['category', 'items'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      bundles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserPurchasedBundles(userId: string, page: number, limit: number) {
    const [purchases, total] = await this.purchasesRepository.findAndCount({
      where: { userId, purchaseType: PurchaseType.BUNDLE, isActive: true },
      relations: ['bundle', 'bundle.category', 'bundle.items'],
      order: { purchaseDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      purchases,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
