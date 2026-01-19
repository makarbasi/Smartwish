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
  Res,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { SurveillanceService } from './surveillance.service';
import { CreateDetectionDto, BatchCreateDetectionsDto } from './dto/create-detection.dto';
import { QueryDetectionsDto, DeleteDetectionsDto } from './dto/query-detections.dto';
import { Observable, interval, switchMap, from } from 'rxjs';
import { Response, Request } from 'express';

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

  /**
   * Receive live frame from kiosk surveillance script
   * The frame is stored in memory and served to admin viewers
   * This enables remote viewing of kiosk camera from admin dashboard
   */
  @Public()
  @Post('frame')
  @HttpCode(HttpStatus.OK)
  async uploadFrame(
    @Headers('x-kiosk-api-key') apiKey: string,
    @Headers('x-kiosk-id') kioskId: string,
    @Headers('content-type') contentType: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!apiKey || !kioskId) {
      throw new UnauthorizedException('Missing API key or kiosk ID');
    }

    const isValid = await this.surveillanceService.validateKioskApiKey(kioskId, apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key for kiosk');
    }

    // Get the raw body (image data)
    const frameData = req.rawBody;
    if (!frameData || frameData.length === 0) {
      return { success: false, error: 'No frame data received' };
    }

    await this.surveillanceService.storeLiveFrame(kioskId, frameData, contentType || 'image/jpeg');
    return { success: true, size: frameData.length };
  }

  /**
   * Upload a detection image to cloud storage
   * The image is stored in Supabase and the URL is returned
   * This endpoint receives the image as raw body and detection info in headers
   */
  @Public()
  @Post('detection-image')
  @HttpCode(HttpStatus.CREATED)
  async uploadDetectionImage(
    @Headers('x-kiosk-api-key') apiKey: string,
    @Headers('x-kiosk-id') kioskId: string,
    @Headers('x-person-track-id') personTrackIdStr: string,
    @Headers('x-detected-at') detectedAtStr: string,
    @Headers('x-dwell-seconds') dwellSecondsStr: string,
    @Headers('x-was-counted') wasCountedStr: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!apiKey || !kioskId) {
      throw new UnauthorizedException('Missing API key or kiosk ID');
    }

    const isValid = await this.surveillanceService.validateKioskApiKey(kioskId, apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key for kiosk');
    }

    const personTrackId = parseInt(personTrackIdStr || '0', 10);
    const detectedAt = detectedAtStr ? new Date(detectedAtStr) : new Date();
    const dwellSeconds = dwellSecondsStr ? parseFloat(dwellSecondsStr) : null;
    const wasCounted = wasCountedStr === 'true';

    // Get the raw body (image data)
    const imageData = req.rawBody;
    if (!imageData || imageData.length === 0) {
      return { success: false, error: 'No image data received' };
    }

    try {
      // Create detection with image upload
      const detection = await this.surveillanceService.createDetectionWithImage(
        {
          kioskId,
          personTrackId,
          detectedAt: detectedAt.toISOString(),
          dwellSeconds,
          wasCounted,
        },
        imageData,
      );

      return { 
        success: true, 
        id: detection.id,
        imageUrl: detection.imagePath,
      };
    } catch (error) {
      console.error('[Surveillance] Failed to create detection with image:', error);
      return { success: false, error: error.message };
    }
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

  /**
   * Get the latest live frame from a kiosk
   * Returns a JPEG image that can be displayed in an img tag
   */
  @Get(':kioskId/frame')
  async getLiveFrame(
    @Param('kioskId') kioskId: string,
    @Res() res: Response,
  ) {
    const frame = this.surveillanceService.getLiveFrame(kioskId);
    
    if (!frame) {
      res.status(503).json({ 
        error: 'No live frame available',
        message: 'Camera feed not available. Make sure surveillance is running on the kiosk.',
      });
      return;
    }

    res.set({
      'Content-Type': frame.contentType,
      'Content-Length': frame.data.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Frame-Timestamp': frame.timestamp.toISOString(),
    });
    res.send(frame.data);
  }

  /**
   * Get live stream status for a kiosk
   */
  @Get(':kioskId/stream/status')
  async getStreamStatus(@Param('kioskId') kioskId: string) {
    const isActive = this.surveillanceService.isLiveStreamActive(kioskId);
    const frame = this.surveillanceService.getLiveFrame(kioskId);
    
    return {
      kioskId,
      isActive,
      lastFrameAt: frame?.timestamp?.toISOString() || null,
      frameAge: frame ? Date.now() - frame.timestamp.getTime() : null,
    };
  }

  /**
   * MJPEG stream endpoint - serves continuous stream of frames
   * Works by polling the stored frames and sending them as multipart response
   */
  @Get(':kioskId/stream')
  async getMjpegStream(
    @Param('kioskId') kioskId: string,
    @Res() res: Response,
  ) {
    res.set({
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send frames continuously
    const sendFrame = () => {
      const frame = this.surveillanceService.getLiveFrame(kioskId);
      
      if (frame) {
        try {
          res.write('--frame\r\n');
          res.write('Content-Type: image/jpeg\r\n\r\n');
          res.write(frame.data);
          res.write('\r\n');
        } catch (err) {
          // Client disconnected
          clearInterval(intervalId);
          return;
        }
      }
    };

    // Send initial frame
    sendFrame();

    // Then send frames every 100ms (10 FPS)
    const intervalId = setInterval(sendFrame, 100);

    // Clean up on disconnect
    res.on('close', () => {
      clearInterval(intervalId);
    });
  }
}
