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
  type: 'video' | 'thumbnail';
}

@Injectable()
export class SessionRecordingsService {
  private readonly logger = new Logger(SessionRecordingsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

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
    const supabase = this.supabaseService.getClient();
    const bucket = 'session-recordings';
    const timestamp = Date.now();
    const isThumbnail = dto.type === 'thumbnail';
    
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
    }
    
    const folder = isThumbnail ? 'thumbnails' : 'videos';
    const fileName = `${folder}/${dto.sessionId}_${timestamp}.${extension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      this.logger.error('Upload error:', uploadError);
      
      if (uploadError.message?.includes('Bucket not found')) {
        throw new Error('Storage bucket not configured. Please create the "session-recordings" bucket in Supabase.');
      }
      
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get signed URL (7 day expiry)
    const { data: urlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    const storageUrl = urlData?.signedUrl || '';

    this.logger.log(`Uploaded: ${fileName}`);

    // Update recording record
    if (dto.recordingId) {
      const updateData: any = {};
      
      if (!isThumbnail) {
        updateData.storage_path = fileName;
        updateData.storage_url = storageUrl;
        updateData.file_size_bytes = file.length;
      } else {
        updateData.thumbnail_path = fileName;
        updateData.thumbnail_url = storageUrl;
      }

      await supabase
        .from('session_recordings')
        .update(updateData)
        .eq('id', dto.recordingId);
    }

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

