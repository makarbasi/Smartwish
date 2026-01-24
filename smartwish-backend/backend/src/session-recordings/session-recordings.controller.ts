import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionRecordingsService } from './session-recordings.service';
import { Public } from '../auth/public.decorator';

/**
 * Public endpoints for kiosks to create and upload recordings
 */
@Controller('kiosk/session/recording')
export class SessionRecordingsPublicController {
  constructor(private readonly recordingsService: SessionRecordingsService) { }

  /**
   * Start a new recording (create database record)
   */
  @Public()
  @Post('start')
  async startRecording(
    @Body() body: { sessionId: string; kioskId: string; resolution?: string; frameRate?: number },
  ) {
    if (!body.sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    if (!body.kioskId) {
      throw new BadRequestException('kioskId is required');
    }

    return this.recordingsService.createRecording({
      sessionId: body.sessionId,
      kioskId: body.kioskId,
      resolution: body.resolution,
      frameRate: body.frameRate,
    });
  }

  /**
   * Update recording status
   */
  @Public()
  @Patch('status')
  async updateStatus(
    @Body() body: { recordingId: string; status: string; errorMessage?: string },
  ) {
    if (!body.recordingId) {
      throw new BadRequestException('recordingId is required');
    }
    if (!body.status) {
      throw new BadRequestException('status is required');
    }

    return this.recordingsService.updateStatus(
      body.recordingId,
      body.status,
      body.errorMessage,
    );
  }

  /**
   * Upload recording file (video or thumbnail) - DEPRECATED: Use upload-python instead
   */
  @Public()
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  }))
  async uploadRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { recordingId: string; sessionId: string; kioskId: string; type: string },
  ) {
    console.log('[Upload Controller] Received upload request:', {
      hasFile: !!file,
      fileSize: file?.size || 0,
      fileName: file?.originalname || 'unknown',
      mimeType: file?.mimetype || 'unknown',
      sessionId: body.sessionId,
      recordingId: body.recordingId,
      type: body.type,
    });

    if (!file) {
      console.error('[Upload Controller] No file received');
      throw new BadRequestException('File is required');
    }
    if (!body.sessionId) {
      console.error('[Upload Controller] No sessionId provided');
      throw new BadRequestException('sessionId is required');
    }

    if (!file.buffer || file.buffer.length === 0) {
      console.error('[Upload Controller] File buffer is empty');
      throw new BadRequestException('File buffer is empty');
    }

    console.log('[Upload Controller] Calling uploadFile service...');
    return this.recordingsService.uploadFile(
      file.buffer,
      file.mimetype,
      {
        recordingId: body.recordingId,
        sessionId: body.sessionId,
        kioskId: body.kioskId,
        type: body.type as 'video' | 'thumbnail' | 'webcam',
      },
    );
  }

  /**
   * Upload video file from Python script (new endpoint for Python-based recording)
   */
  @Public()
  @Post('upload-python')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max for videos
  }))
  async uploadPythonRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { sessionId: string; kioskId: string; type: 'webcam' | 'screen' | 'console_log' },
    @Headers('x-kiosk-api-key') apiKey?: string,
    @Headers('x-kiosk-id') kioskIdHeader?: string,
  ) {
    const kioskId = body.kioskId || kioskIdHeader;

    console.log('[Upload Python] Received upload request:', {
      hasFile: !!file,
      fileSize: file?.size || 0,
      fileName: file?.originalname || 'unknown',
      mimeType: file?.mimetype || 'unknown',
      sessionId: body.sessionId,
      kioskId: kioskId,
      type: body.type,
      hasApiKey: !!apiKey,
    });

    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!body.sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    if (!kioskId) {
      throw new BadRequestException('kioskId is required');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    // Validate API key if provided
    if (apiKey) {
      // TODO: Add API key validation if needed
      // For now, we'll trust the kioskId and sessionId match
    }

    // Get or create recording record for this session
    let recording = await this.recordingsService.getRecordingBySessionId(body.sessionId);
    if (!recording) {
      // Create new recording record
      recording = await this.recordingsService.createRecording({
        sessionId: body.sessionId,
        kioskId: kioskId,
        resolution: body.type === 'webcam' ? '1280x720' : '1920x1080',
        frameRate: body.type === 'webcam' ? 30 : 1,
      });
    }

    // Map upload type to service type
    let uploadType: 'video' | 'thumbnail' | 'webcam' | 'console_log';
    let mimeType = file.mimetype;

    if (body.type === 'webcam') {
      uploadType = 'webcam';
      mimeType = mimeType || 'video/mp4';
    } else if (body.type === 'console_log') {
      uploadType = 'console_log';
      mimeType = mimeType || 'application/json';
    } else {
      uploadType = 'video';
      mimeType = mimeType || 'video/mp4';
    }

    // Upload the file
    console.log(`[Upload Python] Uploading ${body.type} for session ${body.sessionId}...`);
    return this.recordingsService.uploadFile(
      file.buffer,
      mimeType,
      {
        recordingId: recording.id,
        sessionId: body.sessionId,
        kioskId: kioskId,
        type: uploadType,
      },
    );
  }

  /**
   * Complete recording (finalize after upload)
   */
  @Public()
  @Post('complete')
  async completeRecording(
    @Body() body: { recordingId: string; durationSeconds: number; resolution: string },
  ) {
    if (!body.recordingId) {
      throw new BadRequestException('recordingId is required');
    }

    return this.recordingsService.completeRecording(
      body.recordingId,
      body.durationSeconds || 0,
      body.resolution || '1280x720',
    );
  }
}

/**
 * Admin endpoints for viewing and managing recordings
 * Note: Auth is handled at the frontend API layer (Next-Auth)
 * These endpoints are called only from frontend API routes that check auth
 */
@Controller('admin/kiosks')
export class SessionRecordingsAdminController {
  constructor(private readonly recordingsService: SessionRecordingsService) { }

  /**
   * Get recording for a specific session
   * Called from frontend /api/admin/kiosks/[kioskId]/sessions/[sessionId]/recording
   */
  @Public()
  @Get(':kioskId/sessions/:sessionId/recording')
  async getSessionRecording(
    @Param('kioskId') kioskId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const recording = await this.recordingsService.getRecordingBySessionId(sessionId);
    return { recording };
  }

  /**
   * Delete a recording
   * Called from frontend /api/admin/kiosks/[kioskId]/sessions/[sessionId]/recording
   */
  @Public()
  @Delete(':kioskId/sessions/:sessionId/recording')
  async deleteSessionRecording(
    @Param('kioskId') kioskId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const recording = await this.recordingsService.getRecordingBySessionId(sessionId);
    if (!recording) {
      throw new BadRequestException('Recording not found');
    }
    return this.recordingsService.deleteRecording(recording.id);
  }
}

