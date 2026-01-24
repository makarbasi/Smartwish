import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateRecordingDto {
  sessionId: string;
  kioskId: string;
  resolution?: string;
  frameRate?: number;
}

export interface UploadRecordingDto {
  recordingId: string;
  sessionId: string;
  kioskId: string;
  type: 'video' | 'thumbnail' | 'webcam' | 'console_log';
}

@Injectable()
export class SessionRecordingsService {
  private readonly logger = new Logger(SessionRecordingsService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  /**
   * Create a new recording record when session recording begins
   */
  async createRecording(dto: CreateRecordingDto) {
    const supabase = this.supabaseService.getClient();

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from('kiosk_sessions')
      .select('id, kiosk_id')
      .eq('id', dto.sessionId)
      .single();

    if (sessionError || !session) {
      this.logger.error(`Invalid session ID: ${dto.sessionId}`, sessionError);
      throw new Error('Invalid session ID');
    }

    // Create recording record
    const { data: recording, error: recordingError } = await supabase
      .from('session_recordings')
      .insert({
        session_id: dto.sessionId,
        kiosk_id: session.kiosk_id,
        resolution: dto.resolution || '1280x720',
        frame_rate: dto.frameRate || 1,
        status: 'recording',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (recordingError) {
      this.logger.error('Error creating recording record:', recordingError);
      throw new Error('Failed to create recording record');
    }

    // Update session to indicate it has a recording
    await supabase
      .from('kiosk_sessions')
      .update({ has_recording: true })
      .eq('id', dto.sessionId);

    this.logger.log(`Created recording record: ${recording.id} for session: ${dto.sessionId}`);

    return { recordingId: recording.id };
  }

  /**
   * Update recording status
   */
  async updateStatus(recordingId: string, status: string, errorMessage?: string) {
    const supabase = this.supabaseService.getClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (status === 'completed' || status === 'failed') {
      updateData.ended_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('session_recordings')
      .update(updateData)
      .eq('id', recordingId);

    if (error) {
      this.logger.error(`Error updating recording status: ${recordingId}`, error);
      throw new Error('Failed to update recording status');
    }

    this.logger.log(`Updated recording status: ${recordingId} to ${status}`);

    return { success: true };
  }

  /**
   * Upload recording file to Supabase Storage
   */
  async uploadFile(
    file: Buffer,
    contentType: string,
    dto: UploadRecordingDto,
  ) {
    this.logger.log(`[Upload] Starting upload: type=${dto.type}, sessionId=${dto.sessionId}, size=${file.length}, contentType=${contentType}`);

    const supabase = this.supabaseService.getClient();
    const bucket = 'session-recordings';

    // Validate file
    if (!file || file.length === 0) {
      this.logger.error('[Upload] File is empty or invalid');
      throw new Error('File is empty or invalid');
    }

    // Check bucket exists first
    this.logger.log(`[Upload] Checking if bucket "${bucket}" exists...`);
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      this.logger.error('[Upload] Error listing buckets:', bucketError);
      throw new Error(`Failed to check storage buckets: ${bucketError.message}`);
    }

    const bucketExists = buckets?.some(b => b.name === bucket);
    this.logger.log(`[Upload] Bucket exists: ${bucketExists}, Available buckets: ${buckets?.map(b => b.name).join(', ') || 'none'}`);

    if (!bucketExists) {
      this.logger.error(`[Upload] Storage bucket "${bucket}" does not exist`);
      throw new Error('Storage bucket not configured. Please create the "session-recordings" bucket in Supabase.');
    }

    const timestamp = Date.now();
    const isThumbnail = dto.type === 'thumbnail';
    const isWebcam = dto.type === 'webcam';
    const isConsoleLog = dto.type === 'console_log';

    // Determine extension from content type
    let extension = 'webm';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      extension = 'jpg';
    } else if (contentType.includes('png')) {
      extension = 'png';
    } else if (contentType.includes('json')) {
      extension = 'json';
    } else if (contentType.includes('mp4')) {
      extension = 'mp4';
    } else if (contentType.includes('x-msvideo') || contentType.includes('avi')) {
      extension = 'avi';
    }

    const folder = isThumbnail ? 'thumbnails' : isWebcam ? 'webcam' : isConsoleLog ? 'console_logs' : 'videos';
    const fileName = `${folder}/${dto.sessionId}_${isWebcam ? 'webcam_' : isConsoleLog ? 'console_logs_' : ''}${timestamp}.${extension}`;

    this.logger.log(`[Upload] Uploading to: ${fileName}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      this.logger.error('[Upload] Upload error:', {
        message: uploadError.message,
        error: uploadError,
      });

      if (uploadError.message?.includes('Bucket not found') ||
        uploadError.message?.includes('404') ||
        uploadError.message?.includes('not found')) {
        throw new Error('Storage bucket not configured. Please create the "session-recordings" bucket in Supabase.');
      }

      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    if (!uploadData) {
      this.logger.error('[Upload] Upload succeeded but no data returned');
      throw new Error('Upload failed: No data returned from storage');
    }

    this.logger.log(`[Upload] File uploaded successfully: ${uploadData.path}`);

    // Get signed URL (7 day expiry)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    if (urlError) {
      this.logger.error('[Upload] Error creating signed URL:', urlError);
      throw new Error(`Failed to create signed URL: ${urlError.message}`);
    }

    const storageUrl = urlData?.signedUrl || '';

    if (!storageUrl) {
      this.logger.error('[Upload] Signed URL is empty');
      throw new Error('Failed to generate signed URL');
    }

    this.logger.log(`[Upload] Signed URL created: ${storageUrl.substring(0, 50)}...`);

    // Update recording record
    if (dto.recordingId) {
      const updateData: any = {};

      if (isThumbnail) {
        updateData.thumbnail_path = fileName;
        updateData.thumbnail_url = storageUrl;
      } else if (isWebcam) {
        updateData.webcam_storage_path = fileName;
        updateData.webcam_storage_url = storageUrl;
        updateData.webcam_file_size_bytes = file.length;
      } else if (isConsoleLog) {
        updateData.console_log_storage_path = fileName;
        updateData.console_log_storage_url = storageUrl;
      } else {
        updateData.storage_path = fileName;
        updateData.storage_url = storageUrl;
        updateData.file_size_bytes = file.length;
      }

      this.logger.log(`[Upload] Updating recording record: ${dto.recordingId}`);
      const { error: updateError } = await supabase
        .from('session_recordings')
        .update(updateData)
        .eq('id', dto.recordingId);

      if (updateError) {
        this.logger.error('[Upload] Error updating recording record:', updateError);
        // Don't throw - file was uploaded successfully
      } else {
        this.logger.log(`[Upload] Recording record updated successfully`);
      }
    }

    this.logger.log(`[Upload] Upload completed successfully: ${fileName}`);

    return {
      success: true,
      storagePath: fileName,
      storageUrl,
      fileSize: file.length,
    };
  }

  /**
   * Finalize recording after all uploads complete
   */
  async completeRecording(
    recordingId: string,
    durationSeconds: number,
    resolution: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('session_recordings')
      .update({
        duration_seconds: durationSeconds,
        resolution,
        status: 'completed',
        ended_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (error) {
      this.logger.error(`Error completing recording: ${recordingId}`, error);
      throw new Error('Failed to complete recording');
    }

    this.logger.log(`Completed recording: ${recordingId}`);

    return { success: true };
  }

  /**
   * Get recording by session ID (for admin)
   */
  async getRecordingBySessionId(sessionId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: recording, error } = await supabase
      .from('session_recordings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      this.logger.error('Error fetching recording:', error);
      throw new Error('Failed to fetch recording');
    }

    // Generate fresh signed URLs if paths exist
    if (recording.storage_path) {
      const { data: videoUrl } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(recording.storage_path, 60 * 60); // 1 hour
      recording.storage_url = videoUrl?.signedUrl || recording.storage_url;
    }

    if (recording.thumbnail_path) {
      const { data: thumbUrl } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(recording.thumbnail_path, 60 * 60);
      recording.thumbnail_url = thumbUrl?.signedUrl || recording.thumbnail_url;
    }

    if (recording.webcam_storage_path) {
      const { data: webcamUrl } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(recording.webcam_storage_path, 60 * 60);
      recording.webcam_storage_url = webcamUrl?.signedUrl || recording.webcam_storage_url;
    }

    return recording;
  }

  /**
   * Delete recording and its files from storage
   */
  async deleteRecording(recordingId: string) {
    const supabase = this.supabaseService.getClient();

    // Get recording to find file paths
    const { data: recording, error: fetchError } = await supabase
      .from('session_recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (fetchError) {
      this.logger.error('Error fetching recording for deletion:', fetchError);
      throw new Error('Recording not found');
    }

    this.logger.log(`Deleting recording ${recordingId} for session ${recording.session_id}`);

    // Delete files from storage
    const filesToDelete: string[] = [];
    if (recording.storage_path) {
      filesToDelete.push(recording.storage_path);
      this.logger.log(`  - Will delete video: ${recording.storage_path}`);
    }
    if (recording.thumbnail_path) {
      filesToDelete.push(recording.thumbnail_path);
      this.logger.log(`  - Will delete thumbnail: ${recording.thumbnail_path}`);
    }
    if (recording.webcam_storage_path) {
      filesToDelete.push(recording.webcam_storage_path);
      this.logger.log(`  - Will delete webcam video: ${recording.webcam_storage_path}`);
    }

    if (filesToDelete.length > 0) {
      this.logger.log(`Deleting ${filesToDelete.length} files from storage bucket 'session-recordings'...`);

      const { data: deleteData, error: storageError } = await supabase.storage
        .from('session-recordings')
        .remove(filesToDelete);

      if (storageError) {
        this.logger.error(`Error deleting storage files: ${storageError.message}`, storageError);
        // Don't throw - continue to delete DB record even if storage fails
      } else {
        this.logger.log(`Successfully deleted ${deleteData?.length || 0} files from storage`);
      }
    } else {
      this.logger.log('No storage files to delete for this recording');
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('session_recordings')
      .delete()
      .eq('id', recordingId);

    if (deleteError) {
      this.logger.error('Error deleting recording record:', deleteError);
      throw new Error('Failed to delete recording');
    }

    this.logger.log(`Deleted recording database record: ${recordingId}`);

    // Update session to indicate no recording
    if (recording.session_id) {
      const { error: updateError } = await supabase
        .from('kiosk_sessions')
        .update({ has_recording: false })
        .eq('id', recording.session_id);

      if (updateError) {
        this.logger.warn(`Failed to update session has_recording flag: ${updateError.message}`);
      } else {
        this.logger.log(`Updated session ${recording.session_id} has_recording = false`);
      }
    }

    this.logger.log(`✅ Successfully deleted recording: ${recordingId}`);

    return { success: true, deletedFiles: filesToDelete };
  }
}

