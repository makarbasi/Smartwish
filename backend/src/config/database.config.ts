import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { AuditLog } from '../common/audit/audit-log.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432') || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'smartwish',

  // Entities
  entities: [User, AuditLog],

  // Auto-sync schema in development (disable in production)
  // Note: Use migrations instead of auto-sync to avoid conflicts
  synchronize: false, // Disabled to prevent schema conflicts

  // Logging
  logging: process.env.NODE_ENV === 'development',
  logger: 'advanced-console',

  // Connection pooling for Supabase
  extra: {
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5') || 5, // Lower for Supabase
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000') || 30000, // 30s
    timeout: parseInt(process.env.DB_TIMEOUT || '30000') || 30000, // 30s
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    max: 5, // Max connections in pool
  },

  // SSL configuration for Supabase (always required)
  ssl: {
    rejectUnauthorized: false,
  },

  // Migration settings
  migrations: ['dist/migrations/*.js'],
  migrationsRun: process.env.NODE_ENV === 'production',

  // Cache settings - disabled for development
  // cache: {
  //   type: 'redis',
  //   options: {
  //     host: process.env.REDIS_HOST || 'localhost',
  //     port: parseInt(process.env.REDIS_PORT || '6379') || 6379,
  //     password: process.env.REDIS_PASSWORD,
  //     db: parseInt(process.env.REDIS_DB || '0') || 0,
  //   },
  //   duration: 30000, // 30 seconds
  // },

  // Performance optimization
  maxQueryExecutionTime: 1000, // Log queries taking longer than 1 second

  // Connection retry
  retryAttempts: 3,
  retryDelay: 3000,

  // Auto-reconnect
  autoLoadEntities: true,
};
