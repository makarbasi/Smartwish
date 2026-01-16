import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { SalesRepresentative } from './sales-representative.entity';
import { User, UserRole, UserStatus, OAuthProvider } from '../user/user.entity';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { EarningsLedger } from '../earnings/earnings-ledger.entity';
import {
  CreateSalesRepresentativeDto,
  UpdateSalesRepresentativeDto,
} from './dto/create-sales-representative.dto';

@Injectable()
export class SalesRepresentativesService {
  constructor(
    @InjectRepository(SalesRepresentative)
    private readonly salesRepRepo: Repository<SalesRepresentative>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(KioskConfig)
    private readonly kioskRepo: Repository<KioskConfig>,
    @InjectRepository(EarningsLedger)
    private readonly earningsRepo: Repository<EarningsLedger>,
  ) {}

  /**
   * List all sales representatives
   */
  async list(): Promise<any[]> {
    const reps = await this.salesRepRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    // Get assigned kiosk counts for each rep
    const repsWithCounts = await Promise.all(
      reps.map(async (rep) => {
        const kioskCount = await this.kioskRepo.count({
          where: { salesRepresentativeId: rep.id },
        });
        return { ...rep, assignedKiosksCount: kioskCount };
      }),
    );

    return repsWithCounts;
  }

  /**
   * Get a sales representative by ID
   */
  async getById(id: string): Promise<any> {
    const rep = await this.salesRepRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!rep) {
      throw new NotFoundException('Sales representative not found');
    }

    // Get assigned kiosks
    const assignedKiosks = await this.kioskRepo.find({
      where: { salesRepresentativeId: id },
    });

