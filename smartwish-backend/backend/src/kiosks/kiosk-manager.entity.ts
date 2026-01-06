import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { KioskConfig } from './kiosk-config.entity';

@Entity({ name: 'kiosk_managers' })
@Index(['kioskId', 'userId'], { unique: true })
export class KioskManager {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'kiosk_id', type: 'uuid' })
  kioskId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy?: string | null;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt!: Date;

  // Relations
  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id' })
  kiosk!: KioskConfig;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by' })
  assigner?: User;
}
