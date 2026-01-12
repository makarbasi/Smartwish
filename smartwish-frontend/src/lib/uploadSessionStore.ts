/**
 * Upload Session Store
 * 
 * File-based session storage for sticker photo uploads.
 * Used to link QR code scans from mobile devices to kiosk sticker slots.
 * 
 * Uses file storage to survive Next.js hot reloads in development.
 * For production, consider using Redis or database storage.
 */

import fs from 'fs';
import path from 'path';

export interface UploadSession {
  sessionId: string;
  slotIndex: number;
  kioskSessionId: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'completed' | 'expired';
  imageUrl?: string;
  imageBase64?: string;
}

// Session expiration time: 10 minutes
const SESSION_TTL_MS = 10 * 60 * 1000;

// File path for session storage (in .next directory to survive hot reloads)
const SESSION_FILE_PATH = path.join(process.cwd(), '.next', 'upload-sessions.json');

/**
 * Read all sessions from file
 */
function readSessionsFromFile(): Map<string, UploadSession> {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const data = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.log('[UploadSession] Error reading sessions file, starting fresh');
  }
  return new Map();
}

/**
 * Write all sessions to file
 */
function writeSessionsToFile(sessions: Map<string, UploadSession>): void {
  try {
    // Ensure .next directory exists
    const dir = path.dirname(SESSION_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data = Object.fromEntries(sessions);
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[UploadSession] Error writing sessions file:', error);
  }
}

/**
 * Create a new upload session
 */
export function createUploadSession(
  sessionId: string,
  slotIndex: number,
  kioskSessionId: string
): UploadSession {
  const now = Date.now();
  
  const session: UploadSession = {
    sessionId,
    slotIndex,
    kioskSessionId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    status: 'pending'
  };

  const sessions = readSessionsFromFile();
  sessions.set(sessionId, session);
  writeSessionsToFile(sessions);
  
  console.log(`[UploadSession] Created session ${sessionId} for slot ${slotIndex}, expires at ${new Date(session.expiresAt).toISOString()}`);
  console.log(`[UploadSession] Total sessions: ${sessions.size}`);
  
  return session;
}

/**
 * Get an upload session by ID
 * Returns undefined if not found or expired
 */
export function getUploadSession(sessionId: string): UploadSession | undefined {
  const sessions = readSessionsFromFile();
  const session = sessions.get(sessionId);
  
  if (!session) {
    console.log(`[UploadSession] Session ${sessionId} not found. Total sessions: ${sessions.size}`);
    return undefined;
  }
  
  // Check if expired
  const now = Date.now();
  if (now > session.expiresAt) {
    console.log(`[UploadSession] Session ${sessionId} expired. Now: ${now}, ExpiresAt: ${session.expiresAt}`);
    session.status = 'expired';
    sessions.delete(sessionId);
    writeSessionsToFile(sessions);
    return undefined;
  }
  
  console.log(`[UploadSession] Found session ${sessionId}, status: ${session.status}, remaining: ${Math.round((session.expiresAt - now) / 1000)}s`);
  return session;
}

/**
 * Update an existing upload session
 * Returns true if successful, false if session not found
 */
export function updateUploadSession(
  sessionId: string, 
  updates: Partial<UploadSession>
): boolean {
  const sessions = readSessionsFromFile();
  const session = sessions.get(sessionId);
  
  if (!session) {
    console.log(`[UploadSession] Cannot update - session ${sessionId} not found`);
    return false;
  }
  
  Object.assign(session, updates);
  sessions.set(sessionId, session);
  writeSessionsToFile(sessions);
  
  console.log(`[UploadSession] Updated session ${sessionId}:`, updates.status || 'no status change');
  return true;
}

/**
 * Delete an upload session
 * Returns true if session was deleted, false if not found
 */
export function deleteUploadSession(sessionId: string): boolean {
  const sessions = readSessionsFromFile();
  const deleted = sessions.delete(sessionId);
  
  if (deleted) {
    writeSessionsToFile(sessions);
  }
  
  console.log(`[UploadSession] Deleted session ${sessionId}: ${deleted}`);
  return deleted;
}

/**
 * Cleanup expired sessions
 * Call periodically to prevent file bloat
 */
export function cleanupExpiredSessions(): number {
  const sessions = readSessionsFromFile();
  const now = Date.now();
  let count = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      count++;
    }
  }
  
  if (count > 0) {
    writeSessionsToFile(sessions);
    console.log(`[UploadSession] Cleaned up ${count} expired sessions`);
  }
  
  return count;
}

/**
 * Get session count (for debugging)
 */
export function getSessionCount(): number {
  return readSessionsFromFile().size;
}
