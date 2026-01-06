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
