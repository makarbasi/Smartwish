import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import {
  AuditLog,
  AuditEventType,
  AuditEventSeverity,
  AuditEventStatus,
} from './audit-log.entity';
import { LoggerService } from '../logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogData {
  userId?: string;
  eventType: AuditEventType;
  severity?: AuditEventSeverity;
  status?: AuditEventStatus;
  description: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  httpMethod?: string;
  httpStatusCode?: number;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
  stackTrace?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private logger: LoggerService,
  ) {}

  async log(data: AuditLogData): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        ...data,
        severity: data.severity || AuditEventSeverity.LOW,
        status: data.status || AuditEventStatus.SUCCESS,
        requestId: data.requestId || uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years retention
      });

      const savedLog = await this.auditLogRepository.save(auditLog);

      // Also log to Winston logger for immediate visibility
      this.logger.log('AUDIT: ' + data.description, {
        userId: data.userId,
        eventType: data.eventType,
        severity: data.severity,
        ipAddress: data.ipAddress,
        endpoint: data.endpoint,
        requestId: data.requestId,
      });

      return savedLog;
    } catch (error) {
      this.logger.error('Failed to save audit log', error.stack, {
        eventType: data.eventType,
        description: data.description,
        error: error.message,
      });
      throw error;
    }
  }

  // Authentication event logging
  async logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.USER_LOGIN,
      severity: success ? AuditEventSeverity.LOW : AuditEventSeverity.HIGH,
      status: success ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
      description: success ? 'User login successful' : 'User login failed',
      details,
      ipAddress,
      userAgent,
      endpoint: '/auth/login',
      httpMethod: 'POST',
    });
  }

  async logLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.USER_LOGOUT,
      severity: AuditEventSeverity.LOW,
      status: AuditEventStatus.SUCCESS,
      description: 'User logout',
      ipAddress,
      userAgent,
      endpoint: '/auth/logout',
      httpMethod: 'POST',
    });
  }

  async logRegistration(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.USER_REGISTRATION,
      severity: AuditEventSeverity.MEDIUM,
      status: AuditEventStatus.SUCCESS,
      description: 'User registration',
      details,
      ipAddress,
      userAgent,
      endpoint: '/auth/signup',
      httpMethod: 'POST',
    });
  }

  async logPasswordChange(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.PASSWORD_CHANGE,
      severity: AuditEventSeverity.MEDIUM,
      status: AuditEventStatus.SUCCESS,
      description: 'Password changed',
      ipAddress,
      userAgent,
      endpoint: '/auth/change-password',
      httpMethod: 'POST',
    });
  }

  async logPasswordReset(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.PASSWORD_RESET,
      severity: success ? AuditEventSeverity.MEDIUM : AuditEventSeverity.HIGH,
      status: success ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
      description: success
        ? 'Password reset successful'
        : 'Password reset failed',
      ipAddress,
      userAgent,
      endpoint: '/auth/reset-password',
      httpMethod: 'POST',
    });
  }

  // OAuth event logging
  async logOAuthLogin(
    userId: string,
    provider: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.OAUTH_LOGIN,
      severity: success ? AuditEventSeverity.LOW : AuditEventSeverity.HIGH,
      status: success ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
      description: provider + ' OAuth login ' + (success ? 'successful' : 'failed'),
      details,
      ipAddress,
      userAgent,
      endpoint: '/auth/' + provider,
      httpMethod: 'GET',
    });
  }

  // Security event logging
  async logLoginAttempt(
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGIN_ATTEMPT,
      severity: success ? AuditEventSeverity.LOW : AuditEventSeverity.MEDIUM,
      status: success ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
      description: 'Login attempt for ' + email + ' ' + (success ? 'successful' : 'failed'),
      details,
      ipAddress,
      userAgent,
      endpoint: '/auth/login',
      httpMethod: 'POST',
    });
  }

  async logAccountLocked(
    userId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.ACCOUNT_LOCKED,
      severity: AuditEventSeverity.HIGH,
      status: AuditEventStatus.SUCCESS,
      description: 'Account locked: ' + reason,
      details: { reason },
      ipAddress,
      userAgent,
    });
  }

  async logSuspiciousActivity(
    userId: string,
    activity: string,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditEventSeverity.HIGH,
      status: AuditEventStatus.SUCCESS,
      description: 'Suspicious activity detected: ' + activity,
      details,
      ipAddress,
      userAgent,
    });
  }

  // Authorization event logging
  async logRoleChange(
    userId: string,
    oldRole: string,
    newRole: string,
    changedBy: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.ROLE_CHANGE,
      severity: AuditEventSeverity.HIGH,
      status: AuditEventStatus.SUCCESS,
      description: 'User role changed from ' + oldRole + ' to ' + newRole,
      details: { oldRole, newRole, changedBy },
      ipAddress,
    });
  }

  // Data event logging
  async logDataOperation(
    userId: string,
    operation: 'create' | 'update' | 'delete' | 'export',
    resource: string,
    success: boolean,
    details?: Record<string, any>,
  ): Promise<void> {
    const eventType =
      operation === 'create'
        ? AuditEventType.DATA_CREATED
        : operation === 'update'
          ? AuditEventType.DATA_UPDATED
          : operation === 'delete'
            ? AuditEventType.DATA_DELETED
            : AuditEventType.DATA_EXPORTED;

    await this.log({
      userId,
      eventType,
      severity: success ? AuditEventSeverity.LOW : AuditEventSeverity.MEDIUM,
      status: success ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
      description: operation + ' operation on ' + resource + ' ' + (success ? 'successful' : 'failed'),
      details,
      metadata: { resource, operation },
    });
  }

  // System event logging
  async logSystemEvent(
    event: string,
    severity: AuditEventSeverity = AuditEventSeverity.MEDIUM,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.SYSTEM_STARTUP, // This will be overridden
      severity,
      status: AuditEventStatus.SUCCESS,
      description: event,
      details,
    });
  }

  // Query methods for audit analysis
  async getAuditLogsByUser(
    userId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAuditLogsByType(
    eventType: AuditEventType,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { eventType },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAuditLogsBySeverity(
    severity: AuditEventSeverity,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { severity },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAuditLogsByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Cleanup old audit logs
  async cleanupOldLogs(retentionDays: number = 2555): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoffDate),
    });
    return result.affected || 0;
  }
}
