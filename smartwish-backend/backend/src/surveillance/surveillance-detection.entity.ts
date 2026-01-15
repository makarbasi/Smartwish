import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KioskConfig } from '../kiosks/kiosk-config.entity';

@Entity({ name: 'surveillance_detections' })
export class SurveillanceDetection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'kiosk_id', type: 'varchar', length: 128 })
  kioskId!: string;

  @Column({ name: 'person_track_id', type: 'integer' })
  personTrackId!: number;

  @Index()
  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'NOW()' })
  detectedAt!: Date;

  @Column({ name: 'dwell_seconds', type: 'real', nullable: true })
  dwellSeconds?: number | null;

  @Index()
  @Column({ name: 'was_counted', type: 'boolean', default: false })
  wasCounted!: boolean;

  @Column({ name: 'image_path', type: 'text', nullable: true })
  imagePath?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id', referencedColumnName: 'kioskId' })
  kiosk?: KioskConfig;
}
