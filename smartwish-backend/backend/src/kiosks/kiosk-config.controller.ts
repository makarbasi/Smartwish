import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { KioskConfigService } from './kiosk-config.service';
import { CreateKioskConfigDto } from './dto/create-kiosk-config.dto';
import { UpdateKioskConfigDto } from './dto/update-kiosk-config.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

// ==================== Public Kiosk Endpoints ====================

@Controller('kiosk-config')
export class KioskConfigPublicController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get kiosk config by kioskId (legacy - requires API key)
   */
  @Public()
  @Get(':kioskId')
  async getConfig(
    @Param('kioskId') kioskId: string,
    @Headers('x-kiosk-key') apiKey?: string,
  ) {
    return this.kioskService.getMergedConfig(kioskId, apiKey);
  }
}

/**
 * Public endpoint for activated kiosks to get config by UUID
 */
@Controller('kiosk')
export class KioskPublicController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get kiosk config by UUID (for activated kiosks)
   * No API key required - kiosk was authenticated during activation
   */
  @Public()
  @Get('config/:id')
  async getConfigById(@Param('id') id: string) {
    return this.kioskService.getConfigById(id);
  }
}

// ==================== Manager Public Endpoints ====================

/**
 * Public endpoints for manager signup, login, etc.
 */
@Controller('managers')
export class ManagersPublicController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Verify manager invitation token
   */
  @Public()
  @Get('verify-invite-token')
  async verifyInviteToken(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return this.kioskService.verifyInviteToken(token);
  }

  /**
   * Complete manager account setup (signup)
   */
  @Public()
  @Post('complete-setup')
  async completeSetup(@Body() body: { token: string; password: string }) {
    if (!body.token || !body.password) {
      throw new BadRequestException('Token and password are required');
    }
    if (body.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    return this.kioskService.completeManagerSetup(body.token, body.password);
  }

  /**
   * Manager login
   */
  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.kioskService.managerLogin(body.email, body.password);
  }

  /**
   * Get kiosks assigned to logged-in manager (uses JWT from header)
   */
  @Get('my-kiosks')
  @UseGuards(JwtAuthGuard)
  async getMyKiosks(@Request() req: any) {
    return this.kioskService.getManagerKiosks(req.user.id);
  }
}

// ==================== Manager Endpoints ====================

@Controller('manager')
@UseGuards(JwtAuthGuard)
export class KioskManagerController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get kiosks assigned to the current manager
   */
  @Get('kiosks')
  async getMyKiosks(@Request() req: any) {
    return this.kioskService.getManagerKiosks(req.user.id);
  }
}

// ==================== Admin Kiosk Endpoints ====================

@Controller('admin/kiosks')
@UseGuards(JwtAuthGuard)
export class KioskConfigAdminController {
  constructor(private readonly kioskService: KioskConfigService) {}

  @Get()
  async list() {
    return this.kioskService.list();
  }

  @Post()
  async create(@Body() dto: CreateKioskConfigDto) {
    return this.kioskService.create(dto);
  }

  @Put(':kioskId')
  async update(
    @Param('kioskId') kioskId: string,
    @Body() dto: UpdateKioskConfigDto,
  ) {
    return this.kioskService.update(kioskId, dto);
  }

  @Post(':kioskId/rotate-key')
  async rotateKey(@Param('kioskId') kioskId: string) {
    return this.kioskService.rotateApiKey(kioskId);
  }

  @Delete(':kioskId')
  async delete(@Param('kioskId') kioskId: string) {
    return this.kioskService.delete(kioskId);
  }

  // ==================== Manager Assignment Endpoints ====================

  /**
   * Get all managers assigned to a kiosk
   */
  @Get(':kioskId/managers')
  async getKioskManagers(@Param('kioskId') kioskId: string) {
    return this.kioskService.getKioskManagers(kioskId);
  }

  /**
   * Assign a manager to a kiosk
   */
  @Post(':kioskId/assign')
  async assignManager(
    @Param('kioskId') kioskId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    return this.kioskService.assignManager(kioskId, body.userId, req.user.id);
  }

  /**
   * Bulk assign managers to a kiosk
   */
  @Post(':kioskId/assign-bulk')
  async bulkAssignManagers(
    @Param('kioskId') kioskId: string,
    @Body() body: { userIds: string[] },
    @Request() req: any,
  ) {
    return this.kioskService.bulkAssignManagers(kioskId, body.userIds, req.user.id);
  }

  /**
   * Unassign a manager from a kiosk
   */
  @Delete(':kioskId/assign/:userId')
  async unassignManager(
    @Param('kioskId') kioskId: string,
    @Param('userId') userId: string,
  ) {
    return this.kioskService.unassignManager(kioskId, userId);
  }
}

// ==================== Admin Manager Endpoints ====================

