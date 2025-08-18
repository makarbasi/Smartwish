import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEnum,
} from 'class-validator';
import * as bcrypt from 'bcrypt';

export enum OAuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  INSTAGRAM = 'instagram',
  WHATSAPP = 'whatsapp',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['oauthProvider', 'oauthId'])
@Index(['status'])
@Index(['createdAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @IsEmail()
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @Column({
    type: 'enum',
    enum: OAuthProvider,
    default: OAuthProvider.LOCAL,
    name: 'oauth_provider'
  })
  @IsEnum(OAuthProvider)
  oauthProvider: OAuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'oauth_id' })
  @IsOptional()
  @IsString()
  oauthId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'oauth_access_token' })
  @IsOptional()
  @IsString()
  oauthAccessToken?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'oauth_refresh_token' })
  @IsOptional()
  @IsString()
  oauthRefreshToken?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'profile_image' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'social_media' })
  @IsOptional()
  @IsArray()
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    whatsapp?: string;
  };

  @Column('text', { array: true, nullable: true, name: 'interests' })
  @IsOptional()
  @IsArray()
  interests?: string[];

  @Column('text', { array: true, nullable: true, name: 'hobbies' })
  @IsOptional()
  @IsArray()
  hobbies?: string[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
    name: 'status'
  })
  @IsEnum(UserStatus)
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
    name: 'role'
  })
  @IsEnum(UserRole)
  role: UserRole;

  @Column({ type: 'boolean', default: false, name: 'is_email_verified' })
  @IsBoolean()
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_phone_verified' })
  @IsBoolean()
  isPhoneVerified: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  @IsOptional()
  lastLoginAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_password_change_at' })
  @IsOptional()
  lastPasswordChangeAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false, name: 'password_reset_token' })
  @IsOptional()
  @IsString()
  passwordResetToken?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'password_reset_expires' })
  @IsOptional()
  passwordResetExpires?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false, name: 'email_verification_token' })
  @IsOptional()
  @IsString()
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'email_verification_expires' })
  @IsOptional()
  emailVerificationExpires?: Date;

  @Column({ type: 'int', default: 0, name: 'login_attempts' })
  loginAttempts: number;

  @Column({ type: 'timestamp', nullable: true, name: 'locked_until' })
  @IsOptional()
  lockedUntil?: Date;

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  @IsOptional()
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  @IsOptional()
  deletedAt?: Date;

  // Hooks
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && this.password.length > 0) {
      // Only hash if password has changed and is not already hashed
      // Check if password looks like a hash (starts with $2b$)
      if (!this.password.startsWith('$2b$')) {
        this.password = await bcrypt.hash(this.password, 12);
        this.lastPasswordChangeAt = new Date();
      }
    }
  }

  // Methods
  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  async incrementLoginAttempts(): Promise<void> {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
    }
  }

  async resetLoginAttempts(): Promise<void> {
    this.loginAttempts = 0;
    this.lockedUntil = undefined;
  }

  isLocked(): boolean {
    return this.lockedUntil ? this.lockedUntil > new Date() : false;
  }

  canLogin(): boolean {
    return this.status === UserStatus.ACTIVE && !this.isLocked();
  }
}
