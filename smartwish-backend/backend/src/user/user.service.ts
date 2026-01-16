import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus, UserRole, OAuthProvider } from './user.entity';
import { AuditService } from '../common/audit/audit.service';
import { LoggerService } from '../common/logger/logger.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface ProfileUpdateData {
  email?: string;
  name?: string;
  phoneNumber?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    whatsapp?: string;
  };
  interests?: string[];
  hobbies?: string[];
}

interface OAuthUserData {
  email: string;
  name: string;
  oauthProvider: OAuthProvider;
  oauthId: string;
  profileImage?: string;
}

interface CreateUserData {
  email: string;
  password?: string;
  name: string;
  oauthProvider?: OAuthProvider;
  oauthId?: string;
  profileImage?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
    private logger: LoggerService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { email },
        select: [
          'id',
          'email',
          'name',
          'password',
          'status',
          'role',
          'oauthProvider',
          'oauthId',
          'isEmailVerified',
          'isPhoneVerified',
          'loginAttempts',
          'lockedUntil',
          'profileImage',
          'phoneNumber',
          'socialMedia',
          'interests',
          'hobbies',
          'createdAt',
          'updatedAt',
          'lastLoginAt',
        ],
      });

      this.logger.debug('User lookup by email: ' + email, {
        found: !!user,
        userId: user?.id,
        status: user?.status,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by email: ' + email, error.stack, {
        email,
      });
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        select: [
          'id',
          'email',
          'name',
          'status',
          'role',
          'oauthProvider',
          'oauthId',
          'isEmailVerified',
          'isPhoneVerified',
          'profileImage',
          'phoneNumber',
          'socialMedia',
          'interests',
          'hobbies',
          'createdAt',
          'updatedAt',
          'lastLoginAt',
        ],
      });

      this.logger.debug('User lookup by ID: ' + id, {
        found: !!user,
        userId: id,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by ID: ' + id, error.stack, {
        userId: id,
      });
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const users = await this.userRepository.find({
        select: [
          'id',
          'email',
          'name',
          'status',
          'role',
          'oauthProvider',
          'isEmailVerified',
          'isPhoneVerified',
          'createdAt',
          'updatedAt',
          'lastLoginAt',
        ],
        order: { createdAt: 'DESC' },
      });

      this.logger.debug('Retrieved ' + users.length + ' users');
      return users;
    } catch (error) {
      this.logger.error('Failed to retrieve all users', error.stack);
      throw error;
    }
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      // Validate password for local users
      if (
        data.oauthProvider === OAuthProvider.LOCAL &&
        (!data.password || data.password.length < 8)
      ) {
        throw new BadRequestException(
          'Password must be at least 8 characters long',
        );
      }

      const user = this.userRepository.create({
        email: data.email.toLowerCase(),
        name: data.name,
        password: data.password,
        oauthProvider: data.oauthProvider || OAuthProvider.LOCAL,
        oauthId: data.oauthId,
        profileImage: data.profileImage,
        status:
          data.oauthProvider === OAuthProvider.LOCAL
            ? UserStatus.PENDING_VERIFICATION
            : UserStatus.ACTIVE,
        role: UserRole.USER,
        isEmailVerified: data.oauthProvider !== OAuthProvider.LOCAL,
        isPhoneVerified: false,
        loginAttempts: 0,
        socialMedia: {
          facebook: undefined,
          instagram: undefined,
          tiktok: undefined,
          snapchat: undefined,
          whatsapp: undefined,
        },
        interests: [],
        hobbies: [],
        metadata: {},
      });

      const savedUser = await this.userRepository.save(user);

      this.logger.log('User created: ' + savedUser.email, {
        userId: savedUser.id,
        oauthProvider: savedUser.oauthProvider,
      });

      // Audit log the user creation
      await this.auditService.logRegistration(
        savedUser.id,
        undefined, // IP address will be set by the controller
        undefined, // User agent will be set by the controller
        { oauthProvider: savedUser.oauthProvider, status: savedUser.status },
      );

      return savedUser;
    } catch (error) {
      this.logger.error('Failed to create user: ' + data.email, error.stack, {
        email: data.email,
      });
      throw error;
    }
  }

  async createOAuthUser(userData: OAuthUserData): Promise<User> {
    try {
      // Check if user already exists by OAuth ID or email
      const existingUser = await this.userRepository.findOne({
        where: [
          { oauthProvider: userData.oauthProvider, oauthId: userData.oauthId },
          { email: userData.email },
        ],
      });

      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const user = await this.create({
        email: userData.email,
        name: userData.name,
        oauthProvider: userData.oauthProvider,
        oauthId: userData.oauthId,
        profileImage: userData.profileImage,
      });

      this.logger.log(
        'OAuth user created: ' + user.email + ' via ' + userData.oauthProvider,
        {
          userId: user.id,
          oauthProvider: userData.oauthProvider,
        },
      );

      return user;
    } catch (error) {
      this.logger.error(
        'Failed to create OAuth user: ' + userData.email,
        error.stack,
        {
          email: userData.email,
          oauthProvider: userData.oauthProvider,
        },
      );
      throw error;
    }
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.password) {
      return false;
    }

    try {
      const isValid = await bcrypt.compare(password, user.password);

      this.logger.debug('Password validation for user: ' + user.email, {
        userId: user.id,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error(
        'Password validation failed for user: ' + user.email,
        error.stack,
        { userId: user.id },
      );
      return false;
    }
  }

  async updateProfile(
    userId: string,
    updateData: ProfileUpdateData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Keep original user data for audit log
      const originalUser = { ...user };

      // Check if email is being changed and if it's already taken
      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await this.findByEmail(updateData.email);
        if (existingUser && existingUser.id !== userId) {
          throw new ConflictException('Email already taken');
        }
      }

      // Update fields
      Object.assign(user, updateData);
      user.updatedAt = new Date();

      const updatedUser = await this.userRepository.save(user);

      this.logger.log('Profile updated for user: ' + updatedUser.email, {
        userId: updatedUser.id,
      });

      // Audit log the profile update
      await this.auditService.logDataOperation(
        userId,
        'update',
        'user_profile',
        userId,
        originalUser,
        { updatedFields: Object.keys(updateData) },
      );

      return updatedUser;
    } catch (error) {
      this.logger.error(
        'Failed to update profile for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async updateProfileImage(
    userId: string,
    imageUrl: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.profileImage = imageUrl;
      user.updatedAt = new Date();

      const updatedUser = await this.userRepository.save(user);

      this.logger.log('Profile image updated for user: ' + updatedUser.email, {
        userId: updatedUser.id,
      });

      // Audit log the profile image update
      await this.auditService.logDataOperation(
        userId,
        'update',
        'user_profile_image',
        userId,
        { profileImage: user.profileImage },
        { imageUrl },
      );

      return updatedUser;
    } catch (error) {
      this.logger.error(
        'Failed to update profile image for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async findByOAuthId(
    provider: OAuthProvider,
    oauthId: string,
  ): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { oauthProvider: provider, oauthId },
      });

      this.logger.debug('OAuth user lookup: ' + provider + ':' + oauthId, {
        found: !!user,
        userId: user?.id,
      });

      return user;
    } catch (error) {
      this.logger.error(
        'Failed to find OAuth user: ' + provider + ':' + oauthId,
        error.stack,
        { provider, oauthId },
      );
      throw error;
    }
  }

  async linkOAuthProvider(
    userId: string,
    provider: OAuthProvider,
    oauthId: string,
    profileImage?: string,
    ipAddress?: string,
  ): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if OAuth provider is already linked to another account
      const existingOAuthUser = await this.findByOAuthId(provider, oauthId);
      if (existingOAuthUser && existingOAuthUser.id !== userId) {
        throw new ConflictException(
          'OAuth provider already linked to another account',
        );
      }

      user.oauthProvider = provider;
      user.oauthId = oauthId;
      if (profileImage) {
        user.profileImage = profileImage;
      }
      user.updatedAt = new Date();

      const updatedUser = await this.userRepository.save(user);

      this.logger.log('OAuth provider linked for user: ' + updatedUser.email, {
        userId: updatedUser.id,
        provider,
      });

      // Audit log the OAuth linking
      await this.auditService.log({
        userId,
        action: 'oauth_link',
        tableName: 'users',
        recordId: userId,
        newValues: { provider, oauthId, profileImage },
        ipAddress,
      });

      return updatedUser;
    } catch (error) {
      this.logger.error(
        'Failed to link OAuth provider for user: ' + userId,
        error.stack,
        { userId, provider },
      );
      throw error;
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.userRepository.update(userId, {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: undefined,
      });

      this.logger.debug('Last login updated for user: ' + userId, { userId });
    } catch (error) {
      this.logger.error(
        'Failed to update last login for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async incrementLoginAttempts(userId: string): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes

        // Audit log the account lock
        await this.auditService.logAccountLocked(
          userId,
          'Too many failed login attempts',
          undefined,
          undefined,
        );
      }

      await this.userRepository.save(user);

      this.logger.warn('Login attempts incremented for user: ' + user.email, {
        userId: user.id,
        loginAttempts: user.loginAttempts,
        locked: !!user.lockedUntil,
      });
    } catch (error) {
      this.logger.error(
        'Failed to increment login attempts for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    try {
      await this.userRepository.update(userId, {
        loginAttempts: 0,
        lockedUntil: undefined,
        updatedAt: new Date(),
      });

      this.logger.debug('Login attempts reset for user: ' + userId, { userId });
    } catch (error) {
      this.logger.error(
        'Failed to reset login attempts for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Get user with password field for password change
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          'id',
          'email',
          'name',
          'password',
          'oauthProvider',
          'status',
        ],
      });
      
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.password) {
        throw new BadRequestException('User does not have a password set');
      }

      // Validate current password
      const isCurrentPasswordValid = await this.validatePassword(
        user,
        currentPassword,
      );
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw new BadRequestException(
          'New password must be at least 8 characters long',
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await this.userRepository.update(userId, {
        password: hashedPassword,
        lastPasswordChangeAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log('Password changed for user: ' + user.email, {
        userId: user.id,
      });

      // Audit log the password change
      await this.auditService.logPasswordChange(userId, ipAddress, userAgent);
    } catch (error) {
      this.logger.error(
        'Failed to change password for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async verifyEmail(userId: string, token: string): Promise<boolean> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.emailVerificationToken !== token) {
        throw new BadRequestException('Invalid verification token');
      }

      if (
        user.emailVerificationExpires &&
        user.emailVerificationExpires < new Date()
      ) {
        throw new BadRequestException('Verification token expired');
      }

      // Update user verification status
      await this.userRepository.update(userId, {
        isEmailVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
        status:
          user.status === UserStatus.PENDING_VERIFICATION
            ? UserStatus.ACTIVE
            : user.status,
        updatedAt: new Date(),
      });

      this.logger.log('Email verified for user: ' + user.email, {
        userId: user.id,
      });

      // Audit log the email verification
      await this.auditService.log({
        userId,
        action: 'email_verification',
        tableName: 'users',
        recordId: userId,
        newValues: { token },
      });

      return true;
    } catch (error) {
      this.logger.error(
        'Failed to verify email for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async deleteUser(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Soft delete
      await this.userRepository.update(userId, {
        status: UserStatus.INACTIVE,
        updatedAt: new Date(),
      });

      this.logger.log('User deleted: ' + user.email, { userId: user.id });

      // Audit log the user deletion
      await this.auditService.logDataOperation(
        userId,
        'delete',
        'user_account',
        userId,
        undefined,
        { softDelete: true },
      );
    } catch (error) {
      this.logger.error('Failed to delete user: ' + userId, error.stack, {
        userId,
      });
      throw error;
    }
  }

  async getUsersByStatus(status: UserStatus): Promise<User[]> {
    try {
      const users = await this.userRepository.find({
        where: { status },
        select: [
          'id',
          'email',
          'name',
          'status',
          'role',
          'oauthProvider',
          'isEmailVerified',
          'isPhoneVerified',
          'createdAt',
          'updatedAt',
          'lastLoginAt',
        ],
        order: { createdAt: 'DESC' },
      });

      this.logger.debug(
        'Retrieved ' + users.length + ' users with status: ' + status,
      );
      return users;
    } catch (error) {
      this.logger.error(
        'Failed to retrieve users by status: ' + status,
        error.stack,
        { status },
      );
      throw error;
    }
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    try {
      const users = await this.userRepository.find({
        where: { role },
        select: [
          'id',
          'email',
          'name',
          'status',
          'role',
          'oauthProvider',
          'isEmailVerified',
          'isPhoneVerified',
          'createdAt',
          'updatedAt',
          'lastLoginAt',
        ],
        order: { createdAt: 'DESC' },
      });

      this.logger.debug('Retrieved ' + users.length + ' users with role: ' + role);
      return users;
    } catch (error) {
      this.logger.error(
        'Failed to retrieve users by role: ' + role,
        error.stack,
        { role },
      );
      throw error;
    }
  }

  async initiatePasswordReset(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        this.logger.warn('Password reset attempted for non-existent email: ' + email, {
          email,
          ipAddress,
        });
        // Return fake token data to prevent email enumeration
        return {
          token: 'fake-token-' + crypto.randomBytes(16).toString('hex'),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        };
      }

      if (user.oauthProvider !== OAuthProvider.LOCAL) {
        throw new BadRequestException(
          'Password reset not available for OAuth users',
        );
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Save reset token to user
      await this.userRepository.update(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: expiresAt,
        updatedAt: new Date(),
      });

      this.logger.log('Password reset initiated for user: ' + user.email, {
        userId: user.id,
      });

      // Audit log the password reset initiation
      await this.auditService.log({
        userId: user.id,
        action: 'password_reset_initiated',
        tableName: 'users',
        recordId: user.id,
        newValues: { tokenExpires: expiresAt },
        ipAddress,
        userAgent,
      });

      return { token: resetToken, expiresAt };
    } catch (error) {
      this.logger.error(
        'Failed to initiate password reset for email: ' + email,
        error.stack,
        { email },
      );
      throw error;
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    try {
      if (newPassword.length < 8) {
        throw new BadRequestException(
          'Password must be at least 8 characters long',
        );
      }

      // Find user by reset token
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.passwordResetToken')
        .addSelect('user.password')
        .where('user.passwordResetToken = :token', { token })
        .getOne();

      if (!user) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Check if token is expired
      if (
        !user.passwordResetExpires ||
        user.passwordResetExpires < new Date()
      ) {
        throw new BadRequestException('Reset token has expired');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password and clear reset token
      await this.userRepository.update(user.id, {
        password: hashedPassword,
        passwordResetToken: undefined,
        passwordResetExpires: undefined,
        lastPasswordChangeAt: new Date(),
        updatedAt: new Date(),
        // Reset login attempts on successful password reset
        loginAttempts: 0,
        lockedUntil: undefined,
      });

      this.logger.log('Password reset completed for user: ' + user.email, {
        userId: user.id,
      });

      // Audit log the password reset completion
      await this.auditService.log({
        userId: user.id,
        action: 'password_reset_completed',
        tableName: 'users',
        recordId: user.id,
        newValues: { method: 'password_reset' },
        ipAddress,
        userAgent,
      });

      return true;
    } catch (error) {
      this.logger.error(
        'Failed to reset password with token: ' + token,
        error.stack,
        { token: token.substring(0, 8) + '...' },
      );
      throw error;
    }
  }

  async generateEmailVerificationToken(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.isEmailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      // Generate secure verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save verification token to user
      await this.userRepository.update(userId, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt,
        updatedAt: new Date(),
      });

      this.logger.log(
        'Email verification token generated for user: ' + user.email,
        { userId },
      );

      return { token: verificationToken, expiresAt };
    } catch (error) {
      this.logger.error(
        'Failed to generate email verification token for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }

  async updatePhoneNumber(
    userId: string,
    phoneNumber: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const originalUser = { ...user };

      user.phoneNumber = phoneNumber;
      user.isPhoneVerified = false; // Reset phone verification
      user.updatedAt = new Date();

      const updatedUser = await this.userRepository.save(user);

      this.logger.log('Phone number updated for user: ' + updatedUser.email, {
        userId: updatedUser.id,
      });

      // Audit log the phone number update
      await this.auditService.logDataOperation(
        userId,
        'update',
        'user_phone',
        userId,
        originalUser,
        { phoneNumber },
      );

      return updatedUser;
    } catch (error) {
      this.logger.error(
        'Failed to update phone number for user: ' + userId,
        error.stack,
        { userId },
      );
      throw error;
    }
  }
}
