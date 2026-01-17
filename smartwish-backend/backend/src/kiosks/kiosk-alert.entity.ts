import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KioskConfig } from './kiosk-config.entity';
import { KioskPrinter } from './kiosk-printer.entity';
import { User } from '../user/user.entity';

export enum AlertType {
  PRINTER_OFFLINE = 'printer_offline',
  PRINTER_ERROR = 'printer_error',
  INK_LOW = 'ink_low',
  INK_EMPTY = 'ink_empty',
  PAPER_LOW = 'paper_low',
  PAPER_EMPTY = 'paper_empty',
  KIOSK_OFFLINE = 'kiosk_offline',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

@Entity({ name: 'kiosk_alerts' })
export class KioskAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'kiosk_id', type: 'uuid' })
  kioskId!: string;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id' })
  kiosk!: KioskConfig;

  @Column({ name: 'printer_id', type: 'uuid', nullable: true })
  printerId?: string | null;

  @ManyToOne(() => KioskPrinter, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'printer_id' })
  printer?: KioskPrinter | null;

  // Alert details
  @Column({ name: 'alert_type', type: 'varchar', length: 64 })
  alertType!: AlertType;

  @Column({ type: 'text' })
  message!: string;

  @Index()
  @Column({ type: 'varchar', length: 32, default: AlertSeverity.WARNING })
  severity!: AlertSeverity;

  // Alert metadata
  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, any>;

  // Resolution tracking
  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledger?: User | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by' })
  resolver?: User | null;

  @Column({ name: 'auto_resolved', type: 'boolean', default: false })
  autoResolved!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
