import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_REGISTRATION = 'user_registration',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',

  // OAuth events
  OAUTH_LOGIN = 'oauth_login',
  OAUTH_LINK = 'oauth_link',
  OAUTH_UNLINK = 'oauth_unlink',

  // Profile events
  PROFILE_UPDATE = 'profile_update',
  PROFILE_IMAGE_UPDATE = 'profile_image_update',

  // Security events
  LOGIN_ATTEMPT = 'login_attempt',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

  // Authorization events
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  ROLE_CHANGE = 'role_change',

  // Data events
  DATA_CREATED = 'data_created',
  DATA_UPDATED = 'data_updated',
  DATA_DELETED = 'data_deleted',
  DATA_EXPORTED = 'data_exported',

  // System events
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  CONFIGURATION_CHANGE = 'configuration_change',
  MAINTENANCE_MODE = 'maintenance_mode',
}

export enum AuditEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AuditEventStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
}

@Entity('audit_logs')
@Index(['userId'])
@Index(['eventType'])
@Index(['severity'])
@Index(['createdAt'])
@Index(['ipAddress'])
@Index(['userAgent'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @Column({
    type: 'enum',
    enum: AuditEventType,
    name: 'event_type'
  })
  eventType: AuditEventType;

  @Column({
    type: 'enum',
    enum: AuditEventSeverity,
    default: AuditEventSeverity.LOW,
    name: 'severity'
  })
  severity: AuditEventSeverity;

  @Column({
    type: 'enum',
    enum: AuditEventStatus,
    default: AuditEventStatus.SUCCESS,
    name: 'status'
  })
  status: AuditEventStatus;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint?: string;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'http_method' })
  httpMethod?: string;

  @Column({ type: 'int', nullable: true, name: 'http_status_code' })
  httpStatusCode?: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'request_id' })
  requestId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'session_id' })
  sessionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true, name: 'stack_trace' })
  stackTrace?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt?: Date;
}
