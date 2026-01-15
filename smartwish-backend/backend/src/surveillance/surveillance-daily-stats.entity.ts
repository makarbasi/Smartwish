import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { KioskConfig } from '../kiosks/kiosk-config.entity';

@Entity({ name: 'surveillance_daily_stats' })
@Unique(['kioskId', 'date'])
export class SurveillanceDailyStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'kiosk_id', type: 'varchar', length: 128 })
  kioskId!: string;

  @Index()
  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'total_detected', type: 'integer', default: 0 })
  totalDetected!: number;

  @Column({ name: 'total_counted', type: 'integer', default: 0 })
  totalCounted!: number;

  @Column({ name: 'peak_hour', type: 'integer', nullable: true })
  peakHour?: number | null;

  @Column({ name: 'hourly_counts', type: 'jsonb', default: () => "'{}'" })
  hourlyCounts!: Record<string, number>;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id', referencedColumnName: 'kioskId' })
  kiosk?: KioskConfig;
}
