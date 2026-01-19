import { Injectable, NotFoundException, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as bcrypt from 'bcrypt';
import { KioskConfig } from './kiosk-config.entity';
import { KioskManager } from './kiosk-manager.entity';
import { KioskPrintLog, PrintStatus, RefundStatus, PaymentMethod } from './kiosk-print-log.entity';
import { EarningsService } from '../earnings/earnings.service';
import { KioskPrinter, PrintableType, PrinterStatus, PaperStatus, PrintMode } from './kiosk-printer.entity';
import { KioskAlert, AlertType, AlertSeverity } from './kiosk-alert.entity';
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

// Stripe fee constants for earnings calculation
const STRIPE_FEE_PERCENT = 0.029;
const STRIPE_FEE_FIXED = 0.30;

@Injectable()
export class KioskConfigService {
  constructor(
    @InjectRepository(KioskConfig)
    private readonly kioskRepo: Repository<KioskConfig>,
    @InjectRepository(KioskManager)
    private readonly kioskManagerRepo: Repository<KioskManager>,
    @InjectRepository(KioskPrintLog)
    private readonly printLogRepo: Repository<KioskPrintLog>,
    @InjectRepository(KioskPrinter)
    private readonly printerRepo: Repository<KioskPrinter>,
    @InjectRepository(KioskAlert)
    private readonly alertRepo: Repository<KioskAlert>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly earningsService: EarningsService,
  ) { }

  /**
   * Generate a unique human-readable print code (e.g., "PRT-A1B2C3")
   */
  private generatePrintCode(): string {
    // Use alphanumeric chars excluding confusing ones (0/O, 1/I/l)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'PRT-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Calculate Stripe processing fees
   */
  private calculateStripeFees(amount: number): number {
    return Math.round((amount * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) * 100) / 100;
  }

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
    // Check if input looks like a UUID (simple regex check)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let record: KioskConfig | null = null;
    
    if (isUuid) {
      // Search by UUID
      record = await this.kioskRepo.findOne({ where: { id } });
    }
    
    if (!record) {
      // Fallback: try finding by kioskId (human-readable ID like "PC_KIOSK_2")
      record = await this.kioskRepo.findOne({ where: { kioskId: id } });
    }
    
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
   * Now includes session linking, payment method tracking, and earnings integration
   */
  async createPrintLog(data: {
    kioskId: string;
    kioskSessionId?: string;
    paymentMethod?: PaymentMethod | string;
    promoCodeUsed?: string;
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

    // Generate unique print code
    let printCode: string | undefined;
    try {
      printCode = this.generatePrintCode();
      
      // Ensure uniqueness (retry if collision)
      let retries = 0;
      while (retries < 5) {
        const existing = await this.printLogRepo.findOne({ where: { printCode } });
        if (!existing) break;
        printCode = this.generatePrintCode();
        retries++;
      }
    } catch (err) {
      // If printCode column doesn't exist yet, skip it
      console.warn('[PrintLog] Could not generate print code (column may not exist yet):', err);
      printCode = undefined;
    }

    // Use printerName from request, or fall back to kiosk config
    const printerName = data.printerName || (kiosk.config as any)?.printerName || null;

    // Determine payment method
    const paymentMethod = data.paymentMethod as PaymentMethod || null;

    // Build the print log object - only include new fields if they're provided
    // This allows backward compatibility if the new columns don't exist yet
    const printLogData: Partial<KioskPrintLog> = {
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
    };

    // Add new fields only if printCode was generated (indicates columns exist)
    if (printCode) {
      printLogData.printCode = printCode;
      printLogData.kioskSessionId = data.kioskSessionId || null;
      printLogData.paymentMethod = paymentMethod;
      printLogData.promoCodeUsed = data.promoCodeUsed || null;
      printLogData.commissionProcessed = false;
    }

    const printLog = this.printLogRepo.create(printLogData);

    console.log('[PrintLog] Creating print log for kiosk:', data.kioskId);
    console.log('[PrintLog] Print log data:', JSON.stringify({
      kioskId: data.kioskId,
      productType: data.productType,
      productName: data.productName,
      price: data.price,
      paymentMethod: data.paymentMethod,
      printCode: printCode,
    }));

    let savedLog: KioskPrintLog;
    try {
      const result = await this.printLogRepo.save(printLog);
      savedLog = Array.isArray(result) ? result[0] : result;
      console.log('[PrintLog] ✅ Print log saved successfully:', savedLog.id, savedLog.printCode || '(no print code)');
    } catch (saveError) {
      // If save fails due to new columns, try again without them
      console.error('[PrintLog] ❌ Save failed:', saveError);
      console.warn('[PrintLog] Retrying without new fields...');
      const fallbackData: Partial<KioskPrintLog> = {
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
      };
      const fallbackLog = this.printLogRepo.create(fallbackData);
      const fallbackResult = await this.printLogRepo.save(fallbackLog);
      savedLog = Array.isArray(fallbackResult) ? fallbackResult[0] : fallbackResult;
      console.log('[PrintLog] ✅ Fallback print log saved:', savedLog.id);
    }

    // Process earnings after print log is created (only if new fields exist)
    if (printCode) {
      try {
        await this.processEarningsForPrint(savedLog);
      } catch (earningsError) {
        console.warn('[Earnings] Failed to process earnings (new columns may not exist):', earningsError);
      }
    }

    return savedLog;
  }

  /**
   * Process earnings for a print job
   * Handles different payment methods and product types
   */
  private async processEarningsForPrint(printLog: KioskPrintLog): Promise<void> {
    try {
      const isPromo = printLog.paymentMethod === PaymentMethod.PROMO_CODE;
      const isGiftCardProduct = printLog.productType === 'gift-card' || 
                                printLog.productType === 'generic-gift-card' ||
                                !!printLog.giftCardBrand;
      const price = parseFloat(printLog.price?.toString() || '0');

      // RULE: Gift card purchases = NO commission (pass-through)
      if (isGiftCardProduct) {
        console.log(`[Earnings] Skipping commission for gift card purchase: ${printLog.printCode}`);
        printLog.commissionProcessed = true;
        printLog.earningsLedgerId = null;
        await this.printLogRepo.save(printLog);
        return;
      }

      // RULE: Promo code payments = NO commission but record for tracking
      if (isPromo) {
        console.log(`[Earnings] Recording promo code print (no commission): ${printLog.printCode}`);
        const earning = await this.earningsService.recordPromoCodePrint({
          kioskId: printLog.kioskId,
          printLogId: printLog.id,
          productType: printLog.productType,
          productName: printLog.productName,
          promoCode: printLog.promoCodeUsed || undefined,
        });
        printLog.commissionProcessed = true;
        printLog.earningsLedgerId = earning.id;
        await this.printLogRepo.save(printLog);
        return;
      }

      // RULE: Card payments = Calculate and distribute commissions
      if (printLog.paymentMethod === PaymentMethod.CARD && price > 0) {
        console.log(`[Earnings] Recording card payment with commission: ${printLog.printCode}, $${price}`);
        const processingFees = this.calculateStripeFees(price);
        
        const transactionType = printLog.productType === 'sticker' ? 'sticker' : 'greeting_card';
        
        const earning = await this.earningsService.recordPrintProductSale({
          kioskId: printLog.kioskId,
          orderId: printLog.id,
          printLogId: printLog.id,
          type: transactionType as 'greeting_card' | 'sticker',
          grossAmount: price,
          processingFees,
          stateTax: 0,
          productName: printLog.productName,
          paymentMethod: 'card',
        });
        printLog.commissionProcessed = true;
        printLog.earningsLedgerId = earning.id;
        await this.printLogRepo.save(printLog);
        return;
      }

      // No payment info - mark as processed but no earnings entry
      console.log(`[Earnings] No payment info for print: ${printLog.printCode}`);
      printLog.commissionProcessed = true;
      await this.printLogRepo.save(printLog);
    } catch (error) {
      console.error(`[Earnings] Failed to process earnings for print ${printLog.printCode}:`, error);
      // Don't fail the print log creation, just log the error
    }
  }

  /**
   * Search print logs by various criteria
   */
  async searchPrintLogs(filters: {
    printCode?: string;
    sessionId?: string;
    kioskId?: string;
    paymentMethod?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: KioskPrintLog[]; total: number }> {
    const query = this.printLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.kiosk', 'kiosk')
      .orderBy('log.created_at', 'DESC');

    if (filters.printCode) {
      query.andWhere('log.print_code ILIKE :printCode', { 
        printCode: `%${filters.printCode.toUpperCase()}%` 
      });
    }
    if (filters.sessionId) {
      query.andWhere('log.kiosk_session_id = :sessionId', { sessionId: filters.sessionId });
    }
    if (filters.kioskId) {
      query.andWhere('kiosk.kiosk_id = :kioskId', { kioskId: filters.kioskId });
    }
    if (filters.paymentMethod) {
      query.andWhere('log.payment_method = :paymentMethod', { paymentMethod: filters.paymentMethod });
    }
    if (filters.startDate) {
      query.andWhere('log.created_at >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('log.created_at <= :endDate', { endDate: filters.endDate });
    }

    const total = await query.getCount();

    if (filters.limit) {
      query.limit(filters.limit);
    }
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const logs = await query.getMany();

    return { logs, total };
  }

  /**
   * Get print log by print code (for admin lookup)
   */
  async getPrintLogByCode(printCode: string): Promise<KioskPrintLog | null> {
    return this.printLogRepo.findOne({
      where: { printCode: printCode.toUpperCase() },
      relations: ['kiosk'],
    });
  }

  /**
   * Get all print logs for a session
   */
  async getSessionPrintLogs(sessionId: string): Promise<KioskPrintLog[]> {
    return this.printLogRepo.find({
      where: { kioskSessionId: sessionId },
      relations: ['kiosk'],
      order: { createdAt: 'ASC' },
    });
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

    // Filter out assignments with missing kiosk relations (data integrity check)
    const validAssignments = assignments.filter(a => a.kiosk && a.kioskId);
    
    if (validAssignments.length === 0) {
      return { logs: [], total: 0, kiosks: [] };
    }

    const kioskIds = validAssignments.map(a => a.kioskId).filter(id => id != null);

    if (kioskIds.length === 0) {
      return { logs: [], total: 0, kiosks: [] };
    }

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

    // Get kiosk info for context (with null safety)
    const kiosks = validAssignments
      .filter(a => a.kiosk != null)
      .map(a => ({
        id: a.kiosk!.id,
        kioskId: a.kiosk!.kioskId,
        name: a.kiosk!.name,
        storeId: a.kiosk!.storeId,
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

    // Filter out assignments with missing kiosk relations (data integrity check)
    const validAssignments = assignments.filter(a => a.kiosk && a.kioskId);
    
    if (validAssignments.length === 0) {
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

    const kioskIds = validAssignments.map(a => a.kioskId).filter(id => id != null);
    
    if (kioskIds.length === 0) {
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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Create a map of kiosk ID to revenue share percent
    const kioskShareMap = new Map<string, number>();
    for (const a of validAssignments) {
      if (a.kiosk && a.kioskId) {
        const config = a.kiosk.config as Record<string, any> || {};
        kioskShareMap.set(a.kioskId, config.revenueSharePercent ?? 30);
      }
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

  // ==================== Printer Status ====================

  /**
   * Update printer status for a kiosk
   * Called by the local print agent to report printer health
   */
  async updatePrinterStatus(
    kioskId: string,
    status: {
      timestamp: string;
      online: boolean;
      printerState: string;
      printerIP?: string;
      printerName?: string;
      ink?: Record<string, { level: number; state: string }>;
      paper?: Record<string, { level: number; description: string; state: string }>;
      errors?: Array<{ code: string; message: string; [key: string]: any }>;
      warnings?: Array<{ code: string; message: string; [key: string]: any }>;
      printQueue?: {
        jobCount: number;
        jobs: Array<{ id: number; status: string; name?: string }>;
        hasErrors?: boolean;
      };
    },
  ): Promise<{ success: boolean; kioskId: string }> {
    // Find kiosk by kioskId (the friendly ID, not UUID)
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    // Store printer status in the config
    const config = kiosk.config as Record<string, any> || {};
    config.printerStatus = {
      ...status,
      lastUpdated: new Date().toISOString(),
    };

    // Check if there are critical issues that need immediate attention
    const hasCriticalErrors = status.errors?.some(e => 
      ['no_paper', 'paper_jam', 'no_ink', 'door_open', 'offline'].includes(e.code)
    );

    // Update kiosk record
    kiosk.config = config;
    await this.kioskRepo.save(kiosk);

    // Log status if there are issues
    if (hasCriticalErrors || !status.online) {
      console.log(`[PrinterStatus] ⚠️ Kiosk ${kioskId} printer issue:`, {
        online: status.online,
        errors: status.errors?.map(e => e.code),
      });
    }

    return { success: true, kioskId };
  }

  /**
   * Get printer status for a kiosk
   */
  async getPrinterStatus(kioskId: string): Promise<any | null> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    const config = kiosk.config as Record<string, any> || {};
    return config.printerStatus || null;
  }

  /**
   * Get printer status by kiosk UUID (for frontend polling)
   */
  async getPrinterStatusById(id: string): Promise<any | null> {
    const kiosk = await this.kioskRepo.findOne({ where: { id } });
    if (!kiosk) {
      return null;
    }

    const config = kiosk.config as Record<string, any> || {};
    return config.printerStatus || null;
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
    // Look up printer from kiosk_printers table based on paperType
    const jobs = await Promise.all(
      pendingLogs.map(async (log) => {
        const paperType = log.paperType || 'greeting-card';
        
        // Find the printer configured for this paper type
        let printerName = log.printerName;
        let printerIP = null;
        let printMode: string = paperType === 'greeting-card' ? 'duplexshort' : 'simplex';  // Default based on type
        
        if (log.kioskId) {
          const printer = await this.printerRepo.findOne({
            where: {
              kioskId: log.kioskId,
              printableType: paperType as PrintableType,
              isEnabled: true,
            },
          });
          
          if (printer) {
            printerName = printer.printerName;
            printerIP = printer.ipAddress;
            printMode = printer.printMode;  // Use configured print mode
          } else {
            // Fallback to legacy config if no printer found
            printerName = printerName || (log.kiosk?.config as any)?.printerName || null;
            printerIP = (log.kiosk?.config as any)?.printerIP || null;
          }
        }

        return {
          id: log.id,
          printerName,
          printerIP,
          printMode,  // Include print mode for local agent
          paperType,
          paperSize: log.paperSize || 'letter',
          pdfUrl: log.pdfUrl || null,
          status: log.status,
          createdAt: log.createdAt?.toISOString(),
          kioskName: log.kiosk?.name || log.kiosk?.kioskId || 'Unknown',
          kioskId: log.kiosk?.kioskId || null,
        };
      }),
    );

    return jobs;
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
  /**
   * Get print logs for admin view (uses kioskId, not kioskConfigId)
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

    // Use kioskId property to match KioskPrintLog entity
    const where: any = { kioskId: kiosk.id };
    
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
  /**
   * Delete print logs within a date range for a kiosk (uses kioskId, not kioskConfigId)
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

    // Use kioskId property to match KioskPrintLog entity
    const where: any = { kioskId: kiosk.id };
    
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

  // ==================== Printer Management ====================

  /**
   * Get all printers for a kiosk
   */
  async getKioskPrinters(kioskId: string): Promise<KioskPrinter[]> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    return this.printerRepo.find({
      where: { kioskId: kiosk.id },
      order: { printableType: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Add a printer to a kiosk
   */
  async addPrinter(
    kioskId: string,
    data: { name: string; printerName: string; ipAddress?: string; printableType: string; isEnabled?: boolean; printMode?: string },
  ): Promise<KioskPrinter> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    // Check if a printer with the same printable type already exists
    const existingPrinter = await this.printerRepo.findOne({
      where: { kioskId: kiosk.id, printableType: data.printableType as PrintableType },
    });
    if (existingPrinter) {
      throw new ConflictException(`A printer for ${data.printableType} already exists on this kiosk`);
    }

    // Default print mode based on printable type
    // greeting-card: duplex short edge (for folded cards)
    // sticker: simplex (single-sided on plain paper)
    const defaultPrintMode = data.printableType === 'greeting-card' ? PrintMode.DUPLEX_SHORT : PrintMode.SIMPLEX;

    const printer = this.printerRepo.create({
      kioskId: kiosk.id,
      name: data.name,
      printerName: data.printerName,
      ipAddress: data.ipAddress || null,
      printableType: data.printableType as PrintableType,
      isEnabled: data.isEnabled ?? true,
      printMode: (data.printMode as PrintMode) || defaultPrintMode,
      status: PrinterStatus.UNKNOWN,
      paperStatus: PaperStatus.UNKNOWN,
    });

    return this.printerRepo.save(printer);
  }

  /**
   * Update a printer
   */
  async updatePrinter(
    kioskId: string,
    printerId: string,
    data: { name?: string; printerName?: string; ipAddress?: string; printableType?: string; isEnabled?: boolean; printMode?: string },
  ): Promise<KioskPrinter> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    const printer = await this.printerRepo.findOne({
      where: { id: printerId, kioskId: kiosk.id },
    });
    if (!printer) {
      throw new NotFoundException(`Printer with ID ${printerId} not found`);
    }

    // If changing printable type, check for conflicts
    if (data.printableType && data.printableType !== printer.printableType) {
      const existingPrinter = await this.printerRepo.findOne({
        where: { kioskId: kiosk.id, printableType: data.printableType as PrintableType },
      });
      if (existingPrinter && existingPrinter.id !== printerId) {
        throw new ConflictException(`A printer for ${data.printableType} already exists on this kiosk`);
      }
    }

    // Update fields
    if (data.name !== undefined) printer.name = data.name;
    if (data.printerName !== undefined) printer.printerName = data.printerName;
    if (data.ipAddress !== undefined) printer.ipAddress = data.ipAddress || null;
    if (data.printableType !== undefined) printer.printableType = data.printableType as PrintableType;
    if (data.isEnabled !== undefined) printer.isEnabled = data.isEnabled;
    if (data.printMode !== undefined) printer.printMode = data.printMode as PrintMode;

    return this.printerRepo.save(printer);
  }

  /**
   * Delete a printer
   */
  async deletePrinter(kioskId: string, printerId: string): Promise<{ success: boolean }> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    const printer = await this.printerRepo.findOne({
      where: { id: printerId, kioskId: kiosk.id },
    });
    if (!printer) {
      throw new NotFoundException(`Printer with ID ${printerId} not found`);
    }

    await this.printerRepo.remove(printer);
    return { success: true };
  }

  /**
   * Get printer by kiosk and printable type
   * Used when creating print jobs to find the right printer
   */
  async getPrinterForType(kioskId: string, printableType: string): Promise<KioskPrinter | null> {
    // kioskId here is the UUID (id field), not the kioskId string
    const printer = await this.printerRepo.findOne({
      where: {
        kioskId,
        printableType: printableType as PrintableType,
        isEnabled: true,
      },
    });
    return printer || null;
  }

  /**
   * Update printer status (called by local print agent)
   */
  async updateMultiplePrinterStatuses(
    kioskId: string,
    printers: Array<{
      printerId: string;
      online: boolean;
      printerState?: string;
      lastError?: string;
      ink?: { black?: { level: number }; cyan?: { level: number }; magenta?: { level: number }; yellow?: { level: number } };
      paper?: Record<string, { state: string }>;
      errors?: Array<{ code: string; message: string }>;
      warnings?: Array<{ code: string; message: string }>;
      fullStatus?: Record<string, any>;
    }>,
  ): Promise<{ success: boolean; updated: number }> {
    let updated = 0;

    for (const printerStatus of printers) {
      const printer = await this.printerRepo.findOne({
        where: { id: printerStatus.printerId },
        relations: ['kiosk'],
      });

      if (!printer) continue;

      // Update status
      printer.status = printerStatus.online ? PrinterStatus.ONLINE : PrinterStatus.OFFLINE;
      printer.lastSeenAt = new Date();
      printer.lastError = printerStatus.lastError || null;

      // Update ink levels
      if (printerStatus.ink) {
        printer.inkBlack = printerStatus.ink.black?.level ?? printer.inkBlack;
        printer.inkCyan = printerStatus.ink.cyan?.level ?? printer.inkCyan;
        printer.inkMagenta = printerStatus.ink.magenta?.level ?? printer.inkMagenta;
        printer.inkYellow = printerStatus.ink.yellow?.level ?? printer.inkYellow;
      }

      // Update paper status (simplified - take worst state)
      // First check errors/warnings arrays for paper issues (most reliable)
      const hasPaperEmptyError = printerStatus.errors?.some(e => e.code === 'paper_empty' || (e.message?.toLowerCase().includes('paper') && e.message?.toLowerCase().includes('empty')));
      const hasPaperLowWarning = printerStatus.warnings?.some(w => w.code === 'paper_low' || (w.message?.toLowerCase().includes('paper') && w.message?.toLowerCase().includes('low')));

      if (printerStatus.paper) {
        const states = Object.values(printerStatus.paper).map(p => p.state);
        if (states.includes('empty') || hasPaperEmptyError) {
          printer.paperStatus = PaperStatus.EMPTY;
        } else if (states.includes('low') || hasPaperLowWarning) {
          printer.paperStatus = PaperStatus.LOW;
        } else if (states.includes('ok') && !hasPaperEmptyError && !hasPaperLowWarning) {
          printer.paperStatus = PaperStatus.OK;
        } else if (!hasPaperEmptyError && !hasPaperLowWarning) {
          // If no errors/warnings, assume OK even if states are unknown
          printer.paperStatus = PaperStatus.OK;
        } else {
          printer.paperStatus = PaperStatus.UNKNOWN;
        }

        // Store individual tray states
        const trayKeys = Object.keys(printerStatus.paper);
        if (trayKeys.includes('tray1')) {
          printer.paperTray1State = printerStatus.paper['tray1'].state;
        }
        if (trayKeys.includes('tray2')) {
          printer.paperTray2State = printerStatus.paper['tray2'].state;
        }
      } else if (hasPaperEmptyError) {
        // If no paper object but we have paper errors, set status to EMPTY
        printer.paperStatus = PaperStatus.EMPTY;
      } else if (hasPaperLowWarning) {
        // If no paper object but we have paper warnings, set status to LOW
        printer.paperStatus = PaperStatus.LOW;
      } else if (!hasPaperEmptyError && !hasPaperLowWarning) {
        // If no paper object and no errors/warnings, assume OK
        printer.paperStatus = PaperStatus.OK;
      }

      // Store full status for detailed view
      if (printerStatus.fullStatus) {
        printer.fullStatus = printerStatus.fullStatus;
      }

      await this.printerRepo.save(printer);
      updated++;

      // Create alerts for issues
      await this.handlePrinterAlerts(printer, printerStatus);
    }

    return { success: true, updated };
  }

  /**
   * Handle alert creation/resolution based on printer status
   */
  private async handlePrinterAlerts(
    printer: KioskPrinter,
    status: { online: boolean; errors?: Array<{ code: string; message: string }>; warnings?: Array<{ code: string; message: string }> },
  ): Promise<void> {
    // Check for offline alert
    if (!status.online) {
      await this.createOrUpdateAlert(
        printer.kioskId,
        printer.id,
        AlertType.PRINTER_OFFLINE,
        `${printer.name} is offline`,
        AlertSeverity.ERROR,
      );
    } else {
      // Auto-resolve offline alert if printer is back online
      await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.PRINTER_OFFLINE);
    }

    // Check for ink alerts
    const inkLevels = { black: printer.inkBlack, cyan: printer.inkCyan, magenta: printer.inkMagenta, yellow: printer.inkYellow };
    for (const [color, level] of Object.entries(inkLevels)) {
      if (level !== null && level !== undefined) {
        if (level === 0) {
          await this.createOrUpdateAlert(
            printer.kioskId,
            printer.id,
            AlertType.INK_EMPTY,
            `${printer.name}: ${color} ink is empty`,
            AlertSeverity.CRITICAL,
            { color, level },
          );
        } else if (level < 20) {
          await this.createOrUpdateAlert(
            printer.kioskId,
            printer.id,
            AlertType.INK_LOW,
            `${printer.name}: ${color} ink is low (${level}%)`,
            AlertSeverity.WARNING,
            { color, level },
          );
        } else {
          // Auto-resolve if ink is OK now
          await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.INK_LOW, { color });
          await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.INK_EMPTY, { color });
        }
      }
    }

    // Check for paper alerts - first check errors/warnings arrays (most reliable)
    const hasPaperEmptyError = status.errors?.some(e => e.code === 'paper_empty' || (e.message?.toLowerCase().includes('paper') && e.message?.toLowerCase().includes('empty')));
    const hasPaperLowWarning = status.warnings?.some(w => w.code === 'paper_low' || (w.message?.toLowerCase().includes('paper') && w.message?.toLowerCase().includes('low')));

    if (hasPaperEmptyError || printer.paperStatus === PaperStatus.EMPTY) {
      // Use the error message if available, otherwise use default
      const errorMsg = status.errors?.find(e => e.code === 'paper_empty' || (e.message?.toLowerCase().includes('paper') && e.message?.toLowerCase().includes('empty')))?.message;
      const message = errorMsg ? `${printer.name}: ${errorMsg}` : `${printer.name}: Paper tray is empty`;
      
      await this.createOrUpdateAlert(
        printer.kioskId,
        printer.id,
        AlertType.PAPER_EMPTY,
        message,
        AlertSeverity.CRITICAL,
      );
    } else if (hasPaperLowWarning || printer.paperStatus === PaperStatus.LOW) {
      // Use the warning message if available, otherwise use default
      const warningMsg = status.warnings?.find(w => w.code === 'paper_low' || (w.message?.toLowerCase().includes('paper') && w.message?.toLowerCase().includes('low')))?.message;
      const message = warningMsg ? `${printer.name}: ${warningMsg}` : `${printer.name}: Paper is low`;
      
      await this.createOrUpdateAlert(
        printer.kioskId,
        printer.id,
        AlertType.PAPER_LOW,
        message,
        AlertSeverity.WARNING,
      );
    } else {
      // Auto-resolve paper alerts if:
      // 1. There are no paper errors AND no paper warnings in the status (most reliable check)
      // 2. OR paper status is OK
      // This ensures alerts are resolved even if paperStatus field wasn't updated correctly
      if (!hasPaperEmptyError && !hasPaperLowWarning) {
        await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.PAPER_LOW);
        await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.PAPER_EMPTY);
      } else if (printer.paperStatus === PaperStatus.OK) {
        // Also resolve if paper status is explicitly OK (backup check)
        await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.PAPER_LOW);
        await this.autoResolveAlerts(printer.kioskId, printer.id, AlertType.PAPER_EMPTY);
      }
    }
  }

  /**
   * Create or update an alert (avoid duplicates)
   */
  private async createOrUpdateAlert(
    kioskId: string,
    printerId: string | null,
    alertType: AlertType,
    message: string,
    severity: AlertSeverity,
    metadata: Record<string, any> = {},
  ): Promise<KioskAlert> {
    // Check if an unresolved alert of this type already exists
    const existingWhere: any = {
      kioskId,
      alertType,
      resolvedAt: IsNull(),
    };
    if (printerId) existingWhere.printerId = printerId;

    const existing = await this.alertRepo.findOne({ where: existingWhere });

    if (existing) {
      // Update the existing alert
      existing.message = message;
      existing.severity = severity;
      existing.metadata = { ...existing.metadata, ...metadata };
      return this.alertRepo.save(existing);
    }

    // Create new alert
    const alert = this.alertRepo.create({
      kioskId,
      printerId,
      alertType,
      message,
      severity,
      metadata,
    });

    return this.alertRepo.save(alert);
  }

  /**
   * Auto-resolve alerts when issue is fixed
   */
  private async autoResolveAlerts(
    kioskId: string,
    printerId: string | null,
    alertType: AlertType,
    metadataMatch?: Record<string, any>,
  ): Promise<void> {
    const whereClause: any = {
      kioskId,
      alertType,
      resolvedAt: IsNull(),
    };
    
    // IMPORTANT: For paper alerts, we want to resolve ALL alerts for this kiosk of this type
    // regardless of which printer they're associated with. This handles cases where:
    // 1. Alerts were created before the multi-printer system existed
    // 2. Printer configuration changed but old alerts remain
    // For ink alerts, we still filter by printer since different printers have different ink
    if (printerId && alertType !== AlertType.PAPER_EMPTY && alertType !== AlertType.PAPER_LOW) {
      whereClause.printerId = printerId;
    }

    const alerts = await this.alertRepo.find({ where: whereClause });

    for (const alert of alerts) {
      // If metadataMatch is provided, only resolve if metadata matches
      if (metadataMatch) {
        const matches = Object.entries(metadataMatch).every(
          ([key, value]) => alert.metadata[key] === value,
        );
        if (!matches) continue;
      }

      alert.resolvedAt = new Date();
      alert.autoResolved = true;
      await this.alertRepo.save(alert);
    }
  }

  /**
   * Get alerts for a kiosk
   */
  async getKioskAlerts(kioskId: string, includeResolved: boolean = false): Promise<KioskAlert[]> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException(`Kiosk with ID ${kioskId} not found`);
    }

    const where: any = { kioskId: kiosk.id };
    if (!includeResolved) {
      where.resolvedAt = IsNull();
    }

    return this.alertRepo.find({
      where,
      relations: ['printer'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<KioskAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    return this.alertRepo.save(alert);
  }

  /**
   * Get all active alerts (for admin dashboard)
   */
  async getAllActiveAlerts(): Promise<KioskAlert[]> {
    return this.alertRepo.find({
      where: { resolvedAt: IsNull() },
      relations: ['kiosk', 'printer'],
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get all printers with their status (for local agent startup)
   */
  async getAllKioskPrintersWithConfig(kioskIdString: string): Promise<any[]> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId: kioskIdString } });
    if (!kiosk) {
      return [];
    }

    const printers = await this.printerRepo.find({
      where: { kioskId: kiosk.id, isEnabled: true },
    });

    return printers.map(p => ({
      id: p.id,
      name: p.name,
      printerName: p.printerName,
      ipAddress: p.ipAddress,
      printableType: p.printableType,
      printMode: p.printMode,  // Include print mode for local agent
      status: p.status,
    }));
  }

  // ==================== Real-Time Status Endpoints ====================

  /**
   * Get all printer statuses across all kiosks (for admin dashboard)
   * Optimized for frequent polling - returns only essential data
   */
  async getAllPrinterStatuses(): Promise<any[]> {
    const kiosks = await this.kioskRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const results = await Promise.all(
      kiosks.map(async (kiosk) => {
        // Get printers for this kiosk
        const printers = await this.printerRepo.find({
          where: { kioskId: kiosk.id },
          order: { printableType: 'ASC' },
        });

        // Get active alerts for this kiosk
        const alerts = await this.alertRepo.find({
          where: { kioskId: kiosk.id, resolvedAt: IsNull() },
          order: { severity: 'DESC' },
        });

        return {
          kioskId: kiosk.kioskId,
          kioskName: kiosk.name || kiosk.kioskId,
          storeId: kiosk.storeId,
          printers: printers.map(p => ({
            id: p.id,
            name: p.name,
            printableType: p.printableType,
            status: p.status,
            paperStatus: p.paperStatus,
            inkBlack: p.inkBlack,
            inkCyan: p.inkCyan,
            inkMagenta: p.inkMagenta,
            inkYellow: p.inkYellow,
            lastSeenAt: p.lastSeenAt,
            lastError: p.lastError,
          })),
          alerts: alerts.map(a => ({
            id: a.id,
            alertType: a.alertType,
            message: a.message,
            severity: a.severity,
            createdAt: a.createdAt,
          })),
          alertCount: alerts.length,
          hasErrors: alerts.some(a => a.severity === 'critical' || a.severity === 'error'),
        };
      }),
    );

    return results;
  }

  /**
   * Get critical alerts that need immediate attention
   * Used for SSE broadcasting
   */
  async getCriticalAlerts(): Promise<any[]> {
    const alerts = await this.alertRepo.find({
      where: [
        { severity: 'critical' as AlertSeverity, resolvedAt: IsNull() },
        { severity: 'error' as AlertSeverity, resolvedAt: IsNull() },
      ],
      relations: ['kiosk', 'printer'],
      order: { createdAt: 'DESC' },
      take: 50, // Limit to recent alerts
    });

    return alerts.map(a => ({
      id: a.id,
      kioskId: a.kiosk?.kioskId,
      kioskName: a.kiosk?.name || a.kiosk?.kioskId,
      printerId: a.printerId,
      printerName: a.printer?.name,
      alertType: a.alertType,
      message: a.message,
      severity: a.severity,
      createdAt: a.createdAt,
    }));
  }
}
