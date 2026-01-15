import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SalesRepresentativesService } from './sales-representatives.service';
import {
  CreateSalesRepresentativeDto,
  UpdateSalesRepresentativeDto,
} from './dto/create-sales-representative.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

// ==================== Admin Endpoints ====================

@Controller('admin/sales-representatives')
@UseGuards(JwtAuthGuard)
export class AdminSalesRepController {
  constructor(private readonly salesRepService: SalesRepresentativesService) {}

  /**
   * List all sales representatives
   */
  @Get()
  async list() {
    return this.salesRepService.list();
  }

  /**
   * Get a sales representative by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.salesRepService.getById(id);
  }

  /**
   * Create a new sales representative
   */
  @Post()
  async create(
    @Body() dto: CreateSalesRepresentativeDto,
    @Request() req: any,
  ) {
    return this.salesRepService.create(dto, req.user.id);
  }

  /**
   * Update a sales representative
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesRepresentativeDto,
  ) {
    return this.salesRepService.update(id, dto);
  }

  /**
   * Delete (deactivate) a sales representative
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.salesRepService.delete(id);
  }

  /**
   * Permanently delete a sales representative
   */
  @Delete(':id/permanent')
  async hardDelete(@Param('id') id: string) {
    return this.salesRepService.hardDelete(id);
  }

  /**
   * Assign sales rep to a kiosk
   */
  @Post(':id/assign-kiosk')
  async assignToKiosk(
    @Param('id') id: string,
    @Body() body: { kioskId: string },
  ) {
    if (!body.kioskId) {
      throw new BadRequestException('kioskId is required');
    }
    return this.salesRepService.assignToKiosk(id, body.kioskId);
  }

  /**
   * Unassign sales rep from a kiosk
   */
  @Delete('unassign-kiosk/:kioskId')
  async unassignFromKiosk(@Param('kioskId') kioskId: string) {
    return this.salesRepService.unassignFromKiosk(kioskId);
  }

  /**
   * Get kiosks assigned to a sales rep
   */
  @Get(':id/kiosks')
  async getAssignedKiosks(@Param('id') id: string) {
    return this.salesRepService.getAssignedKiosks(id);
  }

  /**
   * Get earnings for a sales rep (admin view - full details)
   */
  @Get(':id/earnings')
  async getEarnings(
    @Param('id') id: string,
    @Query('kioskId') kioskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesRepService.getEarnings(id, {
      kioskId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }
}

// ==================== Public Endpoints (Login, Signup) ====================

@Controller('sales-rep')
export class SalesRepPublicController {
  constructor(
    private readonly salesRepService: SalesRepresentativesService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Sales rep login
   */
  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const { salesRep, user } = await this.salesRepService.salesRepLogin(
      body.email,
      body.password,
    );

    // Generate JWT token
    const payload = {
      email: user.email,
      sub: user.id,
      salesRepId: salesRep.id,
      role: 'sales_representative',
    };

    const token = this.jwtService.sign(payload);

    return {
      id: salesRep.id,
      userId: user.id,
      email: salesRep.email,
      firstName: salesRep.firstName,
      lastName: salesRep.lastName,
      commissionPercent: salesRep.commissionPercent,
      token,
    };
  }
}

// ==================== Authenticated Sales Rep Endpoints ====================

@Controller('sales-rep')
@UseGuards(JwtAuthGuard)
export class SalesRepController {
  constructor(private readonly salesRepService: SalesRepresentativesService) {}

  /**
   * Get current sales rep profile
   */
  @Get('me')
  async getMe(@Request() req: any) {
    const salesRep = await this.salesRepService.getByUserId(req.user.id);
    if (!salesRep) {
      throw new BadRequestException('Not a sales representative');
    }
    return this.salesRepService.getById(salesRep.id);
  }

  /**
   * Get earnings for current sales rep
   */
  @Get('earnings')
  async getMyEarnings(
    @Request() req: any,
    @Query('kioskId') kioskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const salesRep = await this.salesRepService.getByUserId(req.user.id);
    if (!salesRep) {
      throw new BadRequestException('Not a sales representative');
    }

    return this.salesRepService.getEarnings(salesRep.id, {
      kioskId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get kiosks assigned to current sales rep
   */
  @Get('my-kiosks')
  async getMyKiosks(@Request() req: any) {
    const salesRep = await this.salesRepService.getByUserId(req.user.id);
    if (!salesRep) {
      throw new BadRequestException('Not a sales representative');
    }
    return this.salesRepService.getAssignedKiosks(salesRep.id);
  }
}
