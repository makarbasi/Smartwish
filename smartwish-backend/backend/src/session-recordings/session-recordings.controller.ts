import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
  constructor(private readonly recordingsService: SessionRecordingsService) {}

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
   * Upload recording file (video or thumbnail)
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
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!body.sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    return this.recordingsService.uploadFile(
      file.buffer,
      file.mimetype,
      {
        recordingId: body.recordingId,
        sessionId: body.sessionId,
        kioskId: body.kioskId,
        type: body.type as 'video' | 'thumbnail',
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
  constructor(private readonly recordingsService: SessionRecordingsService) {}

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

