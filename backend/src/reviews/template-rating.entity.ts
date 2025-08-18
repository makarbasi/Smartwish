import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
  Check,
} from 'typeorm';
import { Template } from '../templates/template.entity';
import { User } from '../user/user.entity';
import { TemplatePurchase } from '../purchases/template-purchase.entity';
import { RatingVote } from './rating-vote.entity';

@Entity('sw_template_ratings')
@Unique(['templateId', 'userId'])
@Index(['templateId'])
@Index(['userId'])
@Index(['rating'])
@Index(['isVerifiedPurchase'])
@Index(['isHidden'])
@Check('rating >= 1 AND rating <= 5')
export class TemplateRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'integer' })
  rating: number; // 1-5 stars

  @Column({ name: 'review_title', type: 'varchar', length: 255, nullable: true })
  reviewTitle?: string;

  @Column({ name: 'review_text', type: 'text', nullable: true })
  reviewText?: string;

  @Column({ name: 'is_verified_purchase', type: 'boolean', default: false })
  isVerifiedPurchase: boolean;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId?: string;

  @Column({ name: 'helpful_votes', type: 'integer', default: 0 })
  helpfulVotes: number;

  @Column({ name: 'not_helpful_votes', type: 'integer', default: 0 })
  notHelpfulVotes: number;

  @Column({ name: 'reported_count', type: 'integer', default: 0 })
  reportedCount: number;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean;

  @Column({ name: 'hidden_reason', type: 'text', nullable: true })
  hiddenReason?: string;

  @Column({ name: 'hidden_by_user_id', type: 'uuid', nullable: true })
  hiddenByUserId?: string;

  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Template, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: Template;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => TemplatePurchase, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: TemplatePurchase;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hidden_by_user_id' })
  hiddenByUser?: User;

  @OneToMany(() => RatingVote, vote => vote.rating, { cascade: true })
  votes: RatingVote[];
}
