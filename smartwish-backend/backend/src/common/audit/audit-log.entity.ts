import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
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

@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'table_name' })
  tableName?: string;

  @Column({ type: 'uuid', nullable: true, name: 'record_id' })
  recordId?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'old_values' })
  oldValues?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'new_values' })
  newValues?: Record<string, any>;

  @Column({ type: 'uuid', nullable: true, name: 'request_id' })
  requestId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'session_id' })
  sessionId?: string;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
