import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TemplateLike } from './template-like.entity';
import { Template } from './template.entity';

@Injectable()
export class TemplateLikesService {
  constructor(
    @InjectRepository(TemplateLike)
    private readonly likesRepository: Repository<TemplateLike>,
    @InjectRepository(Template)
    private readonly templatesRepository: Repository<Template>,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Like a template
   */
  async likeTemplate(templateId: string, userId: string): Promise<{ success: boolean; likes: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if template exists
      const template = await queryRunner.manager.findOne(Template, {
        where: { id: templateId },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Check if already liked
      const existingLike = await queryRunner.manager.findOne(TemplateLike, {
        where: { templateId, userId },
      });

      if (existingLike) {
        throw new ConflictException('Template already liked');
      }

      // Create like record
      const like = queryRunner.manager.create(TemplateLike, {
        templateId,
        userId,
      });
      await queryRunner.manager.save(like);

      // Increment popularity
      await queryRunner.manager.increment(
        Template,
        { id: templateId },
        'popularity',
        1,
      );

      // Get updated likes count
      const likesCount = await queryRunner.manager.count(TemplateLike, {
        where: { templateId },
      });

      await queryRunner.commitTransaction();

      return { success: true, likes: likesCount };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Unlike a template
   */
  async unlikeTemplate(templateId: string, userId: string): Promise<{ success: boolean; likes: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if template exists
      const template = await queryRunner.manager.findOne(Template, {
        where: { id: templateId },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Check if like exists
      const existingLike = await queryRunner.manager.findOne(TemplateLike, {
        where: { templateId, userId },
      });

      if (!existingLike) {
        throw new NotFoundException('Like not found');
      }

      // Remove like record
      await queryRunner.manager.remove(existingLike);

      // Decrement popularity (but don't go below 0)
      if (template.popularity > 0) {
        await queryRunner.manager.decrement(
          Template,
          { id: templateId },
          'popularity',
          1,
        );
      }

      // Get updated likes count
      const likesCount = await queryRunner.manager.count(TemplateLike, {
        where: { templateId },
      });

      await queryRunner.commitTransaction();

      return { success: true, likes: likesCount };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if user has liked a template
   */
  async hasUserLiked(templateId: string, userId: string): Promise<boolean> {
    const like = await this.likesRepository.findOne({
      where: { templateId, userId },
    });
    return !!like;
  }

  /**
   * Get likes count for a template
   */
  async getLikesCount(templateId: string): Promise<number> {
    return await this.likesRepository.count({
      where: { templateId },
    });
  }

  /**
   * Get user's liked templates
   */
  async getUserLikedTemplates(userId: string): Promise<string[]> {
    const likes = await this.likesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return likes.map(like => like.templateId);
  }

  /**
   * Get likes status for multiple templates for a user
   */
  async getMultipleLikesStatus(
    templateIds: string[],
    userId: string,
  ): Promise<Record<string, boolean>> {
    if (templateIds.length === 0) {
      return {};
    }

    const likes = await this.likesRepository.find({
      where: {
        userId,
      },
    });

    const likedTemplateIds = new Set(likes.map(like => like.templateId));
    const result: Record<string, boolean> = {};

    templateIds.forEach(id => {
      result[id] = likedTemplateIds.has(id);
    });

    return result;
  }
}