@Controller('admin/managers')
@UseGuards(JwtAuthGuard)
export class ManagerAdminController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * List all managers
   */
  @Get()
  async listManagers() {
    return this.kioskService.listManagers();
  }

  /**
   * Get a single manager by ID
   */
  @Get(':id')
  async getManager(@Param('id') id: string) {
    return this.kioskService.getManager(id);
  }

  /**
   * Create a new manager (invite via email)
   */
  @Post()
  async createManager(
    @Body() body: { email: string; name: string },
    @Request() req: any,
  ) {
    return this.kioskService.createManager(body.email, body.name, req.user.id);
  }

  /**
   * Delete a manager
   */
  @Delete(':id')
  async deleteManager(@Param('id') id: string) {
    return this.kioskService.deleteManager(id);
  }
}

// ==================== Print Log Endpoints ====================

/**
 * Public endpoint for kiosks to log print jobs
 */
@Controller('kiosk/print-logs')
export class KioskPrintLogController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Create a print log entry (called by kiosk when printing)
   */
  @Public()
  @Post()
  async createPrintLog(
    @Body()
    body: {
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
    },
  ) {
    if (!body.kioskId) {
      throw new BadRequestException('kioskId is required');
    }
    return this.kioskService.createPrintLog(body);
  }

  /**
   * Update print log status (called by print agent or frontend)
   * Also accepts pdfUrl to save for reprint functionality
   */
  @Public()
  @Put(':logId/status')
  async updatePrintLogStatus(
    @Param('logId') logId: string,
    @Body() body: { status: string; errorMessage?: string; pdfUrl?: string },
  ) {
    return this.kioskService.updatePrintLogStatus(
      logId,
      body.status as any,
      body.errorMessage,
      body.pdfUrl,
    );
  }
}

/**
 * Manager endpoints for viewing print logs
 */
@Controller('managers/print-logs')
@UseGuards(JwtAuthGuard)
export class ManagerPrintLogController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get print logs for the authenticated manager's kiosks
   */
  @Get()
  async getMyPrintLogs(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('kioskId') kioskId?: string,
    @Query('status') status?: string,
    @Query('productType') productType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.kioskService.getManagerPrintLogs(req.user.id, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      kioskId,
      status: status as any,
      productType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Get print statistics for the authenticated manager
   */
  @Get('stats')
  async getMyPrintStats(
    @Request() req: any,
    @Query('days') days?: string,
  ) {
    return this.kioskService.getManagerPrintStats(
      req.user.id,
      days ? parseInt(days) : 30,
    );
  }

  /**
   * Get a single print log by ID (manager must have access)
   */
  @Get(':logId')
  async getPrintLog(
    @Param('logId') logId: string,
    @Request() req: any,
  ) {
    return this.kioskService.getManagerPrintLogById(logId, req.user.id);
  }

  /**
   * Reprint a print job (manager action)
   * Sends the stored PDF back to the printer
   */
  @Post(':logId/reprint')
  async reprintJob(
    @Param('logId') logId: string,
    @Request() req: any,
  ) {
    // First verify manager has access
    await this.kioskService.getManagerPrintLogById(logId, req.user.id);
    // Then process reprint
    return this.kioskService.reprintJob(logId, req.user.id);
  }
}

/**
 * Local print agent endpoints - polls for pending jobs from database
 * This is more reliable than the in-memory queue which is lost on server restart
 */
@Controller('local-agent')
export class LocalPrintAgentController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get printer configurations for all kiosks
   * Used by print agent to display configured printers at startup
   */
  @Public()
  @Get('printer-config')
  async getPrinterConfig() {
    return this.kioskService.getAllKioskPrinterConfigs();
  }

  /**
   * Get pending print jobs for local print agent
   * Uses database (persistent) instead of in-memory queue
   */
  @Public()
  @Get('pending-jobs')
  async getPendingJobs() {
    const jobs = await this.kioskService.getPendingPrintJobs();
    return { jobs };
  }

  /**
   * Update job status (called by local agent after printing)
   */
  @Public()
  @Put('jobs/:logId/status')
  async updateJobStatus(
    @Param('logId') logId: string,
    @Body() body: { status: string; error?: string },
  ) {
    return this.kioskService.updatePrintJobStatus(
      logId,
      body.status as any,
      body.error,
    );
  }
}

/**
 * Admin endpoints for managing print logs (refunds, etc.)
 */
@Controller('admin/print-logs')
@UseGuards(JwtAuthGuard)
export class AdminPrintLogController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get a single print log by ID (admin access)
   */
  @Get(':logId')
  async getPrintLog(@Param('logId') logId: string) {
    return this.kioskService.getPrintLogById(logId);
  }

  /**
   * Process a refund for a print job (admin only)
   */
  @Post(':logId/refund')
  async refundJob(
    @Param('logId') logId: string,
    @Body() body: { refundType: 'partial' | 'full'; reason: string },
    @Request() req: any,
  ) {
    if (!body.refundType || !body.reason) {
      throw new BadRequestException('refundType and reason are required');
    }
    return this.kioskService.processRefund(
      logId,
      req.user.id,
      body.refundType,
      body.reason,
    );
  }

  /**
   * Admin can also trigger reprints
   */
  @Post(':logId/reprint')
  async reprintJob(
    @Param('logId') logId: string,
    @Request() req: any,
  ) {
    return this.kioskService.reprintJob(logId, req.user.id);
  }
}
