import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KioskConfig } from './kiosk-config.entity';
import { User } from '../user/user.entity';

export enum PrintStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('kiosk_print_logs')
export class KioskPrintLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'kiosk_id' })
  kioskId: string;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id' })
  kiosk: KioskConfig;

  // What was printed
  @Column({ name: 'product_type', default: 'greeting-card' })
  productType: string;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'product_name', nullable: true })
  productName: string;

  // Pricing / Revenue
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  // Print details
  @Column({ name: 'paper_type', nullable: true })
  paperType: string;

  @Column({ name: 'paper_size', nullable: true })
  paperSize: string;

  @Column({ name: 'tray_number', nullable: true })
  trayNumber: number;

  @Column({ default: 1 })
  copies: number;

  // Status
  @Column({
    type: 'varchar',
    default: PrintStatus.PENDING,
  })
  status: PrintStatus;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  // Who initiated
  @Column({ name: 'initiated_by', nullable: true })
  initiatedBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiator: User;
}
