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
  Res,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, interval, map, startWith } from 'rxjs';
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

  /**
   * Update printer status (called by local print agent)
   * Stores printer health data for display on kiosk UI
   */
  @Public()
  @Post('printer-status')
  async updatePrinterStatus(
    @Body()
    body: {
      kioskId: string;
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
      };
    },
  ) {
    if (!body.kioskId || !body.status) {
      throw new BadRequestException('kioskId and status are required');
    }
    return this.kioskService.updatePrinterStatus(body.kioskId, body.status);
  }

  /**
   * Get printer status by kiosk UUID (for frontend polling)
   */
  @Public()
  @Get('printer-status/:id')
  async getPrinterStatus(@Param('id') id: string) {
    const status = await this.kioskService.getPrinterStatusById(id);
    return { status };
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

  /**
   * Get all printer statuses across all kiosks
   * Optimized endpoint for admin dashboard polling
   */
  @Get('all-printer-statuses')
  async getAllPrinterStatuses() {
    return this.kioskService.getAllPrinterStatuses();
  }

  /**
   * Get all critical alerts that need attention
   */
  @Get('critical-alerts')
  async getCriticalAlerts() {
    return this.kioskService.getCriticalAlerts();
  }

  /**
   * Get a single kiosk by kioskId
   * NOTE: This must come AFTER specific routes like all-printer-statuses
   */
  @Get(':kioskId')
  async getKiosk(@Param('kioskId') kioskId: string) {
    return this.kioskService.getByKioskId(kioskId);
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
   * Now supports session linking and payment method tracking
   */
  @Public()
  @Post()
  async createPrintLog(
    @Body()
    body: {
      kioskId: string;
      kioskSessionId?: string;
      paymentMethod?: string;
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

  /**
   * Get print log by print code (public for receipt lookup)
   */
  @Public()
  @Get('by-code/:printCode')
  async getPrintLogByCode(@Param('printCode') printCode: string) {
    const log = await this.kioskService.getPrintLogByCode(printCode);
    if (!log) {
      throw new BadRequestException('Print log not found');
    }
    return log;
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

  /**
   * Get kiosk config for device pairing
   * Used by local print agent when paired via manager dashboard
   */
  @Public()
  @Get('kiosk-config/:kioskId')
  async getKioskConfigForPairing(@Param('kioskId') kioskId: string) {
    const config = await this.kioskService.getKioskConfigForPairing(kioskId);
    if (!config) {
      return { error: 'Kiosk not found' };
    }
    return config;
  }

  /**
   * Get printers configured for a kiosk (for local agent)
   */
  @Public()
  @Get('kiosk-printers/:kioskId')
  async getKioskPrintersForAgent(@Param('kioskId') kioskId: string) {
    const printers = await this.kioskService.getAllKioskPrintersWithConfig(kioskId);
    return { printers };
  }

  /**
   * Update status for multiple printers (called by local agent)
   */
  @Public()
  @Put('printer-status')
  async updatePrinterStatus(
    @Body() body: {
      kioskId: string;
      apiKey?: string;
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
      }>;
    },
  ) {
    if (!body.kioskId || !body.printers) {
      throw new BadRequestException('kioskId and printers are required');
    }
    return this.kioskService.updateMultiplePrinterStatuses(body.kioskId, body.printers);
  }
}

/**
 * Admin endpoints for managing print logs (refunds, search, etc.)
 */
@Controller('admin/print-logs')
@UseGuards(JwtAuthGuard)
export class AdminPrintLogController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Search print logs by various criteria (print code, session, kiosk, payment method)
   */
  @Get('search')
  async searchPrintLogs(
    @Query('printCode') printCode?: string,
    @Query('sessionId') sessionId?: string,
    @Query('kioskId') kioskId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.kioskService.searchPrintLogs({
      printCode,
      sessionId,
      kioskId,
      paymentMethod,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * Get print log by unique print code (e.g., PRT-A1B2C3)
   */
  @Get('by-code/:printCode')
  async getPrintLogByCode(@Param('printCode') printCode: string) {
    const log = await this.kioskService.getPrintLogByCode(printCode);
    if (!log) {
      throw new BadRequestException('Print log not found');
    }
    return log;
  }

  /**
   * Get all print logs for a session
   */
  @Get('by-session/:sessionId')
  async getSessionPrintLogs(@Param('sessionId') sessionId: string) {
    return this.kioskService.getSessionPrintLogs(sessionId);
  }

  /**
   * Get all print logs for a specific kiosk (admin access)
   */
  @Get('kiosk/:kioskId')
  async getKioskPrintLogs(
    @Param('kioskId') kioskId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('productType') productType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.kioskService.getAdminKioskPrintLogs(kioskId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      status: status as any,
      productType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

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

  /**
   * Update print log status (admin only)
   */
  @Put(':logId')
  async updatePrintLog(
    @Param('logId') logId: string,
    @Body() body: { status?: string; errorMessage?: string; notes?: string },
  ) {
    return this.kioskService.adminUpdatePrintLog(logId, body);
  }

  /**
   * Delete a single print log (admin only)
   */
  @Delete(':logId')
  async deletePrintLog(@Param('logId') logId: string) {
    return this.kioskService.deletePrintLog(logId);
  }

  /**
   * Bulk delete print logs (admin only)
   */
  @Delete('bulk/delete')
  async bulkDeletePrintLogs(@Body() body: { ids: string[] }) {
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids array is required');
    }
    return this.kioskService.bulkDeletePrintLogs(body.ids);
  }

  /**
   * Delete all print logs for a kiosk within a date range (admin only)
   */
  @Delete('kiosk/:kioskId/range')
  async deleteKioskPrintLogsInRange(
    @Param('kioskId') kioskId: string,
    @Body() body: { startDate?: string; endDate?: string },
  ) {
    return this.kioskService.deleteKioskPrintLogsInRange(
      kioskId,
      body.startDate ? new Date(body.startDate) : undefined,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }
}

// ==================== Kiosk Printer Management ====================

/**
 * Admin endpoints for managing printers per kiosk
 */
@Controller('admin/kiosks')
@UseGuards(JwtAuthGuard)
export class KioskPrinterAdminController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * Get all printers for a kiosk
   */
  @Get(':kioskId/printers')
  async getPrinters(@Param('kioskId') kioskId: string) {
    return this.kioskService.getKioskPrinters(kioskId);
  }

  /**
   * Add a printer to a kiosk
   */
  @Post(':kioskId/printers')
  async addPrinter(
    @Param('kioskId') kioskId: string,
    @Body() body: { name: string; printerName: string; ipAddress?: string; printableType: string; printMode?: string; isEnabled?: boolean },
  ) {
    if (!body.name || !body.printerName || !body.printableType) {
      throw new BadRequestException('name, printerName, and printableType are required');
    }
    return this.kioskService.addPrinter(kioskId, body);
  }

  /**
   * Update a printer
   */
  @Put(':kioskId/printers/:printerId')
  async updatePrinter(
    @Param('kioskId') kioskId: string,
    @Param('printerId') printerId: string,
    @Body() body: { name?: string; printerName?: string; ipAddress?: string; printableType?: string; printMode?: string; isEnabled?: boolean },
  ) {
    return this.kioskService.updatePrinter(kioskId, printerId, body);
  }

  /**
   * Delete a printer
   */
  @Delete(':kioskId/printers/:printerId')
  async deletePrinter(
    @Param('kioskId') kioskId: string,
    @Param('printerId') printerId: string,
  ) {
    return this.kioskService.deletePrinter(kioskId, printerId);
  }

  /**
   * Get all active alerts for a kiosk
   */
  @Get(':kioskId/alerts')
  async getAlerts(
    @Param('kioskId') kioskId: string,
    @Query('includeResolved') includeResolved?: string,
  ) {
    return this.kioskService.getKioskAlerts(kioskId, includeResolved === 'true');
  }

  /**
   * Acknowledge an alert
   */
  @Post(':kioskId/alerts/:alertId/acknowledge')
  async acknowledgeAlert(
    @Param('kioskId') kioskId: string,
    @Param('alertId') alertId: string,
    @Request() req: any,
  ) {
    return this.kioskService.acknowledgeAlert(alertId, req.user.id);
  }
}

// ==================== SSE Endpoints for Real-Time Updates ====================

/**
 * Server-Sent Events endpoint for real-time printer status updates
 * Used by Admin and Manager dashboards for instant notifications
 */
@Controller('admin/printer-status')
export class PrinterStatusSSEController {
  constructor(private readonly kioskService: KioskConfigService) {}

  /**
   * SSE endpoint that streams critical alerts every 5 seconds
   * Clients connect to this to receive real-time notifications of printer issues
   */
  @Public()
  @Get('stream')
  @Sse()
  streamAlerts(): Observable<MessageEvent> {
    // Poll for critical alerts every 5 seconds and stream to connected clients
    return interval(5000).pipe(
      startWith(0), // Emit immediately on connection
      map(async () => {
        try {
          const alerts = await this.kioskService.getCriticalAlerts();
          return {
            data: JSON.stringify({
              type: 'critical-alerts',
              alerts,
              timestamp: new Date().toISOString(),
            }),
          };
        } catch (error) {
          return {
            data: JSON.stringify({
              type: 'error',
              message: 'Failed to fetch alerts',
              timestamp: new Date().toISOString(),
            }),
          };
        }
      }),
      // Handle the async map
      map(async (promise) => await promise),
    ) as any;
  }

  /**
   * SSE endpoint that streams all printer statuses every 10 seconds
   * More comprehensive than critical alerts, includes all status data
   */
  @Public()
  @Get('stream-all')
  @Sse()
  streamAllStatuses(): Observable<MessageEvent> {
    return interval(10000).pipe(
      startWith(0),
      map(async () => {
        try {
          const statuses = await this.kioskService.getAllPrinterStatuses();
          return {
            data: JSON.stringify({
              type: 'all-statuses',
              kiosks: statuses,
              timestamp: new Date().toISOString(),
            }),
          };
        } catch (error) {
          return {
            data: JSON.stringify({
              type: 'error',
              message: 'Failed to fetch statuses',
              timestamp: new Date().toISOString(),
            }),
          };
        }
      }),
      map(async (promise) => await promise),
    ) as any;
  }
}
