import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { TemplateRating } from './template-rating.entity';
import { User } from '../user/user.entity';

@Entity('sw_rating_votes')
@Unique(['ratingId', 'userId'])
@Index(['ratingId'])
@Index(['userId'])
export class RatingVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rating_id', type: 'uuid' })
  ratingId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'is_helpful', type: 'boolean' })
  isHelpful: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => TemplateRating, rating => rating.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rating_id' })
  rating: TemplateRating;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