    return {
      ...rep,
      assignedKiosks: assignedKiosks.map((k) => ({
        id: k.id,
        kioskId: k.kioskId,
        name: k.name,
        storeId: k.storeId,
      })),
    };
  }

  /**
   * Create a new sales representative (with optional user account)
   */
  async create(
    dto: CreateSalesRepresentativeDto,
    adminId: string,
  ): Promise<any> {
    // Check if email already exists
    const existingSalesRep = await this.salesRepRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingSalesRep) {
      throw new ConflictException('A sales representative with this email already exists');
    }

    // Check if user already exists
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    let userId: string | null = null;
    let inviteToken: string | undefined;
    let inviteExpiresAt: Date | undefined;
    let emailSent = false;

    if (existingUser) {
      // Link to existing user if they're not already a manager/admin
      if (existingUser.role === UserRole.ADMIN || existingUser.role === UserRole.MANAGER) {
        throw new ConflictException('This email belongs to an admin or manager account');
      }
      userId = existingUser.id;
    } else {
      // Create new user account for login
      inviteToken = crypto.randomBytes(32).toString('hex');
      inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const newUser = this.userRepo.create({
        email: dto.email.toLowerCase(),
        name: `${dto.firstName} ${dto.lastName}`,
        role: UserRole.USER, // Will be used with sales_rep record for authorization
        status: UserStatus.PENDING_VERIFICATION,
        oauthProvider: OAuthProvider.LOCAL,
        isEmailVerified: false,
        isPhoneVerified: false,
        emailVerificationToken: inviteToken,
        emailVerificationExpires: inviteExpiresAt,
        loginAttempts: 0,
      });

      const savedUser = await this.userRepo.save(newUser);
      userId = savedUser.id;

      // Send invitation email
      emailSent = await this.sendInviteEmail(
        dto.email,
        `${dto.firstName} ${dto.lastName}`,
        inviteToken,
        inviteExpiresAt,
      );
    }

    // Create sales representative record
    const salesRep = this.salesRepRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      commissionPercent: dto.commissionPercent ?? 10.0,
      userId,
      createdBy: adminId,
      isActive: true,
    });

    const saved = await this.salesRepRepo.save(salesRep);

    return {
      ...saved,
      inviteToken,
      inviteExpiresAt,
      emailSent,
    };
  }

  /**
   * Update a sales representative
   */
  async update(
    id: string,
    dto: UpdateSalesRepresentativeDto,
  ): Promise<SalesRepresentative> {
    const rep = await this.salesRepRepo.findOne({ where: { id } });
    if (!rep) {
      throw new NotFoundException('Sales representative not found');
    }

    if (dto.firstName !== undefined) rep.firstName = dto.firstName;
    if (dto.lastName !== undefined) rep.lastName = dto.lastName;
    if (dto.phone !== undefined) rep.phone = dto.phone;
    if (dto.commissionPercent !== undefined) rep.commissionPercent = dto.commissionPercent;
    if (dto.isActive !== undefined) rep.isActive = dto.isActive;

    return this.salesRepRepo.save(rep);
  }

  /**
   * Delete (deactivate) a sales representative
   */
  async delete(id: string): Promise<{ success: boolean }> {
    const rep = await this.salesRepRepo.findOne({ where: { id } });
    if (!rep) {
      throw new NotFoundException('Sales representative not found');
    }

    // Unassign from all kiosks
    await this.kioskRepo.update(
      { salesRepresentativeId: id },
      { salesRepresentativeId: null },
    );

    // Soft delete - just deactivate
    rep.isActive = false;
    await this.salesRepRepo.save(rep);

    return { success: true };
  }

  /**
   * Permanently delete a sales representative
   */
  async hardDelete(id: string): Promise<{ success: boolean }> {
    const rep = await this.salesRepRepo.findOne({ where: { id } });
    if (!rep) {
      throw new NotFoundException('Sales representative not found');
    }

    // Unassign from all kiosks first
    await this.kioskRepo.update(
      { salesRepresentativeId: id },
      { salesRepresentativeId: null },
    );

    await this.salesRepRepo.remove(rep);
    return { success: true };
  }

  /**
   * Assign sales representative to a kiosk
   */
  async assignToKiosk(salesRepId: string, kioskId: string): Promise<KioskConfig> {
    const rep = await this.salesRepRepo.findOne({ where: { id: salesRepId } });
    if (!rep) {
      throw new NotFoundException('Sales representative not found');
    }

    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException('Kiosk not found');
    }

    kiosk.salesRepresentativeId = salesRepId;
    return this.kioskRepo.save(kiosk);
  }

  /**
   * Unassign sales representative from a kiosk
   */
  async unassignFromKiosk(kioskId: string): Promise<KioskConfig> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      throw new NotFoundException('Kiosk not found');
    }

    kiosk.salesRepresentativeId = null;
    return this.kioskRepo.save(kiosk);
  }

  /**
   * Get kiosks assigned to a sales representative
   */
  async getAssignedKiosks(salesRepId: string): Promise<KioskConfig[]> {
    return this.kioskRepo.find({
      where: { salesRepresentativeId: salesRepId },
    });
  }

  /**
   * Get earnings for a sales representative
   */
  async getEarnings(
    salesRepId: string,
    filters?: {
      kioskId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    transactions: any[];
    totalEarnings: number;
    earningsByKiosk: any[];
    total: number;
  }> {
    const rep = await this.salesRepRepo.findOne({ where: { id: salesRepId } });
    if (!rep) {
      throw new NotFoundException('Sales representative not found');
    }

    let query = this.earningsRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.kiosk', 'kiosk')
      .where('e.sales_rep_id = :salesRepId', { salesRepId })
      .orderBy('e.transaction_date', 'DESC');

    if (filters?.kioskId) {
      query = query.andWhere('kiosk.kiosk_id = :kioskId', { kioskId: filters.kioskId });
    }
    if (filters?.startDate) {
      query = query.andWhere('e.transaction_date >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query = query.andWhere('e.transaction_date <= :endDate', { endDate: filters.endDate });
    }

    const total = await query.getCount();

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const earnings = await query.getMany();

    // Calculate totals
    const totalEarnings = earnings.reduce(
      (sum, e) => sum + parseFloat(e.salesRepEarnings?.toString() || '0'),
      0,
    );

    // Group by kiosk
    const kioskMap = new Map<string, { kioskId: string; kioskName: string; total: number; count: number }>();
    for (const e of earnings) {
      const kioskKey = e.kioskId;
      const existing = kioskMap.get(kioskKey);
      if (existing) {
        existing.total += parseFloat(e.salesRepEarnings?.toString() || '0');
        existing.count += 1;
      } else {
        kioskMap.set(kioskKey, {
          kioskId: e.kiosk?.kioskId || kioskKey,
          kioskName: e.kiosk?.name || 'Unknown',
          total: parseFloat(e.salesRepEarnings?.toString() || '0'),
          count: 1,
        });
      }
    }

    return {
      transactions: earnings.map((e) => ({
        id: e.id,
        date: e.transactionDate,
        kioskName: e.kiosk?.name || 'Unknown',
        kioskId: e.kiosk?.kioskId,
        productType: e.transactionType,
        productName: e.productName,
        yourEarnings: parseFloat(e.salesRepEarnings?.toString() || '0'),
        // Don't expose: gross_amount, smartwish_earnings, manager_earnings
      })),
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      earningsByKiosk: Array.from(kioskMap.values()),
      total,
    };
  }

  /**
   * Get sales rep by user ID (for auth)
   */
  async getByUserId(userId: string): Promise<SalesRepresentative | null> {
    return this.salesRepRepo.findOne({
      where: { userId },
    });
  }

  /**
   * Sales rep login
   */
  async salesRepLogin(email: string, password: string): Promise<{ salesRep: SalesRepresentative; user: User }> {
    // Find user
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Account is not active');
    }

    if (!user.password) {
      throw new BadRequestException('Password not set. Please complete account setup.');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new BadRequestException('Invalid email or password');
    }

    // Find sales rep record
    const salesRep = await this.salesRepRepo.findOne({
      where: { userId: user.id },
    });

    if (!salesRep) {
      throw new BadRequestException('No sales representative account found');
    }

    if (!salesRep.isActive) {
      throw new BadRequestException('Sales representative account is deactivated');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    return { salesRep, user };
  }

  /**
   * Send invitation email
   */
  private async sendInviteEmail(
    email: string,
    name: string,
    token: string,
    expiresAt: Date,
  ): Promise<boolean> {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Email configuration missing');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://app.smartwish.us';
      const setupUrl = `${frontendUrl}/sales-rep/signup?token=${token}`;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'You have been invited to join SmartWish as a Sales Representative',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0;">SmartWish</h1>
              <p style="margin: 10px 0 0 0;">Sales Representative Portal</p>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2>Welcome, ${name}!</h2>
              <p>You have been invited to become a Sales Representative for SmartWish kiosks.</p>
              <p>As a sales representative, you'll earn commissions on sales from kiosks assigned to you.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${setupUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Set Up Your Account
                </a>
              </div>
              <p style="color: #999; font-size: 12px;">
                This link expires on ${expiresAt.toLocaleDateString()}.
              </p>
            </div>
          </div>
        `,
      });

      return true;
    } catch (error) {
      console.error('Error sending sales rep invite email:', error);
      return false;
    }
  }
}
