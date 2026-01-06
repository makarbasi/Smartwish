import { Injectable, NotFoundException, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { User, UserRole, UserStatus, OAuthProvider } from '../user/user.entity';
import { CreateKioskConfigDto } from './dto/create-kiosk-config.dto';
import { UpdateKioskConfigDto } from './dto/update-kiosk-config.dto';

const DEFAULT_KIOSK_CONFIG = {
  theme: 'default',
  featuredTemplateIds: [] as string[],
  micEnabled: true,
  ads: {
    playlist: [] as Array<{ url: string; duration?: number; weight?: number }>,
  },
  printerProfile: 'default',
};

@Injectable()
export class KioskConfigService {
  constructor(
    @InjectRepository(KioskConfig)
    private readonly kioskRepo: Repository<KioskConfig>,
    @InjectRepository(KioskManager)
    private readonly kioskManagerRepo: Repository<KioskManager>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  private generateApiKey() {
    return randomBytes(24).toString('hex');
  }

  private mergeConfig(storedConfig: Record<string, any> | null | undefined) {
    return {
      ...DEFAULT_KIOSK_CONFIG,
      ...(storedConfig || {}),
    };
  }

  async list() {
    const records = await this.kioskRepo.find({
      order: { updatedAt: 'DESC' },
    });
    return records.map((r) => ({
      ...r,
      config: this.mergeConfig(r.config),
    }));
  }

  async delete(kioskId: string) {
    const record = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!record) throw new NotFoundException('Kiosk not found');
    await this.kioskRepo.remove(record);
    return { success: true, kioskId };
  }

  async create(dto: CreateKioskConfigDto) {
    const existing = await this.kioskRepo.findOne({ where: { kioskId: dto.kioskId } });
    if (existing) {
      throw new UnauthorizedException('Kiosk already exists');
    }

    const entity = this.kioskRepo.create({
      kioskId: dto.kioskId,
      storeId: dto.storeId,
      name: dto.name,
      config: dto.config || DEFAULT_KIOSK_CONFIG,
      apiKey: this.generateApiKey(),
      version: '1.0.0',
    });
    const saved = await this.kioskRepo.save(entity);
    return { ...saved, config: this.mergeConfig(saved.config) };
  }

  async update(kioskId: string, dto: UpdateKioskConfigDto) {
    const record = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!record) throw new NotFoundException('Kiosk not found');
    const updated = Object.assign(record, {
      storeId: dto.storeId ?? record.storeId,
      name: dto.name ?? record.name,
      version: dto.version ?? record.version,
      config: dto.config ? { ...record.config, ...dto.config } : record.config,
    });
    const saved = await this.kioskRepo.save(updated);
    return { ...saved, config: this.mergeConfig(saved.config) };
  }

  async rotateApiKey(kioskId: string) {
    const record = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!record) throw new NotFoundException('Kiosk not found');
    record.apiKey = this.generateApiKey();
    const saved = await this.kioskRepo.save(record);
    return { ...saved, config: this.mergeConfig(saved.config) };
  }

  async getMergedConfig(kioskId: string, apiKey?: string) {
    const record = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!record) throw new NotFoundException('Kiosk not found');
    if (!apiKey || record.apiKey !== apiKey) {
      throw new UnauthorizedException('Invalid kiosk API key');
    }
    const merged = this.mergeConfig(record.config);
    return {
      kioskId: record.kioskId,
      version: record.version,
      config: merged,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Get kiosk config by UUID (used by activated kiosks)
   * No API key required - kiosk was already authenticated during activation
   */
  async getConfigById(id: string) {
    const record = await this.kioskRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Kiosk not found');
    if (!record.isActive) throw new BadRequestException('Kiosk is not active');
    const merged = this.mergeConfig(record.config);
    return {
      id: record.id,
      kioskId: record.kioskId,
      name: record.name,
      storeId: record.storeId,
      version: record.version,
      config: merged,
      updatedAt: record.updatedAt,
    };
  }

  // ==================== Manager Management ====================

  /**
   * List all managers (users with role MANAGER)
   */
  async listManagers() {
    const managers = await this.userRepo.find({
      where: { role: UserRole.MANAGER },
      select: ['id', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'lastLoginAt'],
      order: { createdAt: 'DESC' },
    });

    // Get kiosk assignment counts for each manager
    const managersWithCounts = await Promise.all(
      managers.map(async (manager) => {
        const kioskCount = await this.kioskManagerRepo.count({
          where: { userId: manager.id },
        });
        return { ...manager, assignedKiosksCount: kioskCount };
      }),
    );

    return managersWithCounts;
  }

  /**
   * Create a new manager (invite via email)
   */
  async createManager(email: string, name: string, adminId: string) {
    // Check if user already exists
    const existingUser = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      if (existingUser.role === UserRole.MANAGER) {
        throw new ConflictException('A manager with this email already exists');
      }
      throw new ConflictException('A user with this email already exists');
    }

    // Generate email verification token for password setup
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create the manager user
    const manager = this.userRepo.create({
      email: email.toLowerCase(),
      name,
      role: UserRole.MANAGER,
      status: UserStatus.PENDING_VERIFICATION,
      oauthProvider: OAuthProvider.LOCAL,
      isEmailVerified: false,
      isPhoneVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: expiresAt,
      loginAttempts: 0,
    });

    const savedManager = await this.userRepo.save(manager);

    // Send invitation email
    const emailSent = await this.sendManagerInviteEmail(
      savedManager.email,
      savedManager.name,
      verificationToken,
      expiresAt,
    );

    // Return manager with invite token
    return {
      id: savedManager.id,
      email: savedManager.email,
      name: savedManager.name,
      status: savedManager.status,
      createdAt: savedManager.createdAt,
      inviteToken: verificationToken,
      inviteExpiresAt: expiresAt,
      emailSent,
    };
  }

  /**
   * Send manager invitation email
   */
  private async sendManagerInviteEmail(
    email: string,
    name: string,
    token: string,
    expiresAt: Date,
  ): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
        secure: true,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://smartwish.us';
      const setupUrl = `${frontendUrl}/kiosk/setup?token=${token}`;

      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@smartwish.us',
        to: email,
        subject: 'You have been invited to manage SmartWish kiosks',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 28px;">SmartWish</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Kiosk Management System</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333; margin-bottom: 20px;">Welcome, ${name}!</h2>
              
              <p style="color: #666; line-height: 1.6;">
                You have been invited to become a Store Manager for SmartWish kiosks. 
                As a manager, you'll be able to activate and configure kiosks assigned to you.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <p style="color: #666; margin-bottom: 15px;">
                  <strong>Click the button below to set up your account:</strong>
                </p>
                
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${setupUrl}" 
                     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; padding: 15px 30px; text-decoration: none; 
                            border-radius: 8px; font-size: 16px; font-weight: bold;">
                    Set Up Your Account
                  </a>
                </div>
                
                <p style="color: #999; font-size: 12px; margin-top: 15px;">
                  This link will expire on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}.
                </p>
              </div>
              
              <p style="color: #999; font-size: 12px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            
            <div style="background: #333; padding: 20px; text-align: center; color: #999; font-size: 12px;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} SmartWish. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Manager invitation email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending manager invitation email:', error);
      return false;
    }
  }

  /**
   * Verify manager invitation token
   */
  async verifyInviteToken(token: string) {
    const user = await this.userRepo.findOne({
      where: { 
        emailVerificationToken: token,
        role: UserRole.MANAGER,
      },
      select: ['id', 'email', 'name', 'emailVerificationExpires'],
    });

    if (!user) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      throw new BadRequestException('Invitation token has expired');
    }

    return {
      valid: true,
      email: user.email,
      name: user.name,
    };
  }

  /**
   * Complete manager account setup (set password and activate)
   */
  async completeManagerSetup(token: string, password: string) {
    const user = await this.userRepo.findOne({
      where: { 
        emailVerificationToken: token,
        role: UserRole.MANAGER,
      },
    });

    if (!user) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      throw new BadRequestException('Invitation token has expired');
    }

    // Hash the password using bcrypt
    const bcrypt = await import('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user
    user.password = hashedPassword;
    user.status = UserStatus.ACTIVE;
    user.isEmailVerified = true;
    user.emailVerificationToken = null as unknown as string;
    user.emailVerificationExpires = null as unknown as Date;

    await this.userRepo.save(user);

    return {
      success: true,
      message: 'Account set up successfully',
      email: user.email,
    };
  }

  /**
   * Delete a manager
   */
  async deleteManager(managerId: string) {
    const manager = await this.userRepo.findOne({
      where: { id: managerId, role: UserRole.MANAGER },
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Remove all kiosk assignments first
    await this.kioskManagerRepo.delete({ userId: managerId });

    // Delete the user
    await this.userRepo.remove(manager);

    return { success: true, managerId };
  }

  /**
   * Get a single manager by ID
   */
  async getManager(managerId: string) {
    const manager = await this.userRepo.findOne({
      where: { id: managerId, role: UserRole.MANAGER },
      select: ['id', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'lastLoginAt'],
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Get assigned kiosks
    const assignments = await this.kioskManagerRepo.find({
      where: { userId: managerId },
      relations: ['kiosk'],
    });

    return {
      ...manager,
      assignedKiosks: assignments.map((a) => ({
        id: a.kiosk.id,
        kioskId: a.kiosk.kioskId,
        name: a.kiosk.name,
        storeId: a.kiosk.storeId,
        assignedAt: a.assignedAt,
      })),
    };
  }

  // ==================== Kiosk-Manager Assignments ====================

  /**
   * Assign a manager to a kiosk
   */
  async assignManager(kioskId: string, userId: string, assignedBy: string) {
    // Verify kiosk exists
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException('Kiosk not found');
    }

    // Verify user is a manager
    const manager = await this.userRepo.findOne({
      where: { id: userId, role: UserRole.MANAGER },
    });
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Check if assignment already exists
    const existingAssignment = await this.kioskManagerRepo.findOne({
      where: { kioskId: kiosk.id, userId },
    });
    if (existingAssignment) {
      throw new ConflictException('Manager is already assigned to this kiosk');
    }

    // Create assignment
    const assignment = this.kioskManagerRepo.create({
      kioskId: kiosk.id,
      userId,
      assignedBy,
    });

    const saved = await this.kioskManagerRepo.save(assignment);

    return {
      id: saved.id,
      kioskId: kiosk.kioskId,
      managerId: userId,
      managerEmail: manager.email,
      managerName: manager.name,
      assignedAt: saved.assignedAt,
    };
  }

  /**
   * Unassign a manager from a kiosk
   */
  async unassignManager(kioskId: string, userId: string) {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException('Kiosk not found');
    }

    const assignment = await this.kioskManagerRepo.findOne({
      where: { kioskId: kiosk.id, userId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.kioskManagerRepo.remove(assignment);

    return { success: true, kioskId, userId };
  }

  /**
   * Get all managers assigned to a kiosk
   */
  async getKioskManagers(kioskId: string) {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException('Kiosk not found');
    }

    const assignments = await this.kioskManagerRepo.find({
      where: { kioskId: kiosk.id },
      relations: ['user'],
    });

    return assignments.map((a) => ({
      id: a.user.id,
      email: a.user.email,
      name: a.user.name,
      status: a.user.status,
      assignedAt: a.assignedAt,
    }));
  }

  /**
   * Get all kiosks assigned to a manager (for manager's kiosk selection)
   */
  async getManagerKiosks(userId: string) {
    const assignments = await this.kioskManagerRepo.find({
      where: { userId },
      relations: ['kiosk'],
    });

    return assignments
      .filter((a) => a.kiosk.isActive)
      .map((a) => ({
        id: a.kiosk.id,
        kioskId: a.kiosk.kioskId,
        name: a.kiosk.name,
        storeId: a.kiosk.storeId,
        config: this.mergeConfig(a.kiosk.config),
        assignedAt: a.assignedAt,
      }));
  }

  /**
   * Bulk assign managers to a kiosk
   */
  async bulkAssignManagers(kioskId: string, userIds: string[], assignedBy: string) {
    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          return await this.assignManager(kioskId, userId, assignedBy);
        } catch (error) {
          return { userId, error: error.message };
        }
      }),
    );
    return results;
  }
}
