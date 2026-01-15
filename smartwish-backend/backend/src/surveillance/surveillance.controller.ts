import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { SurveillanceService } from './surveillance.service';
import { CreateDetectionDto, BatchCreateDetectionsDto } from './dto/create-detection.dto';
import { QueryDetectionsDto, DeleteDetectionsDto } from './dto/query-detections.dto';
import { Observable, interval, switchMap, from } from 'rxjs';

/**
 * Public endpoints for local print agent to report detections
 */
@Controller('surveillance')
export class SurveillancePublicController {
  constructor(private readonly surveillanceService: SurveillanceService) {}

  /**
   * Receive detection events from local print agent
   * Validates using kiosk API key in header
   */
  @Public()
  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  async createDetection(
    @Body() dto: CreateDetectionDto,
    @Headers('x-kiosk-api-key') apiKey: string,
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const isValid = await this.surveillanceService.validateKioskApiKey(dto.kioskId, apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key for kiosk');
    }

    const detection = await this.surveillanceService.createDetection(dto);
    return { success: true, id: detection.id };
  }

  /**
   * Receive batch detection events from local print agent
   */
  @Public()
  @Post('events/batch')
  @HttpCode(HttpStatus.CREATED)
  async createDetectionsBatch(
    @Body() dto: BatchCreateDetectionsDto,
    @Headers('x-kiosk-api-key') apiKey: string,
    @Headers('x-kiosk-id') kioskId: string,
  ) {
    if (!apiKey || !kioskId) {
      throw new UnauthorizedException('Missing API key or kiosk ID');
    }

    const isValid = await this.surveillanceService.validateKioskApiKey(kioskId, apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key for kiosk');
    }

    // Ensure all detections are for the same kiosk
    const dtos = dto.detections.map(d => ({ ...d, kioskId }));
    const result = await this.surveillanceService.createDetectionsBatch(dtos);
    return { success: true, ...result };
  }

  /**
   * Health check for surveillance endpoint
   */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

/**
 * Admin endpoints for surveillance dashboard
 */
@Controller('admin/surveillance')
@UseGuards(JwtAuthGuard)
export class SurveillanceAdminController {
  constructor(private readonly surveillanceService: SurveillanceService) {}

  /**
   * Get list of kiosks with surveillance enabled
   */
  @Get('kiosks')
  async getKiosksWithSurveillance() {
    return this.surveillanceService.getKiosksWithSurveillance();
  }

  /**
   * Get detections for a kiosk with filtering and pagination
   */
  @Get(':kioskId/detections')
  async getDetections(
    @Param('kioskId') kioskId: string,
    @Query() query: QueryDetectionsDto,
  ) {
    return this.surveillanceService.getDetections(kioskId, query);
  }

  /**
   * Get summary stats for a kiosk
   */
  @Get(':kioskId/stats/summary')
  async getSummaryStats(@Param('kioskId') kioskId: string) {
    return this.surveillanceService.getSummaryStats(kioskId);
  }

  /**
   * Get daily stats for a kiosk
   */
  @Get(':kioskId/stats/daily')
  async getDailyStats(
    @Param('kioskId') kioskId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.surveillanceService.getDailyStats(kioskId, startDate, endDate);
  }

  /**
   * Delete specific detections or by date range
   */
  @Delete(':kioskId/detections')
  async deleteDetections(
    @Param('kioskId') kioskId: string,
    @Body() dto: DeleteDetectionsDto,
  ) {
    return this.surveillanceService.deleteDetections(kioskId, dto);
  }

  /**
   * Delete a single detection
   */
  @Delete(':kioskId/detections/:detectionId')
  async deleteDetection(
    @Param('kioskId') kioskId: string,
    @Param('detectionId') detectionId: string,
  ) {
    return this.surveillanceService.deleteDetections(kioskId, { ids: [detectionId] });
  }

  /**
   * Delete all detections for a kiosk
   */
  @Delete(':kioskId/all')
  async deleteAllDetections(@Param('kioskId') kioskId: string) {
    return this.surveillanceService.deleteAllDetections(kioskId);
  }

  /**
   * SSE endpoint for real-time stats updates
   * Polls every 5 seconds and sends updated stats
   */
  @Sse(':kioskId/live')
  liveStats(@Param('kioskId') kioskId: string): Observable<MessageEvent> {
    return interval(5000).pipe(
      switchMap(() => from(this.surveillanceService.getSummaryStats(kioskId))),
      switchMap((stats) => from(Promise.resolve({ data: stats } as MessageEvent))),
    );
  }
}
