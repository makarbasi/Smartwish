import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Template } from './template.entity';
import { Category } from './category.entity';

interface FindTemplatesOptions {
  categoryId?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(options: FindTemplatesOptions = {}): Promise<Template[]> {
    const {
      categoryId,
      searchTerm,
      sortBy = 'created_at',
      sortOrder = 'desc',
      limit,
      offset,
    } = options;

    const queryBuilder = this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.category', 'category')
      .where('template.status = :status', { status: 'published' });

    // Apply category filter
    if (categoryId) {
      queryBuilder.andWhere('template.category_id = :categoryId', { categoryId });
    }

    // Apply search filter
    if (searchTerm) {
      queryBuilder.andWhere(
        '(template.title ILIKE :searchTerm OR template.description ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` }
      );
    }

    // Apply sorting
    const validSortFields = ['title', 'created_at', 'updated_at', 'popularity', 'num_downloads', 'price'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    // Map camelCase to snake_case if needed
    const fieldMap: Record<string, string> = {
      created_at: 'created_at',
      updated_at: 'updated_at',
      popularity: 'popularity',
      num_downloads: 'num_downloads',
      price: 'price',
      title: 'title',
    };
    const dbField = fieldMap[sortField] || 'created_at';
    queryBuilder.orderBy(
      `template.${dbField}`,
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
    );

    // Apply pagination
    if (limit) {
      queryBuilder.limit(limit);
    }
    if (offset) {
      queryBuilder.offset(offset);
    }

    return queryBuilder.getMany();
  }

  async findByCategory(categoryId: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: {
        categoryId,
        status: 'published',
      },
      relations: ['category'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findById(id: string): Promise<Template | null> {
    return this.templateRepository.findOne({
      where: { id },
      relations: ['category', 'createdBy'],
    });
  }

  async searchTemplates(searchTerm: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: [
        { title: ILike(`%${searchTerm}%`), status: 'published' },
        { description: ILike(`%${searchTerm}%`), status: 'published' },
      ],
      relations: ['category'],
      order: {
        popularity: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async getTemplateStats(): Promise<any> {
    // Get total templates count
    const totalTemplates = await this.templateRepository.count({
      where: { status: 'published' },
    });

    // Get total categories count
    const totalCategories = await this.categoryRepository.count({
      where: { isActive: true },
    });

    // Get templates count by category
    const templatesByCategory: Array<{
      categoryName: string;
      categoryId: string;
      templateCount: string;
    }> = await this.templateRepository
      .createQueryBuilder('template')
      .select('category.name', 'categoryName')
      .addSelect('category.id', 'categoryId')
      .addSelect('COUNT(template.id)', 'templateCount')
      .leftJoin('template.category', 'category')
      .where('template.status = :status', { status: 'published' })
      .groupBy('category.id, category.name')
      .getRawMany();

    return {
      totalTemplates,
      totalCategories,
      templatesByCategory: templatesByCategory.reduce<
        Record<string, { name: string; count: number }>
      >((acc, item) => {
        acc[item.categoryId] = {
          name: item.categoryName,
          count: parseInt(item.templateCount, 10),
        };
        return acc;
      }, {}),
    };
  }
}