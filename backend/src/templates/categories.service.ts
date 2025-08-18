import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Category | null> {
    return this.categoryRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async getCategoryNames(): Promise<Array<{ id: string; name: string; displayName: string }>> {
    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      select: ['id', 'name', 'displayName'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      displayName: category.displayName,
    }));
  }

  async updateTemplateCount(categoryId: string): Promise<void> {
    const templateCount = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.templates', 'template')
      .where('category.id = :categoryId', { categoryId })
      .andWhere('template.status = :status', { status: 'published' })
      .getCount();

    await this.categoryRepository.update(categoryId, { templateCount });
  }
}
