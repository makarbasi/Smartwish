import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Sticker } from './sticker.entity';

export interface FindStickersOptions {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class StickersService {
  constructor(
    @InjectRepository(Sticker)
    private readonly stickerRepository: Repository<Sticker>,
  ) {}

  async findAll(options: FindStickersOptions = {}): Promise<{ data: Sticker[]; total: number }> {
    const { q, category, limit, offset = 0 } = options;

    const queryBuilder = this.stickerRepository
      .createQueryBuilder('sticker')
      .where('sticker.status = :status', { status: 'active' });

    // Search by title or tags
    if (q) {
      queryBuilder.andWhere(
        '(sticker.title ILIKE :q OR :qTag = ANY(sticker.tags))',
        { q: `%${q}%`, qTag: q.toLowerCase() },
      );
    }

    // Filter by category
    if (category) {
      queryBuilder.andWhere('sticker.category = :category', { category });
    }

    // Order by popularity
    queryBuilder.orderBy('sticker.popularity', 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination only if limit is provided
    if (offset > 0) {
      queryBuilder.skip(offset);
    }
    if (limit) {
      queryBuilder.take(limit);
    }

    const data = await queryBuilder.getMany();

    return { data, total };
  }

  async findOne(id: string): Promise<Sticker> {
    const sticker = await this.stickerRepository.findOne({
      where: { id, status: 'active' },
    });

    if (!sticker) {
      throw new NotFoundException(`Sticker with ID "${id}" not found`);
    }

    return sticker;
  }

  async findBySlug(slug: string): Promise<Sticker> {
    const sticker = await this.stickerRepository.findOne({
      where: { slug, status: 'active' },
    });

    if (!sticker) {
      throw new NotFoundException(`Sticker with slug "${slug}" not found`);
    }

    return sticker;
  }

  async getCategories(): Promise<string[]> {
    const result = await this.stickerRepository
      .createQueryBuilder('sticker')
      .select('DISTINCT sticker.category', 'category')
      .where('sticker.status = :status', { status: 'active' })
      .andWhere('sticker.category IS NOT NULL')
      .orderBy('sticker.category', 'ASC')
      .getRawMany();

    return result.map((r) => r.category);
  }

  async incrementPopularity(id: string): Promise<void> {
    await this.stickerRepository.increment({ id }, 'popularity', 1);
  }

  async incrementDownloads(id: string): Promise<void> {
    await this.stickerRepository.increment({ id }, 'numDownloads', 1);
  }
}
