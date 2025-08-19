import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  ConflictException,
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateRating } from './template-rating.entity';
import { RatingVote } from './rating-vote.entity';
import { TemplatePurchase } from '../purchases/template-purchase.entity';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class TemplateReviewsService {
  constructor(
    @InjectRepository(TemplateRating)
    private ratingsRepository: Repository<TemplateRating>,
    @InjectRepository(RatingVote)
    private votesRepository: Repository<RatingVote>,
    @InjectRepository(TemplatePurchase)
    private purchasesRepository: Repository<TemplatePurchase>,
  ) {}

  async getTemplateReviews(templateId: string, page: number, limit: number, sortBy: string) {
    const queryBuilder = this.ratingsRepository
      .createQueryBuilder('rating')
      .leftJoinAndSelect('rating.user', 'user')
      .leftJoinAndSelect('rating.purchase', 'purchase')
      .where('rating.templateId = :templateId', { templateId })
      .andWhere('rating.isHidden = :isHidden', { isHidden: false });

    // Apply sorting
    switch (sortBy) {
      case 'helpful':
        queryBuilder.orderBy('rating.helpfulVotes', 'DESC');
        break;
      case 'newest':
        queryBuilder.orderBy('rating.createdAt', 'DESC');
        break;
      case 'oldest':
        queryBuilder.orderBy('rating.createdAt', 'ASC');
        break;
      case 'rating_high':
        queryBuilder.orderBy('rating.rating', 'DESC');
        break;
      case 'rating_low':
        queryBuilder.orderBy('rating.rating', 'ASC');
        break;
      default:
        queryBuilder.orderBy('rating.helpfulVotes', 'DESC');
    }

    const [reviews, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Calculate average rating
    const avgResult = await this.ratingsRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.rating)', 'average')
      .where('rating.templateId = :templateId', { templateId })
      .andWhere('rating.isHidden = :isHidden', { isHidden: false })
      .getRawOne();

    const averageRating = parseFloat(avgResult?.average) || 0;

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      averageRating: Math.round(averageRating * 10) / 10,
    };
  }

  async getReviewById(id: string) {
    const review = await this.ratingsRepository.findOne({
      where: { id },
      relations: ['user', 'purchase'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async createReview(templateId: string, createReviewDto: CreateReviewDto, userId: string) {
    // Check if user already reviewed this template
    const existingReview = await this.ratingsRepository.findOne({
      where: { templateId, userId },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this template');
    }

    // Check if user purchased this template
    const purchase = await this.purchasesRepository.findOne({
      where: { 
        templateId, 
        userId, 
        isActive: true 
      },
    });

    const review = this.ratingsRepository.create({
      templateId,
      userId,
      ...createReviewDto,
      isVerifiedPurchase: !!purchase,
      purchaseId: purchase?.id,
    });

    const savedReview = await this.ratingsRepository.save(review);

    // Update template average rating
    await this.updateTemplateAverageRating(templateId);

    return savedReview;
  }

  async updateReview(id: string, updateReviewDto: UpdateReviewDto, userId: string) {
    const review = await this.ratingsRepository.findOne({
      where: { id, userId },
    });

    if (!review) {
      throw new NotFoundException('Review not found or you do not have permission to edit it');
    }

    Object.assign(review, updateReviewDto);
    const updatedReview = await this.ratingsRepository.save(review);

    // Update template average rating
    await this.updateTemplateAverageRating(review.templateId);

    return updatedReview;
  }

  async deleteReview(id: string, userId: string) {
    const review = await this.ratingsRepository.findOne({
      where: { id, userId },
    });

    if (!review) {
      throw new NotFoundException('Review not found or you do not have permission to delete it');
    }

    const templateId = review.templateId;
    await this.ratingsRepository.remove(review);

    // Update template average rating
    await this.updateTemplateAverageRating(templateId);

    return { message: 'Review deleted successfully' };
  }

  async voteOnReview(reviewId: string, isHelpful: boolean, userId: string) {
    // Check if user already voted on this review
    const existingVote = await this.votesRepository.findOne({
      where: { ratingId: reviewId, userId },
    });

    if (existingVote) {
      // Update existing vote
      if (existingVote.isHelpful !== isHelpful) {
        existingVote.isHelpful = isHelpful;
        await this.votesRepository.save(existingVote);
        await this.updateReviewVoteCounts(reviewId);
      }
    } else {
      // Create new vote
      const vote = this.votesRepository.create({
        ratingId: reviewId,
        userId,
        isHelpful,
      });
      await this.votesRepository.save(vote);
      await this.updateReviewVoteCounts(reviewId);
    }

    return { message: 'Vote recorded successfully' };
  }

  async reportReview(reviewId: string, reason: string, userId: string) {
    const review = await this.ratingsRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Increment report count
    review.reportedCount += 1;
    await this.ratingsRepository.save(review);

    // Here you would typically create a report record and notify moderators
    // For now, we'll just log it
    console.log(`Review ${reviewId} reported by user ${userId}: ${reason}`);

    return { message: 'Review reported successfully' };
  }

  async hideReview(reviewId: string, reason: string, userId: string) {
    // Check if user has moderation permissions (you'll need to implement this check)
    // For now, we'll assume all authenticated users can hide reviews
    
    const review = await this.ratingsRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.isHidden = true;
    review.hiddenReason = reason;
    review.hiddenByUserId = userId;
    review.hiddenAt = new Date();

    await this.ratingsRepository.save(review);

    // Update template average rating (excluding hidden reviews)
    await this.updateTemplateAverageRating(review.templateId);

    return { message: 'Review hidden successfully' };
  }

  async getUserReviews(userId: string, page: number, limit: number) {
    const [reviews, total] = await this.ratingsRepository.findAndCount({
      where: { userId },
      relations: ['template'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async updateReviewVoteCounts(reviewId: string) {
    const helpfulCount = await this.votesRepository.count({
      where: { ratingId: reviewId, isHelpful: true },
    });

    const notHelpfulCount = await this.votesRepository.count({
      where: { ratingId: reviewId, isHelpful: false },
    });

    await this.ratingsRepository.update(reviewId, {
      helpfulVotes: helpfulCount,
      notHelpfulVotes: notHelpfulCount,
    });
  }

  private async updateTemplateAverageRating(templateId: string) {
    const result = await this.ratingsRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.rating)', 'average')
      .addSelect('COUNT(rating.id)', 'count')
      .where('rating.templateId = :templateId', { templateId })
      .andWhere('rating.isHidden = :isHidden', { isHidden: false })
      .getRawOne();

    const averageRating = parseFloat(result?.average) || 0;
    const reviewCount = parseInt(result?.count) || 0;

    // Here you would update the template entity with the new average rating
    // This depends on your template entity structure
    console.log(`Template ${templateId} - Average: ${averageRating}, Count: ${reviewCount}`);
  }
}
