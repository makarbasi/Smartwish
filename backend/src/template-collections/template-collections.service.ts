import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateCollection } from './template-collection.entity';
import { TemplateCollectionItem } from './template-collection-item.entity';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

@Injectable()
export class TemplateCollectionsService {
  constructor(
    @InjectRepository(TemplateCollection)
    private collectionsRepository: Repository<TemplateCollection>,
    @InjectRepository(TemplateCollectionItem)
    private collectionItemsRepository: Repository<TemplateCollectionItem>,
  ) {}

  async getUserCollections(userId: string) {
    return this.collectionsRepository.find({
      where: { userId },
      relations: ['coverTemplate', 'items', 'items.template'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getPublicCollections(page: number, limit: number, search?: string) {
    const queryBuilder = this.collectionsRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.user', 'user')
      .leftJoinAndSelect('collection.coverTemplate', 'coverTemplate')
      .where('collection.isPublic = :isPublic', { isPublic: true });

    if (search) {
      queryBuilder.andWhere(
        '(collection.name ILIKE :search OR collection.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [collections, total] = await queryBuilder
      .orderBy('collection.viewCount', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      collections,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCollectionById(id: string, requestingUserId?: string) {
    const collection = await this.collectionsRepository.findOne({
      where: { id },
      relations: [
        'user',
        'coverTemplate',
        'items',
        'items.template',
        'items.template.category',
      ],
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    // Check if user can access this collection
    if (!collection.isPublic && collection.userId !== requestingUserId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    return collection;
  }

  async createCollection(createCollectionDto: CreateCollectionDto, userId: string) {
    const collection = this.collectionsRepository.create({
      ...createCollectionDto,
      userId,
    });

    return this.collectionsRepository.save(collection);
  }

  async updateCollection(id: string, updateCollectionDto: UpdateCollectionDto, userId: string) {
    const collection = await this.collectionsRepository.findOne({
      where: { id, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or you do not have permission to edit it');
    }

    Object.assign(collection, updateCollectionDto);
    return this.collectionsRepository.save(collection);
  }

  async deleteCollection(id: string, userId: string) {
    const collection = await this.collectionsRepository.findOne({
      where: { id, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or you do not have permission to delete it');
    }

    await this.collectionsRepository.remove(collection);
    return { message: 'Collection deleted successfully' };
  }

  async addTemplateToCollection(collectionId: string, templateId: string, userId: string) {
    // Check if collection belongs to user
    const collection = await this.collectionsRepository.findOne({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or you do not have permission to modify it');
    }

    // Check if template is already in collection
    const existingItem = await this.collectionItemsRepository.findOne({
      where: { collectionId, templateId },
    });

    if (existingItem) {
      throw new ConflictException('Template is already in this collection');
    }

    // Get next sort order
    const maxOrder = await this.collectionItemsRepository
      .createQueryBuilder('item')
      .select('MAX(item.sortOrder)', 'maxOrder')
      .where('item.collectionId = :collectionId', { collectionId })
      .getRawOne();

    const sortOrder = (maxOrder?.maxOrder || 0) + 1;

    // Add template to collection
    const collectionItem = this.collectionItemsRepository.create({
      collectionId,
      templateId,
      sortOrder,
    });

    await this.collectionItemsRepository.save(collectionItem);

    // Update template count
    await this.updateTemplateCount(collectionId);

    return { message: 'Template added to collection successfully' };
  }

  async removeTemplateFromCollection(collectionId: string, templateId: string, userId: string) {
    // Check if collection belongs to user
    const collection = await this.collectionsRepository.findOne({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or you do not have permission to modify it');
    }

    const collectionItem = await this.collectionItemsRepository.findOne({
      where: { collectionId, templateId },
    });

    if (!collectionItem) {
      throw new NotFoundException('Template not found in this collection');
    }

    await this.collectionItemsRepository.remove(collectionItem);

    // Update template count
    await this.updateTemplateCount(collectionId);

    return { message: 'Template removed from collection successfully' };
  }

  async incrementViewCount(id: string) {
    await this.collectionsRepository.increment({ id }, 'viewCount', 1);
    return { message: 'View count updated' };
  }

  private async updateTemplateCount(collectionId: string) {
    const count = await this.collectionItemsRepository.count({
      where: { collectionId },
    });

    await this.collectionsRepository.update(collectionId, {
      templateCount: count,
    });
  }
}
