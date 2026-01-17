import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { KioskConfig } from './kiosk-config.entity';

export enum PrintableType {
  STICKER = 'sticker',
  GREETING_CARD = 'greeting-card',
}

export enum PrinterStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
  UNKNOWN = 'unknown',
}

export enum PaperStatus {
  OK = 'ok',
  LOW = 'low',
  EMPTY = 'empty',
  UNKNOWN = 'unknown',
}

export enum PrintMode {
  SIMPLEX = 'simplex',           // Single-sided printing
  DUPLEX = 'duplex',             // Double-sided, long edge binding
  DUPLEX_SHORT = 'duplexshort',  // Double-sided, short edge binding
}

@Entity({ name: 'kiosk_printers' })
export class KioskPrinter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'kiosk_id', type: 'uuid' })
  kioskId!: string;

  @ManyToOne(() => KioskConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kiosk_id' })
  kiosk!: KioskConfig;

  // Printer identification
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'printer_name', type: 'varchar', length: 255 })
  printerName!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  // What this printer handles
  @Index()
  @Column({ name: 'printable_type', type: 'varchar', length: 32 })
  printableType!: PrintableType;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  // Print mode: simplex (single-sided), duplex (long edge), duplexshort (short edge)
  @Column({ name: 'print_mode', type: 'varchar', length: 32, default: PrintMode.SIMPLEX })
  printMode!: PrintMode;

  // Health tracking (updated by local print agent)
  @Index()
  @Column({ type: 'varchar', length: 32, default: PrinterStatus.UNKNOWN })
  status!: PrinterStatus;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  // Ink levels (from SNMP monitoring, 0-100 or null if unknown)
  @Column({ name: 'ink_black', type: 'int', nullable: true })
  inkBlack?: number | null;

  @Column({ name: 'ink_cyan', type: 'int', nullable: true })
  inkCyan?: number | null;

  @Column({ name: 'ink_magenta', type: 'int', nullable: true })
  inkMagenta?: number | null;

  @Column({ name: 'ink_yellow', type: 'int', nullable: true })
  inkYellow?: number | null;

  // Paper status
  @Column({ name: 'paper_status', type: 'varchar', length: 32, default: PaperStatus.UNKNOWN })
  paperStatus!: PaperStatus;

  @Column({ name: 'paper_tray1_state', type: 'varchar', length: 32, nullable: true })
  paperTray1State?: string | null;

  @Column({ name: 'paper_tray2_state', type: 'varchar', length: 32, nullable: true })
  paperTray2State?: string | null;

  // Full status JSON (for detailed info from SNMP)
  @Column({ name: 'full_status', type: 'jsonb', default: () => "'{}'" })
  fullStatus!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
