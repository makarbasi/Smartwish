# SmartWish Authentication System

## Overview
This document describes the comprehensive authentication and user management system implemented in the SmartWish backend. The system provides industry-standard security features including JWT authentication, OAuth integration, audit logging, and comprehensive user management.

## Architecture

### Core Components
- **User Management**: Complete user CRUD operations with profile management
- **Authentication**: JWT-based authentication with refresh tokens
- **OAuth Integration**: Google, Instagram, and WhatsApp OAuth support
- **Audit Logging**: Comprehensive audit trail for all user actions
- **Security**: Rate limiting, password policies, and account lockout protection
- **Database**: PostgreSQL with TypeORM for data persistence

## Features

### User Management
- User registration and login
- Profile management (name, email, phone, social media, interests)
- Profile image upload and management
- Email and phone verification
- Password change and reset functionality
- Account deletion with audit trail

### Authentication
- JWT token-based authentication
- Refresh token support
- OAuth integration (Google, Instagram, WhatsApp)
- Session management
- Account lockout after failed login attempts
- Rate limiting for login attempts

### Security Features
- Bcrypt password hashing (12 rounds)
- Account lockout protection
- Login attempt tracking
- IP address and user agent logging
- Comprehensive audit logging
- CORS configuration
- Helmet security headers

### OAuth Providers
- **Google OAuth**: Full profile integration
- **Instagram OAuth**: User authentication and profile linking
- **WhatsApp OAuth**: Business account integration

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  role VARCHAR(50) DEFAULT 'user',
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  profile_image VARCHAR(500),
  phone_number VARCHAR(20),
  social_media JSONB,
  interests TEXT[],
  hobbies TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - User logout

### OAuth
- `GET /auth/google` - Google OAuth initiation
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/instagram` - Instagram OAuth initiation
- `GET /auth/instagram/callback` - Instagram OAuth callback
- `GET /auth/whatsapp` - WhatsApp OAuth initiation
- `GET /auth/whatsapp/callback` - WhatsApp OAuth callback

### User Management
- `GET /users` - Get all users (admin only)
- `GET /users/:id` - Get user by ID
- `PUT /users/:id/profile` - Update user profile
- `PUT /users/:id/password` - Change password
- `DELETE /users/:id` - Delete user account
- `POST /users/:id/verify-email` - Verify email address

## Environment Configuration

### Required Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=smartwish

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

## Installation and Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
```bash
cp env.example .env.local
# Edit .env.local with your configuration
```

### 3. Database Setup
```bash
# Create database
createdb smartwish

# Run migrations
npm run migration:run
```

### 4. Start Development Server
```bash
npm run start:dev
```

## Security Considerations

### Password Security
- Passwords are hashed using bcrypt with 12 rounds
- Minimum password length enforced
- Password complexity requirements
- Account lockout after 5 failed attempts

### Token Security
- JWT tokens have configurable expiration
- Refresh tokens for extended sessions
- Secure token storage in HTTP-only cookies
- Token rotation on refresh

### Rate Limiting
- Login attempts: 5 per 15 minutes
- General API: 100 requests per 15 minutes
- Configurable rate limiting windows

### Audit Logging
- All user actions are logged
- IP address and user agent tracking
- Configurable retention periods
- Automated cleanup of old logs

## Monitoring and Health Checks

### Health Check Endpoint
- `GET /health` - System health status
- Database connectivity check
- External service status
- Memory and performance metrics

### Logging
- Structured logging with Winston
- Daily log rotation
- Configurable log levels
- Error tracking and alerting

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for code quality
- Prettier for code formatting
- Comprehensive error handling

### Testing
- Unit tests with Jest
- Integration tests for API endpoints
- E2E testing support
- Test coverage reporting

### Error Handling
- Custom exception filters
- Structured error responses
- Comprehensive error logging
- User-friendly error messages

## Troubleshooting

### Common Issues
1. **Database Connection**: Check database credentials and network access
2. **OAuth Errors**: Verify OAuth app configuration and callback URLs
3. **JWT Issues**: Ensure JWT_SECRET is properly set
4. **Rate Limiting**: Check rate limit configuration and user behavior

### Debug Mode
Enable debug mode for development:
```bash
DEBUG=true npm run start:dev
```

## Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secrets
4. Configure SSL certificates
5. Set up monitoring and logging

### Security Checklist
- [ ] Change default passwords
- [ ] Configure firewall rules
- [ ] Enable SSL/TLS
- [ ] Set up rate limiting
- [ ] Configure audit logging
- [ ] Set up backup procedures

## Support and Maintenance

### Regular Maintenance
- Database backup and optimization
- Log rotation and cleanup
- Security updates and patches
- Performance monitoring

### Monitoring
- Application performance metrics
- Database query performance
- Error rate tracking
- User activity monitoring

## Future Enhancements

### Planned Features
- Two-factor authentication (2FA)
- Advanced role-based access control
- API key management
- Enhanced OAuth providers
- Mobile app authentication
- Social login improvements

### Technical Improvements
- Redis caching layer
- GraphQL API support
- WebSocket real-time features
- Microservices architecture
- Container deployment support

---

This system provides a robust foundation for user authentication and management in the SmartWish application. For questions or support, please refer to the development team or create an issue in the project repository.
