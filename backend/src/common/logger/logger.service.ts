import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  [key: string]: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger() {
    const logDir = path.join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(
        ({ timestamp, level, message, context, stack, ...meta }) => {
          let log = timestamp + ' [' + level.toUpperCase() + ']: ' + message;

          if (context && Object.keys(context).length > 0) {
            log += ' | Context: ' + JSON.stringify(context);
          }

          if (meta && Object.keys(meta).length > 0) {
            log += ' | Meta: ' + JSON.stringify(meta);
          }

          if (stack) {
            log += '\nStack: ' + String(stack);
          }

          return log;
        },
      ),
    );

    // Create logger instance
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'smartwish-backend' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),

        // Daily rotate file transport for all logs
        new DailyRotateFile({
          filename: path.join(logDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info',
        }),

        // Daily rotate file transport for error logs
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
        }),

        // Daily rotate file transport for security logs
        new DailyRotateFile({
          filename: path.join(logDir, 'security-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '90d',
          level: 'warn',
        }),
      ],
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new DailyRotateFile({
        filename: path.join(logDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
      }),
    );

    // Handle unhandled rejections
    this.logger.rejections.handle(
      new DailyRotateFile({
        filename: path.join(logDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
      }),
    );
  }

  log(message: string, context?: LogContext) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: LogContext) {
    this.logger.verbose(message, { context });
  }

  // Security-specific logging methods
  securityEvent(event: string, details: any, context?: LogContext) {
    this.logger.warn('SECURITY: ' + event, {
      context: { ...context, securityEvent: true, details },
    });
  }

  authenticationEvent(
    event: string,
    userId?: string,
    ip?: string,
    context?: LogContext,
  ) {
    this.logger.info('AUTH: ' + event, {
      context: { ...context, authEvent: true, userId, ip },
    });
  }

  authorizationEvent(
    event: string,
    userId?: string,
    resource?: string,
    context?: LogContext,
  ) {
    this.logger.info('AUTHZ: ' + event, {
      context: { ...context, authzEvent: true, userId, resource },
    });
  }

  // Request/response logging
  requestLog(
    method: string,
    endpoint: string,
    ip: string,
    userAgent: string,
    userId?: string,
  ) {
    this.logger.info('HTTP Request', {
      context: {
        type: 'request',
        method,
        endpoint,
        ip,
        userAgent,
        userId,
      },
    });
  }

  responseLog(
    method: string,
    endpoint: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
  ) {
    this.logger.info('HTTP Response', {
      context: {
        type: 'response',
        method,
        endpoint,
        statusCode,
        responseTime,
        userId,
      },
    });
  }
}
