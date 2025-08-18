import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateRating } from './template-rating.entity';
import { RatingVote } from './rating-vote.entity';
import { TemplatePurchase } from '../purchases/template-purchase.entity';
import { TemplateReviewsController } from './template-reviews.controller';
import { TemplateReviewsService } from './template-reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateRating, RatingVote, TemplatePurchase])],
  controllers: [TemplateReviewsController],
  providers: [TemplateReviewsService],
  exports: [TemplateReviewsService],
})
export class TemplateReviewsModule {}
