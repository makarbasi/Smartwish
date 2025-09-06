// Session Data Manager - Handles temporary data persistence across route navigation
// Data persists until browser refresh but doesn't save permanently to database

export interface PageEditData {
  pageIndex: number;
  historyLength: number;
  historyIndex: number;
  hasChanges: boolean;
  editedImageBlob?: Blob;
  editedImageDataUrl?: string;
  originalImageExists: boolean;
  timestamp: number;
}

export interface SessionEditStack {
  templateId: string;
  sessionId: string; // Unique session identifier
  pages: { [pageIndex: number]: PageEditData };
  lastEditedPage?: number;
  createdAt: number;
  lastModified: number;
}

class SessionDataManager {
  private readonly SESSION_KEY_PREFIX = 'smartwish-session-';
  private readonly SESSION_STACK_KEY = 'smartwish-session-stack';
  private readonly MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours

  // Generate a unique session ID for this editing session
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get or create session for a template
  public getOrCreateSession(templateId: string): SessionEditStack {
    try {
      const existingSession = this.getSession(templateId);
      if (existingSession) {
        console.log(`📂 Found existing session for template ${templateId}`);
        return existingSession;
      }

      // Create new session
      const newSession: SessionEditStack = {
        templateId,
        sessionId: this.generateSessionId(),
        pages: {},
        createdAt: Date.now(),
        lastModified: Date.now()
      };

      this.saveSession(newSession);
      console.log(`🆕 Created new session for template ${templateId}:`, newSession.sessionId);
      return newSession;
    } catch (error) {
      console.warn('⚠️ Error managing session, creating new one:', error);
      const fallbackSession: SessionEditStack = {
        templateId,
        sessionId: this.generateSessionId(),
        pages: {},
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      return fallbackSession;
    }
  }

  // Get session for a template
  public getSession(templateId: string): SessionEditStack | null {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${templateId}`;
      const sessionData = sessionStorage.getItem(sessionKey);
      
      if (!sessionData) {
        console.log(`📂 No session found for template ${templateId}`);
        return null;
      }

      const session: SessionEditStack = JSON.parse(sessionData);
      
      // Check if session is expired
      const age = Date.now() - session.createdAt;
      if (age > this.MAX_SESSION_AGE) {
        console.log(`⏰ Session expired for template ${templateId}, cleaning up`);
        this.clearSession(templateId);
        return null;
      }

      return session;
    } catch (error) {
      console.warn(`⚠️ Error reading session for template ${templateId}:`, error);
      return null;
    }
  }

  // Save session data
  public saveSession(session: SessionEditStack): void {
    try {
      session.lastModified = Date.now();
      const sessionKey = `${this.SESSION_KEY_PREFIX}${session.templateId}`;
      
      // Create a copy without blob data for sessionStorage (to avoid quota issues)
      const sessionForStorage: SessionEditStack = {
        ...session,
        pages: {}
      };

      // Copy page data but exclude blob data
      Object.keys(session.pages).forEach(pageKey => {
        const pageData = session.pages[parseInt(pageKey)];
        sessionForStorage.pages[parseInt(pageKey)] = {
          ...pageData,
          editedImageBlob: undefined // Don't store blobs in sessionStorage
        };
      });

      sessionStorage.setItem(sessionKey, JSON.stringify(sessionForStorage));
      
      // Store blob data separately in memory-based map (survives route changes but not refresh)
      this.storeBlobsInMemory(session);
      
      console.log(`💾 Saved session for template ${session.templateId}:`, {
        sessionId: session.sessionId,
        pagesCount: Object.keys(session.pages).length,
        pagesWithChanges: Object.values(session.pages).filter(p => p.hasChanges).length
      });
    } catch (error) {
      console.warn(`⚠️ Error saving session for template ${session.templateId}:`, error);
      
      // If quota exceeded, try cleanup and retry
      if (error.name === 'QuotaExceededError') {
        this.cleanupOldSessions();
        try {
          sessionStorage.setItem(`${this.SESSION_KEY_PREFIX}${session.templateId}`, JSON.stringify(sessionForStorage));
          console.log('✅ Session saved after cleanup');
        } catch (retryError) {
          console.error('❌ Session save failed even after cleanup:', retryError);
        }
      }
    }
  }

  // Memory storage for blobs (survives route changes but not page refresh)
  private memoryBlobStore = new Map<string, Map<number, Blob>>();

  private storeBlobsInMemory(session: SessionEditStack): void {
    const templateBlobs = new Map<number, Blob>();
    
    Object.entries(session.pages).forEach(([pageKey, pageData]) => {
      if (pageData.editedImageBlob) {
        templateBlobs.set(parseInt(pageKey), pageData.editedImageBlob);
      }
    });
    
    if (templateBlobs.size > 0) {
      this.memoryBlobStore.set(session.templateId, templateBlobs);
      console.log(`🧠 Stored ${templateBlobs.size} blob(s) in memory for template ${session.templateId}`);
    }
  }

  // Get blob from memory
  public getBlobFromMemory(templateId: string, pageIndex: number): Blob | null {
    const templateBlobs = this.memoryBlobStore.get(templateId);
    return templateBlobs?.get(pageIndex) || null;
  }

  // Save page data to session
  public savePageData(templateId: string, pageIndex: number, pageData: Partial<PageEditData>, imageBlob?: Blob): void {
    const session = this.getOrCreateSession(templateId);
    
    const existingPageData = session.pages[pageIndex] || {
      pageIndex,
      historyLength: 1,
      historyIndex: 0,
      hasChanges: false,
      originalImageExists: true,
      timestamp: Date.now()
    };

    // Update page data
    session.pages[pageIndex] = {
      ...existingPageData,
      ...pageData,
      pageIndex,
      timestamp: Date.now(),
      editedImageBlob: imageBlob || existingPageData.editedImageBlob
    };

    session.lastEditedPage = pageIndex;
    this.saveSession(session);
    
    console.log(`📄 Saved page ${pageIndex} data for template ${templateId}:`, {
      hasChanges: session.pages[pageIndex].hasChanges,
      historyLength: session.pages[pageIndex].historyLength,
      hasBlob: !!imageBlob
    });
  }

  // Get page data from session
  public getPageData(templateId: string, pageIndex: number): PageEditData | null {
    const session = this.getSession(templateId);
    if (!session) return null;

    const pageData = session.pages[pageIndex];
    if (!pageData) return null;

    // Restore blob from memory if available
    const blob = this.getBlobFromMemory(templateId, pageIndex);
    if (blob && !pageData.editedImageBlob) {
      pageData.editedImageBlob = blob;
    }

    return pageData;
  }

  // Get all pages with changes
  public getAllPagesWithChanges(templateId: string): PageEditData[] {
    const session = this.getSession(templateId);
    if (!session) return [];

    return Object.values(session.pages)
      .filter(page => page.hasChanges)
      .sort((a, b) => a.pageIndex - b.pageIndex);
  }

  // Clear session (when user saves or discards)
  public clearSession(templateId: string): void {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${templateId}`;
      sessionStorage.removeItem(sessionKey);
      this.memoryBlobStore.delete(templateId);
      console.log(`🗑️ Cleared session for template ${templateId}`);
    } catch (error) {
      console.warn(`⚠️ Error clearing session for template ${templateId}:`, error);
    }
  }

