import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import {
  AuditLog,
  AuditAction,
} from './audit-log.entity';
import { LoggerService } from '../logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogData {
  userId?: string;
  action: string;
  tableName?: string;
  recordId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
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
        requestId: data.requestId || uuidv4(),
      });

      const savedLog = await this.auditLogRepository.save(auditLog);

      // Also log to Winston logger for immediate visibility
      this.logger.log('AUDIT: ' + data.action, {
        userId: data.userId,
        action: data.action,
        tableName: data.tableName,
        ipAddress: data.ipAddress,
        requestId: data.requestId,
      });

      return savedLog;
    } catch (error) {
      this.logger.error('Failed to save audit log', error.stack, {
        action: data.action,
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
      action: success ? 'user_login_success' : 'user_login_failed',
      tableName: 'users',
      recordId: userId,
      newValues: details,
      ipAddress,
      userAgent,
    });
  }

  async logLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: 'user_logout',
      tableName: 'users',
      recordId: userId,
      ipAddress,
      userAgent,
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
      action: 'user_registration',
      tableName: 'users',
      recordId: userId,
      newValues: details,
      ipAddress,
      userAgent,
    });
  }

  async logLoginAttempt(
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      action: success ? 'login_attempt_success' : 'login_attempt_failed',
      tableName: 'users',
      newValues: { email, ...details },
      ipAddress,
      userAgent,
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
      action: 'account_locked',
      tableName: 'users',
      recordId: userId,
      newValues: { reason },
      ipAddress,
      userAgent,
    });
  }

  async logPasswordChange(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: 'password_change',
      tableName: 'users',
      recordId: userId,
      ipAddress,
      userAgent,
    });
  }

  async logDataOperation(
    userId: string,
    operation: 'create' | 'update' | 'delete' | 'export',
    resource: string,
    recordId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      action: `${resource}_${operation}`,
      tableName: resource,
      recordId,
      oldValues,
      newValues,
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

  async getAuditLogsByAction(
    action: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
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
