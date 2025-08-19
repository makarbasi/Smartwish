-- Simplified migration for users and audit_logs tables
-- Run this in your Supabase SQL Editor

-- Create enum types
CREATE TYPE IF NOT EXISTS oauth_provider AS ENUM ('local', 'google', 'instagram', 'whatsapp');
CREATE TYPE IF NOT EXISTS user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('user', 'admin', 'moderator');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password VARCHAR(255), -- Hashed password, nullable for OAuth users
    oauth_provider oauth_provider DEFAULT 'local',
    oauth_id VARCHAR(255),
    oauth_access_token VARCHAR(500),
    oauth_refresh_token VARCHAR(500),
    profile_image VARCHAR(500),
    phone_number VARCHAR(20),
    social_media JSONB DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    hobbies TEXT[] DEFAULT '{}',
    status user_status DEFAULT 'pending_verification',
    role user_role DEFAULT 'user',
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    last_password_change_at TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_oauth_id ON users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Create audit_logs table
CREATE TYPE IF NOT EXISTS audit_event_type AS ENUM (
    'user_login', 'user_logout', 'user_registration', 'password_change', 'password_reset',
    'email_verification', 'phone_verification', 'oauth_login', 'oauth_link', 'oauth_unlink',
    'profile_update', 'profile_image_update', 'login_attempt', 'account_locked', 'account_unlocked',
    'suspicious_activity', 'rate_limit_exceeded', 'permission_granted', 'permission_revoked',
    'role_change', 'data_created', 'data_updated', 'data_deleted', 'data_exported',
    'system_startup', 'system_shutdown', 'configuration_change', 'maintenance_mode'
);

CREATE TYPE IF NOT EXISTS audit_event_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE IF NOT EXISTS audit_event_status AS ENUM ('success', 'failure', 'partial');

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type audit_event_type NOT NULL,
    severity audit_event_severity DEFAULT 'low',
    status audit_event_status DEFAULT 'success',
    description VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    endpoint VARCHAR(255),
    http_method VARCHAR(10),
    http_status_code INTEGER,
    request_id VARCHAR(255),
    session_id VARCHAR(255),
    metadata JSONB,
    error_message VARCHAR(255),
    stack_trace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_agent ON audit_logs(user_agent);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

-- Insert default admin user (password: admin123 - change in production!)
INSERT INTO users (
    email, 
    name, 
    password, 
    oauth_provider, 
    status, 
    role, 
    is_email_verified, 
    is_phone_verified
) VALUES (
    'admin@smartwish.com',
    'System Administrator',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5u.GG', -- admin123
    'local',
    'active',
    'admin',
    TRUE,
    FALSE
) ON CONFLICT (email) DO NOTHING;

-- Log the system startup
INSERT INTO audit_logs (
    event_type,
    severity,
    status,
    description,
    details,
    metadata
) VALUES (
    'system_startup',
    'medium',
    'success',
    'Database migration completed - users and audit_logs tables created',
    '{"migration": "simple_migration", "tables": ["users", "audit_logs"]}',
    '{"component": "database", "version": "1.0.0"}'
);

-- Grant permissions to authenticated users (adjust based on your RLS policies)
-- This is optional and depends on your Supabase setup
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
