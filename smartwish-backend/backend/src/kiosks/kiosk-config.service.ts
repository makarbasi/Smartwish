import { Injectable, NotFoundException, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as bcrypt from 'bcrypt';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { KioskPrintLog, PrintStatus, RefundStatus } from './kiosk-print-log.entity';
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
  printerName: '' as string,
  printerIP: '' as string, // Printer IP address for IPP printing
};

@Injectable()
export class KioskConfigService {
  constructor(
    @InjectRepository(KioskConfig)
    private readonly kioskRepo: Repository<KioskConfig>,
    @InjectRepository(KioskManager)
    private readonly kioskManagerRepo: Repository<KioskManager>,
    @InjectRepository(KioskPrintLog)
    private readonly printLogRepo: Repository<KioskPrintLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
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
      console.log('📧 Attempting to send manager invitation email to:', email);
      console.log('📧 Email configuration:', {
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: process.env.SMTP_PORT || '587',
        user: process.env.EMAIL_USER ? 'configured' : 'MISSING',
        pass: process.env.EMAIL_PASS ? 'configured' : 'MISSING',
      });

      // Check if email configuration is available
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email configuration missing - EMAIL_USER or EMAIL_PASS not set');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2' // Office 365 requires TLS 1.2+
        },
      });

      // Verify the connection before sending
      console.log('🔍 Verifying email connection...');
      await transporter.verify();
      console.log('✅ Email connection verified');

      const frontendUrl = process.env.FRONTEND_URL || 'https://app.smartwish.us';
      const setupUrl = `${frontendUrl}/managers/signup?token=${token}`;

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

      console.log('📤 Sending manager invitation email...');
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Manager invitation email sent to ${email}`, result.messageId);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending manager invitation email:', {
        message: error.message,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        response: error.response,
      });
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
   * Manager login
   */
  async managerLogin(email: string, password: string) {
    console.log('[managerLogin] Attempting login for:', email.toLowerCase());

    // Find user by email
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password') // password is not selected by default
      .where('user.email = :email', { email: email.toLowerCase() })
      .andWhere('user.role = :role', { role: UserRole.MANAGER })
      .getOne();

    if (!user) {
      // Debug: check if user exists with different role
      const anyUser = await this.userRepo.findOne({
        where: { email: email.toLowerCase() }
      });
      console.log('[managerLogin] User not found with MANAGER role. Any user with this email?', anyUser ? `Yes, role: ${anyUser.role}` : 'No');
      throw new UnauthorizedException('Invalid email or password');
    }

    console.log('[managerLogin] Found user:', { id: user.id, status: user.status, hasPassword: !!user.password });

    if (user.status !== UserStatus.ACTIVE) {
      console.log('[managerLogin] User status is not active:', user.status);
      throw new UnauthorizedException('Account is not active. Please complete your account setup first.');
    }

    if (!user.password) {
      console.log('[managerLogin] User has no password set');
      throw new UnauthorizedException('Password not set. Please complete your account setup.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('[managerLogin] Password validation result:', isPasswordValid);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Generate JWT token
    const payload = {
      email: user.email,
      sub: user.id,
    };

    const token = this.jwtService.sign(payload);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      token,
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
   * Includes apiKey for device pairing functionality
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
        apiKey: a.kiosk.apiKey, // Include API key for device pairing
        isActive: a.kiosk.isActive,
        config: this.mergeConfig(a.kiosk.config),
        surveillance: (a.kiosk.config as any)?.surveillance || null, // Include surveillance config
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

  // ==================== Print Log Methods ====================

  /**
   * Create a new print log entry
   */
  async createPrintLog(data: {
    kioskId: string;
    productType?: string;
    productId?: string;
    productName?: string;
    pdfUrl?: string;
    price?: number;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    tilloOrderId?: string;
    tilloTransactionRef?: string;
    giftCardBrand?: string;
    giftCardAmount?: number;
    giftCardCode?: string;
    printerName?: string;
    paperType?: string;
    paperSize?: string;
    trayNumber?: number;
    copies?: number;
    initiatedBy?: string;
  }): Promise<KioskPrintLog> {
    // Verify kiosk exists
    const kiosk = await this.kioskRepo.findOne({ where: { id: data.kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${data.kioskId} not found`);
    }

    // Use printerName from request, or fall back to kiosk config
    const printerName = data.printerName || (kiosk.config as any)?.printerName || null;

    const printLog = this.printLogRepo.create({
      kioskId: data.kioskId,
      productType: data.productType || 'greeting-card',
      productId: data.productId,
      productName: data.productName,
      pdfUrl: data.pdfUrl,
      price: data.price || 0,
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeChargeId: data.stripeChargeId,
      tilloOrderId: data.tilloOrderId,
      tilloTransactionRef: data.tilloTransactionRef,
      giftCardBrand: data.giftCardBrand,
      giftCardAmount: data.giftCardAmount,
      giftCardCode: data.giftCardCode,
      printerName,
      paperType: data.paperType,
      paperSize: data.paperSize,
      trayNumber: data.trayNumber,
      copies: data.copies || 1,
      status: PrintStatus.PENDING,
      initiatedBy: data.initiatedBy,
    });

    return this.printLogRepo.save(printLog);
  }

  /**
   * Update print log status (and optionally pdfUrl)
   */
  async updatePrintLogStatus(
    logId: string,
    status: PrintStatus,
    errorMessage?: string,
    pdfUrl?: string,
  ): Promise<KioskPrintLog> {
    const log = await this.printLogRepo.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    log.status = status;
    if (status === PrintStatus.PROCESSING) {
      log.startedAt = new Date();
    } else if (status === PrintStatus.COMPLETED || status === PrintStatus.FAILED) {
      log.completedAt = new Date();
    }
    if (errorMessage) {
      log.errorMessage = errorMessage;
    }
    if (pdfUrl) {
      log.pdfUrl = pdfUrl;
    }

    return this.printLogRepo.save(log);
  }

  /**
   * Update print log with PDF URL (for reprint functionality)
   */
  async updatePrintLogPdfUrl(logId: string, pdfUrl: string): Promise<KioskPrintLog> {
    const log = await this.printLogRepo.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    log.pdfUrl = pdfUrl;
    return this.printLogRepo.save(log);
  }

  /**
   * Get print logs for a specific kiosk
   */
  async getKioskPrintLogs(
    kioskId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: PrintStatus;
      productType?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const query = this.printLogRepo
      .createQueryBuilder('log')
      .where('log.kiosk_id = :kioskId', { kioskId })
      .orderBy('log.created_at', 'DESC');

    if (options?.status) {
      query.andWhere('log.status = :status', { status: options.status });
    }
    if (options?.productType) {
      query.andWhere('log.product_type = :productType', { productType: options.productType });
    }
    if (options?.startDate) {
      query.andWhere('log.created_at >= :startDate', { startDate: options.startDate });
    }
    if (options?.endDate) {
      query.andWhere('log.created_at <= :endDate', { endDate: options.endDate });
    }

    const total = await query.getCount();

    if (options?.limit) {
      query.limit(options.limit);
    }
    if (options?.offset) {
      query.offset(options.offset);
    }

    const logs = await query.getMany();

    return { logs, total };
  }

  /**
   * Get print logs for all kiosks assigned to a manager
   */
  async getManagerPrintLogs(
    managerId: string,
    options?: {
      limit?: number;
      offset?: number;
      kioskId?: string;
      status?: PrintStatus;
      productType?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    // First get all kiosk IDs assigned to this manager
    const assignments = await this.kioskManagerRepo.find({
      where: { userId: managerId },
      relations: ['kiosk'],
    });

    if (assignments.length === 0) {
      return { logs: [], total: 0, kiosks: [] };
    }

    const kioskIds = assignments.map(a => a.kioskId);

    const query = this.printLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.kiosk', 'kiosk')
      .where('log.kiosk_id IN (:...kioskIds)', { kioskIds })
      .orderBy('log.created_at', 'DESC');

    if (options?.kioskId) {
      query.andWhere('log.kiosk_id = :kioskId', { kioskId: options.kioskId });
    }
    if (options?.status) {
      query.andWhere('log.status = :status', { status: options.status });
    }
    if (options?.productType) {
      query.andWhere('log.product_type = :productType', { productType: options.productType });
    }
    if (options?.startDate) {
      query.andWhere('log.created_at >= :startDate', { startDate: options.startDate });
    }
    if (options?.endDate) {
      query.andWhere('log.created_at <= :endDate', { endDate: options.endDate });
    }

    const total = await query.getCount();

    if (options?.limit) {
      query.limit(options.limit);
    }
    if (options?.offset) {
      query.offset(options.offset);
    }

    const logs = await query.getMany();

    // Get kiosk info for context
    const kiosks = assignments.map(a => ({
      id: a.kiosk.id,
      kioskId: a.kiosk.kioskId,
      name: a.kiosk.name,
      storeId: a.kiosk.storeId,
    }));

    return { logs, total, kiosks };
  }

  /**
   * Get print statistics for a manager's kiosks
   * Includes revenue calculations:
   * - Transaction fee = $0.50 + 3% of sale price
   * - Net profit = Sale price - Transaction fee
   * - Store share = revenueSharePercent * Net profit
   * 
   * OPTIMIZED: Uses consolidated queries to reduce database calls
   */
  async getManagerPrintStats(managerId: string, days: number = 30) {
    const assignments = await this.kioskManagerRepo.find({
      where: { userId: managerId },
      relations: ['kiosk'],
    });

    if (assignments.length === 0) {
      return {
        totalPrints: 0,
        completedPrints: 0,
        failedPrints: 0,
        printsByKiosk: [],
        printsByProductType: [],
        recentActivity: [],
        // Revenue data
        totalSales: 0,
        transactionFees: 0,
        netProfit: 0,
        storeOwnerShare: 0,
        revenueByKiosk: [],
      };
    }

    const kioskIds = assignments.map(a => a.kioskId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Create a map of kiosk ID to revenue share percent
    const kioskShareMap = new Map<string, number>();
    for (const a of assignments) {
      const config = a.kiosk?.config as Record<string, any> || {};
      kioskShareMap.set(a.kioskId, config.revenueSharePercent ?? 30);
    }

    // OPTIMIZED: Single query to get all counts by status
    const statusCounts = await this.printLogRepo
      .createQueryBuilder('log')
      .select('log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('log.kiosk_id IN (:...kioskIds)', { kioskIds })
      .andWhere('log.created_at >= :startDate', { startDate })
      .groupBy('log.status')
      .getRawMany();

    // Parse counts from single query result
    let totalPrints = 0;
    let completedPrints = 0;
    let failedPrints = 0;
    for (const row of statusCounts) {
      const count = parseInt(row.count) || 0;
      totalPrints += count;
      if (row.status === PrintStatus.COMPLETED) completedPrints = count;
      if (row.status === PrintStatus.FAILED) failedPrints = count;
    }

    // OPTIMIZED: Combined query for prints by kiosk with sales data
    const printsByKioskWithSales = await this.printLogRepo
      .createQueryBuilder('log')
      .select('log.kiosk_id', 'kioskId')
      .addSelect('kiosk.name', 'kioskName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CASE WHEN log.status = :completed THEN log.price * log.copies ELSE 0 END)', 'totalSales')
      .addSelect('SUM(CASE WHEN log.status = :completed THEN 1 ELSE 0 END)', 'completedCount')
      .leftJoin('log.kiosk', 'kiosk')
      .where('log.kiosk_id IN (:...kioskIds)', { kioskIds })
      .andWhere('log.created_at >= :startDate', { startDate })
      .groupBy('log.kiosk_id')
      .addGroupBy('kiosk.name')
      .setParameter('completed', PrintStatus.COMPLETED)
      .getRawMany();

    // Extract printsByKiosk from combined result
    const printsByKiosk = printsByKioskWithSales.map(row => ({
      kioskId: row.kioskId,
      kioskName: row.kioskName,
      count: row.count,
    }));

    // Prints by product type
    const printsByProductType = await this.printLogRepo
      .createQueryBuilder('log')
      .select('log.product_type', 'productType')
      .addSelect('COUNT(*)', 'count')
      .where('log.kiosk_id IN (:...kioskIds)', { kioskIds })
      .andWhere('log.created_at >= :startDate', { startDate })
      .groupBy('log.product_type')
      .getRawMany();

    // Recent activity (last 10)
    const recentActivity = await this.printLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.kiosk', 'kiosk')
      .where('log.kiosk_id IN (:...kioskIds)', { kioskIds })
      .orderBy('log.created_at', 'DESC')
      .limit(10)
      .getMany();

    // ==================== Revenue Calculations ====================
    // OPTIMIZED: Use the combined printsByKioskWithSales data instead of separate query
    let totalSales = 0;
    let transactionFees = 0;
    let netProfit = 0;
    let storeOwnerShare = 0;

    const revenueByKiosk = printsByKioskWithSales.map(row => {
      const sales = parseFloat(row.totalSales) || 0;
      const printCount = parseInt(row.completedCount) || 0;
      // Transaction fee: $0.50 + 3% per print
      const fees = (0.50 * printCount) + (sales * 0.03);
      const profit = sales - fees;
      const sharePercent = kioskShareMap.get(row.kioskId) ?? 30;
      const share = profit * (sharePercent / 100);

      totalSales += sales;
      transactionFees += fees;
      netProfit += profit;
      storeOwnerShare += share;

      return {
        kioskId: row.kioskId,
        kioskName: row.kioskName,
        printCount,
        totalSales: Math.round(sales * 100) / 100,
        transactionFees: Math.round(fees * 100) / 100,
        netProfit: Math.round(profit * 100) / 100,
        revenueSharePercent: sharePercent,
        storeOwnerShare: Math.round(share * 100) / 100,
      };
    });

    return {
      totalPrints,
      completedPrints,
      failedPrints,
      printsByKiosk,
      printsByProductType,
      recentActivity,
      // Revenue data (rounded to 2 decimal places)
      totalSales: Math.round(totalSales * 100) / 100,
      transactionFees: Math.round(transactionFees * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      storeOwnerShare: Math.round(storeOwnerShare * 100) / 100,
      revenueByKiosk,
    };
  }

  // ==================== Reprint & Refund Methods ====================

  /**
   * Get a single print log by ID (with kiosk info)
   */
  async getPrintLogById(logId: string): Promise<KioskPrintLog> {
    const log = await this.printLogRepo.findOne({
      where: { id: logId },
      relations: ['kiosk'],
    });
    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }
    return log;
  }

  /**
   * Reprint a print job (manager action)
   * Returns the print log with updated reprint info
   */
  async reprintJob(
    logId: string,
    managerId: string,
  ): Promise<{ printLog: KioskPrintLog; reprintJob: any }> {
    const log = await this.printLogRepo.findOne({
      where: { id: logId },
      relations: ['kiosk'],
    });

    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    if (!log.pdfUrl) {
      throw new BadRequestException('Cannot reprint: No PDF stored for this print job');
    }

    // Check reprint limit (max 3 reprints)
    if (log.reprintCount >= 3) {
      throw new BadRequestException('Maximum reprint limit (3) reached for this job');
    }

    // Update reprint tracking
    log.reprintCount = (log.reprintCount || 0) + 1;
    log.lastReprintedAt = new Date();
    log.lastReprintedBy = managerId;

    await this.printLogRepo.save(log);

    // Create the reprint job data (to be sent to printer)
    const reprintJob = {
      id: `reprint-${log.id}-${log.reprintCount}`,
      originalJobId: log.id,
      pdfUrl: log.pdfUrl,
      kioskId: log.kioskId,
      kioskName: log.kiosk?.name,
      printerName: (log.kiosk?.config as any)?.printerName || 'default',
      paperType: log.paperType,
      paperSize: log.paperSize,
      trayNumber: log.trayNumber,
      reprintNumber: log.reprintCount,
      initiatedBy: managerId,
      createdAt: new Date().toISOString(),
    };

    return { printLog: log, reprintJob };
  }

  /**
   * Process a refund for a print job (admin action)
   */
  async processRefund(
    logId: string,
    adminId: string,
    refundType: 'partial' | 'full',
    reason: string,
  ): Promise<{ printLog: KioskPrintLog; refundResult: any }> {
    const log = await this.printLogRepo.findOne({
      where: { id: logId },
      relations: ['kiosk'],
    });

    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    if (log.refundStatus) {
      throw new BadRequestException(`This job has already been refunded (${log.refundStatus})`);
    }

    if (!log.stripePaymentIntentId && !log.stripeChargeId) {
      throw new BadRequestException('Cannot refund: No Stripe payment info found for this job');
    }

    // Calculate refund amount
    let refundAmount = 0;
    if (refundType === 'full') {
      refundAmount = parseFloat(log.price?.toString()) || 0;
    } else {
      // Partial refund: refund everything except gift card
      const totalPrice = parseFloat(log.price?.toString()) || 0;
      const giftCardAmount = parseFloat(log.giftCardAmount?.toString()) || 0;
      refundAmount = totalPrice - giftCardAmount;
    }

    // Note: Actual Stripe refund would be called here
    // For now, we just record the refund info
    // In production, you'd call: await stripe.refunds.create({ ... })

    const refundResult = {
      success: true,
      refundId: `refund_${Date.now()}`, // Placeholder - would be Stripe refund ID
      amount: refundAmount,
      stripePaymentIntentId: log.stripePaymentIntentId,
      stripeChargeId: log.stripeChargeId,
      tilloOrderId: log.tilloOrderId,
      giftCardNote: log.tilloOrderId
        ? 'Gift card was already issued. Contact Tillo support with order ID to void if needed.'
        : null,
    };

    // Update refund tracking
    log.refundStatus = refundType as any;
    log.refundAmount = refundAmount;
    log.refundedAt = new Date();
    log.refundedBy = adminId;
    log.refundReason = reason;

    await this.printLogRepo.save(log);

    return { printLog: log, refundResult };
  }

  /**
   * Get print log details for manager (verify they have access)
   */
  async getManagerPrintLogById(logId: string, managerId: string): Promise<KioskPrintLog> {
    // First check if manager has access to this kiosk
    const log = await this.printLogRepo.findOne({
      where: { id: logId },
      relations: ['kiosk'],
    });

    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    // Verify manager has access to this kiosk
    const assignment = await this.kioskManagerRepo.findOne({
      where: { kioskId: log.kioskId, userId: managerId },
    });

    if (!assignment) {
      throw new UnauthorizedException('You do not have access to this print job');
    }

    return log;
  }

  // ==================== Local Print Agent Endpoints ====================

  /**
   * Get printer configurations for all active kiosks
   * Used by print agent to display configured printers at startup
   */
  async getAllKioskPrinterConfigs(): Promise<any[]> {
    const kiosks = await this.kioskRepo.find({
      where: { isActive: true },
      order: { kioskId: 'ASC' },
    });

    return kiosks.map(kiosk => ({
      kioskId: kiosk.kioskId,
      name: kiosk.name || kiosk.kioskId,
      printerName: (kiosk.config as any)?.printerName || null,
      printerIP: (kiosk.config as any)?.printerIP || null,
      surveillance: (kiosk.config as any)?.surveillance || null,
    }));
  }

  /**
   * Get full config for a specific kiosk (for device pairing)
   * Returns kiosk config including surveillance settings
   */
  async getKioskConfigForPairing(kioskId: string): Promise<any | null> {
    const kiosk = await this.kioskRepo.findOne({
      where: { kioskId, isActive: true },
    });

    if (!kiosk) {
      return null;
    }

    return {
      kioskId: kiosk.kioskId,
      name: kiosk.name || kiosk.kioskId,
      storeId: kiosk.storeId,
      apiKey: kiosk.apiKey,
      printerName: (kiosk.config as any)?.printerName || null,
      printerIP: (kiosk.config as any)?.printerIP || null,
      printerTrays: (kiosk.config as any)?.printerTrays || [],
      surveillance: (kiosk.config as any)?.surveillance || {
        enabled: false,
        webcamIndex: 0,
        httpPort: 8765,
        dwellThresholdSeconds: 8,
        frameThreshold: 10,
      },
    };
  }

  /**
   * Get pending print jobs for the local print agent
   * This uses the database instead of in-memory queue for persistence
   */
  async getPendingPrintJobs(): Promise<any[]> {
    const pendingLogs = await this.printLogRepo.find({
      where: { status: PrintStatus.PENDING },
      relations: ['kiosk'],
      order: { createdAt: 'ASC' },
      take: 10, // Limit to 10 jobs at a time
    });

    // Transform to the format expected by local-print-agent.js
    return pendingLogs.map(log => ({
      id: log.id,
      printerName: log.printerName || (log.kiosk?.config as any)?.printerName || null,
      printerIP: (log.kiosk?.config as any)?.printerIP || null,
      paperType: log.paperType || 'greeting-card',
      paperSize: log.paperSize || 'letter',
      trayNumber: log.trayNumber || null,
      pdfUrl: log.pdfUrl || null,
      status: log.status,
      createdAt: log.createdAt?.toISOString(),
      kioskName: log.kiosk?.name || log.kiosk?.kioskId || 'Unknown',
    }));
  }

  /**
   * Update print job status (for local agent)
   */
  async updatePrintJobStatus(
    logId: string,
    status: PrintStatus,
    errorMessage?: string,
  ): Promise<KioskPrintLog> {
    const log = await this.printLogRepo.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    log.status = status;
    if (status === PrintStatus.PROCESSING) {
      log.startedAt = new Date();
    } else if (status === PrintStatus.COMPLETED || status === PrintStatus.FAILED) {
      log.completedAt = new Date();
    }
    if (errorMessage) {
      log.errorMessage = errorMessage;
    }

    return this.printLogRepo.save(log);
  }

  // ==================== Admin Print Log Methods ====================

  /**
   * Get all print logs for a specific kiosk (admin access)
   */
  async getAdminKioskPrintLogs(
    kioskId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: PrintStatus;
      productType?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{ logs: KioskPrintLog[]; total: number }> {
    // Find the kiosk first
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    const where: any = { kioskConfigId: kiosk.id };
    
    if (options.status) {
      where.status = options.status;
    }
    if (options.productType) {
      where.productType = options.productType;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt = MoreThanOrEqual(options.startDate);
      }
      if (options.endDate) {
        where.createdAt = options.startDate 
          ? Between(options.startDate, options.endDate)
          : LessThanOrEqual(options.endDate);
      }
    }

    const [logs, total] = await this.printLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit || 50,
      skip: options.offset || 0,
      relations: ['kiosk'],
    });

    return { logs, total };
  }

  /**
   * Update a print log (admin only)
   */
  async adminUpdatePrintLog(
    logId: string,
    data: { status?: string; errorMessage?: string; notes?: string },
  ): Promise<KioskPrintLog> {
    const log = await this.printLogRepo.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    if (data.status) {
      log.status = data.status as PrintStatus;
      if (data.status === PrintStatus.COMPLETED || data.status === PrintStatus.FAILED) {
        log.completedAt = new Date();
      }
    }
    if (data.errorMessage !== undefined) {
      log.errorMessage = data.errorMessage;
    }
    // Notes could be stored in errorMessage or we can add a field later

    return this.printLogRepo.save(log);
  }

  /**
   * Delete a single print log (admin only)
   */
  async deletePrintLog(logId: string): Promise<{ success: boolean; message: string }> {
    const log = await this.printLogRepo.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException(`Print log with ID ${logId} not found`);
    }

    await this.printLogRepo.remove(log);
    return { success: true, message: 'Print log deleted successfully' };
  }

  /**
   * Bulk delete print logs (admin only)
   */
  async bulkDeletePrintLogs(ids: string[]): Promise<{ success: boolean; deleted: number }> {
    const result = await this.printLogRepo.delete(ids);
    return { success: true, deleted: result.affected || 0 };
  }

  /**
   * Delete print logs for a kiosk within a date range (admin only)
   */
  async deleteKioskPrintLogsInRange(
    kioskId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ success: boolean; deleted: number }> {
    // Find the kiosk first
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    const where: any = { kioskConfigId: kiosk.id };
    
    if (startDate || endDate) {
      if (startDate && endDate) {
        where.createdAt = Between(startDate, endDate);
      } else if (startDate) {
        where.createdAt = MoreThanOrEqual(startDate);
      } else if (endDate) {
        where.createdAt = LessThanOrEqual(endDate);
      }
    }

    const result = await this.printLogRepo.delete(where);
    return { success: true, deleted: result.affected || 0 };
  }
}
