/**
 * Upload Session Store
 * 
 * In-memory session storage for sticker photo uploads.
 * Used to link QR code scans from mobile devices to kiosk sticker slots.
 * 
 * Uses globalThis to persist across Next.js module reloads in production.
 * Sessions are short-lived (10 minutes) so in-memory storage is appropriate.
 */

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

// Use globalThis to persist sessions across module reloads
// This works in both development and production
const globalKey = '__upload_sessions__';

function getSessions(): Map<string, UploadSession> {
  if (!(globalThis as any)[globalKey]) {
    (globalThis as any)[globalKey] = new Map<string, UploadSession>();
  }
  return (globalThis as any)[globalKey];
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

  const sessions = getSessions();
  sessions.set(sessionId, session);
  
  console.log(`[UploadSession] Created session ${sessionId} for slot ${slotIndex}, expires at ${new Date(session.expiresAt).toISOString()}`);
  console.log(`[UploadSession] Total sessions: ${sessions.size}`);
  
  return session;
}

/**
 * Get an upload session by ID
 * Returns undefined if not found or expired
 */
export function getUploadSession(sessionId: string): UploadSession | undefined {
  const sessions = getSessions();
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
  const sessions = getSessions();
  const session = sessions.get(sessionId);
  
  if (!session) {
    console.log(`[UploadSession] Cannot update - session ${sessionId} not found`);
    return false;
  }
  
  Object.assign(session, updates);
  sessions.set(sessionId, session);
  
  console.log(`[UploadSession] Updated session ${sessionId}:`, updates.status || 'no status change');
  return true;
}

/**
 * Delete an upload session
 * Returns true if session was deleted, false if not found
 */
export function deleteUploadSession(sessionId: string): boolean {
  const sessions = getSessions();
  const deleted = sessions.delete(sessionId);
  
  console.log(`[UploadSession] Deleted session ${sessionId}: ${deleted}`);
  return deleted;
}

/**
 * Cleanup expired sessions
 * Call periodically to prevent memory bloat
 */
export function cleanupExpiredSessions(): number {
  const sessions = getSessions();
  const now = Date.now();
  let count = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      count++;
    }
  }
  
  if (count > 0) {
    console.log(`[UploadSession] Cleaned up ${count} expired sessions`);
  }
  
  return count;
}

/**
 * Get session count (for debugging)
 */
export function getSessionCount(): number {
  return getSessions().size;
}
