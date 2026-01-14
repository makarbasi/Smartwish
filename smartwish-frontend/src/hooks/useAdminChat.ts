'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  kiosk_id: string;
  session_id?: string | null; // Session ID for isolating user chats
  sender_type: 'kiosk' | 'admin';
  sender_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface KioskChatInfo {
  kioskId: string;
  name: string;
  storeId: string | null;
  unreadCount: number;
  lastMessage: {
    message: string;
    createdAt: string;
    senderType: 'kiosk' | 'admin';
  } | null;
}

interface UseAdminChatReturn {
  kiosks: KioskChatInfo[];
  messages: Record<string, ChatMessage[]>; // keyed by kioskId
  isLoading: boolean;
  isLoadingMessages: Record<string, boolean>;
  isConnected: boolean;
  error: string | null;
  selectedKioskId: string | null;
  selectKiosk: (kioskId: string) => void;
  sendMessage: (kioskId: string, message: string) => Promise<void>;
  loadMessages: (kioskId: string, forceRefresh?: boolean) => Promise<void>;
  markAsRead: (kioskId: string) => Promise<void>;
  refreshKiosks: () => Promise<void>;
}

export function useAdminChat(): UseAdminChatReturn {
  const [kiosks, setKiosks] = useState<KioskChatInfo[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<Record<string, boolean>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Track current session per kiosk to detect new sessions
  const currentSessionsRef = useRef<Record<string, string | null>>({});

  // Load list of kiosks with chats
  const loadKiosks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/chat/kiosks');
      if (!response.ok) {
        throw new Error('Failed to load kiosks');
      }

      const data = await response.json();
      setKiosks(data.kiosks || []);
    } catch (err) {
      console.error('[useAdminChat] Error loading kiosks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load kiosks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load messages for a specific kiosk
  const loadMessages = useCallback(async (kioskId: string, forceRefresh = false) => {
    if (messages[kioskId] && !forceRefresh) {
      // Already loaded and no refresh requested
      return;
    }

    try {
      setIsLoadingMessages((prev) => ({ ...prev, [kioskId]: true }));
      setError(null);

      const response = await fetch(`/api/admin/chat/messages/${kioskId}?limit=50`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      const loadedMessages = data.messages || [];
      
      // Track the current session for this kiosk
      const firstKioskMessage = loadedMessages.find((m: ChatMessage) => m.sender_type === 'kiosk' && m.session_id);
      if (firstKioskMessage?.session_id) {
        currentSessionsRef.current[kioskId] = firstKioskMessage.session_id;
        console.log(`[useAdminChat] Tracking session ${firstKioskMessage.session_id} for kiosk ${kioskId}`);
      }
      
      setMessages((prev) => ({
        ...prev,
        [kioskId]: loadedMessages,
      }));
    } catch (err) {
      console.error('[useAdminChat] Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoadingMessages((prev) => ({ ...prev, [kioskId]: false }));
    }
  }, [messages]);

  // Send message
  const sendMessage = useCallback(
    async (kioskId: string, message: string) => {
      if (!message.trim()) return;

      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0 || trimmedMessage.length > 1000) {
        setError('Message must be between 1 and 1000 characters');
        return;
      }

      try {
        setError(null);

        // Optimistically add message
        const tempMessage: ChatMessage = {
          id: `temp-${Date.now()}`,
          kiosk_id: kioskId,
          sender_type: 'admin',
          sender_id: null,
          message: trimmedMessage,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => ({
          ...prev,
          [kioskId]: [...(prev[kioskId] || []), tempMessage],
        }));

        const response = await fetch('/api/admin/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kioskId, message: trimmedMessage }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();

        // Replace temp message with real one
        setMessages((prev) => ({
          ...prev,
          [kioskId]: (prev[kioskId] || []).map((m) =>
            m.id === tempMessage.id ? { ...m, id: data.messageId } : m
          ),
        }));

        // Update kiosks list
        await loadKiosks();
      } catch (err) {
        console.error('[useAdminChat] Error sending message:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
        // Remove temp message on error
        setMessages((prev) => ({
          ...prev,
          [kioskId]: (prev[kioskId] || []).filter((m) => !m.id.startsWith('temp-')),
        }));
      }
    },
    [loadKiosks]
  );

  // Mark messages as read
  const markAsRead = useCallback(async (kioskId: string) => {
    try {
      await fetch(`/api/admin/chat/mark-read/${kioskId}`, {
        method: 'POST',
      });

      // Update local state
      setMessages((prev) => ({
        ...prev,
        [kioskId]: (prev[kioskId] || []).map((m) =>
          m.sender_type === 'kiosk' ? { ...m, is_read: true } : m
        ),
      }));

      // Update kiosks list
      await loadKiosks();
    } catch (err) {
      console.error('[useAdminChat] Error marking as read:', err);
    }
  }, [loadKiosks]);

  // Select kiosk and load messages
  const selectKiosk = useCallback(
    (kioskId: string) => {
      setSelectedKioskId(kioskId);
      // Always force refresh to get the latest session's messages
      loadMessages(kioskId, true);
      markAsRead(kioskId);
    },
    [loadMessages, markAsRead]
  );

  // Set up real-time subscription via Server-Sent Events
  useEffect(() => {
    // Load initial kiosks list
    loadKiosks();

    // Connect to SSE endpoint for real-time updates
    const eventSource = new EventSource('/api/admin/chat/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useAdminChat] ✅ SSE connection opened');
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      console.error('[useAdminChat] ❌ SSE error:', error);
      setIsConnected(false);
      // EventSource will automatically reconnect
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[useAdminChat] SSE message received:', data);

        if (data.type === 'connected') {
          console.log('[useAdminChat] ✅ Connected to chat stream');
          setIsConnected(true);
        } else if (data.type === 'status') {
          if (data.status === 'connected') {
            setIsConnected(true);
          } else if (data.status === 'disconnected') {
            setIsConnected(false);
            if (data.error) {
              console.error('[useAdminChat] Disconnection error:', data.error);
            }
          }
        } else if (data.type === 'message') {
          const newMessage = data.message as ChatMessage;
          const kioskId = newMessage.kiosk_id;
          const messageSessionId = newMessage.session_id;
          const currentSession = currentSessionsRef.current[kioskId];

          // Check if this is a message from a NEW session
          if (newMessage.sender_type === 'kiosk' && messageSessionId && currentSession && messageSessionId !== currentSession) {
            console.log(`[useAdminChat] 🔄 NEW SESSION detected for kiosk ${kioskId}: ${messageSessionId} (was: ${currentSession})`);
            // New session started - clear old messages and update session
            currentSessionsRef.current[kioskId] = messageSessionId;
            setMessages((prev) => ({
              ...prev,
              [kioskId]: [newMessage], // Start fresh with just the new message
            }));
            loadKiosks();
            return;
          }

          // Track session if this is the first message from this kiosk
          if (newMessage.sender_type === 'kiosk' && messageSessionId && !currentSession) {
            currentSessionsRef.current[kioskId] = messageSessionId;
            console.log(`[useAdminChat] Tracking initial session ${messageSessionId} for kiosk ${kioskId}`);
          }

          // Add message to the appropriate kiosk's messages
          setMessages((prev) => {
            const existingMessages = prev[kioskId] || [];
            // Avoid duplicates - check both real ID and temp messages with same content
            if (existingMessages.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            // Also check for temp messages that match this message's content
            // (admin's own message coming back via SSE before temp replacement)
            if (newMessage.sender_type === 'admin') {
              const matchingTemp = existingMessages.find(
                (m) => m.id.startsWith('temp-') && 
                       m.message === newMessage.message &&
                       m.sender_type === 'admin'
              );
              if (matchingTemp) {
                // Replace temp message with real one
                return {
                  ...prev,
                  [kioskId]: existingMessages.map((m) => 
                    m.id === matchingTemp.id ? newMessage : m
                  ),
                };
              }
            }
            return {
              ...prev,
              [kioskId]: [...existingMessages, newMessage],
            };
          });

          // Refresh kiosks list to update unread counts
          loadKiosks();
        } else if (data.type === 'message_updated') {
          const updatedMessage = data.message as ChatMessage;
          const kioskId = updatedMessage.kiosk_id;
          setMessages((prev) => ({
            ...prev,
            [kioskId]: (prev[kioskId] || []).map((m) =>
              m.id === updatedMessage.id ? updatedMessage : m
            ),
          }));
        } else if (data.type === 'heartbeat') {
          // Keep connection alive
          setIsConnected(true);
        }
      } catch (err) {
        console.error('[useAdminChat] Error parsing SSE message:', err);
      }
    };

    return () => {
      console.log('[useAdminChat] Cleaning up SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [loadKiosks]);

  return {
    kiosks,
    messages,
    isLoading,
    isLoadingMessages,
    isConnected,
    error,
    selectedKioskId,
    selectKiosk,
    sendMessage,
    loadMessages,
    markAsRead,
    refreshKiosks: loadKiosks,
  };
}