  // Clean up old sessions
  public cleanupOldSessions(): void {
    try {
      const keysToRemove: string[] = [];
      const now = Date.now();

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.SESSION_KEY_PREFIX)) {
          try {
            const sessionData = sessionStorage.getItem(key);
            if (sessionData) {
              const session = JSON.parse(sessionData);
              const age = now - session.createdAt;
              if (age > this.MAX_SESSION_AGE) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // Invalid data, mark for removal
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`🧹 Removed old session: ${key}`);
      });

      console.log(`🧹 Cleaned up ${keysToRemove.length} old sessions`);
    } catch (error) {
      console.warn('⚠️ Error during session cleanup:', error);
    }
  }

  // Check if template has any unsaved changes
  public hasUnsavedChanges(templateId: string): boolean {
    const session = this.getSession(templateId);
    if (!session) return false;

    return Object.values(session.pages).some(page => page.hasChanges);
  }

  // Get summary of session
  public getSessionSummary(templateId: string): { totalPages: number; pagesWithChanges: number; lastEdited?: number } | null {
    const session = this.getSession(templateId);
    if (!session) return null;

    const pages = Object.values(session.pages);
    return {
      totalPages: pages.length,
      pagesWithChanges: pages.filter(p => p.hasChanges).length,
      lastEdited: session.lastEditedPage
    };
  }
}

// Create a singleton instance
export const sessionDataManager = new SessionDataManager();

// Helper function to convert File to Blob
export const fileToBlob = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: file.type });
      resolve(blob);
    };
    reader.readAsArrayBuffer(file);
  });
};

// Helper function to convert Blob to File
export const blobToFile = (blob: Blob, filename: string): File => {
  return new File([blob], filename, { type: blob.type });
};