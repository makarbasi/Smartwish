import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('saved_design_likes')
@Unique(['designId', 'userId'])
@Index(['designId'])
@Index(['userId'])
@Index(['createdAt'])
export class SavedDesignLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'design_id', type: 'uuid' })
  designId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}






