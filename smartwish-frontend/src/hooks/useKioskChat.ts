'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useKiosk } from '@/contexts/KioskContext';

export interface ChatMessage {
  id: string;
  kiosk_id: string;
  sender_type: 'kiosk' | 'admin';
  sender_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

interface UseKioskChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  unreadCount: number;
}

export function useKioskChat(): UseKioskChatReturn {
  const { kioskInfo } = useKiosk();
  // Use kioskInfo.kioskId which is the actual kiosk_id string, not the UUID
  const kioskId = kioskInfo?.kioskId || null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history
  const loadHistory = useCallback(async () => {
    if (!kioskId) {
      console.log('[useKioskChat] loadHistory: No kioskId, skipping');
      return;
    }

    console.log('[useKioskChat] loadHistory: Loading history for', kioskId);
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/kiosk/chat/history?kioskId=${kioskId}&limit=50`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[useKioskChat] API Error:', errorData);
        throw new Error(errorData.error || `Failed to load chat history (${response.status})`);
      }

      const data = await response.json();
      setMessages(data.messages || []);

      // Count unread admin messages
      const unread = (data.messages || []).filter(
        (m: ChatMessage) => m.sender_type === 'admin' && !m.is_read
      ).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('[useKioskChat] Error loading history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  }, [kioskId]);

  // Send message
  const sendMessage = useCallback(
    async (message: string) => {
      if (!kioskId || !message.trim()) return;

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
          sender_type: 'kiosk',
          sender_id: null,
          message: trimmedMessage,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, tempMessage]);

        if (!kioskId) {
          throw new Error('Kiosk ID is not available');
        }

        const response = await fetch('/api/kiosk/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmedMessage, kioskId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to send message');
        }

        const data = await response.json();

        // Replace temp message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? { ...m, id: data.messageId } : m))
        );
      } catch (err) {
        console.error('[useKioskChat] Error sending message:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      }
    },
    [kioskId]
  );

  // Clear history (for idle timeout)
  const clearHistory = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!kioskId || messageIds.length === 0) return;

      try {
        await fetch('/api/kiosk/chat/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kioskId, messageIds }),
        });

        // Update local state
        setMessages((prev) =>
          prev.map((m) => (messageIds.includes(m.id) ? { ...m, is_read: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - messageIds.length));
      } catch (err) {
        console.error('[useKioskChat] Error marking as read:', err);
      }
    },
    [kioskId]
  );

  // Set up real-time subscription via Server-Sent Events
  useEffect(() => {
    console.log('[useKioskChat] Effect running, kioskId:', kioskId);
    
    if (!kioskId) {
      console.log('[useKioskChat] No kioskId, setting isLoading=false, isConnected=false');
      setIsConnected(false);
      setIsLoading(false); // Important: Set loading to false when no kioskId
      return;
    }

    // Load initial history
    console.log('[useKioskChat] Calling loadHistory for kioskId:', kioskId);
    loadHistory();

    // Connect to SSE endpoint for real-time updates
    const eventSource = new EventSource(`/api/kiosk/chat/stream?kioskId=${encodeURIComponent(kioskId)}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useKioskChat] ✅ SSE connection opened');
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      console.error('[useKioskChat] ❌ SSE error:', error);
      setIsConnected(false);
      // EventSource will automatically reconnect
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[useKioskChat] SSE message received:', data);

        if (data.type === 'connected') {
          console.log('[useKioskChat] ✅ Connected to chat stream');
          setIsConnected(true);
        } else if (data.type === 'status') {
          if (data.status === 'connected') {
            setIsConnected(true);
          } else if (data.status === 'disconnected') {
            setIsConnected(false);
            if (data.error) {
              console.error('[useKioskChat] Disconnection error:', data.error);
            }
          }
        } else if (data.type === 'message') {
          const newMessage = data.message as ChatMessage;
          setMessages((prev) => {
            // Avoid duplicates - check both real ID and temp messages with same content
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            // Also check for temp messages that match this message's content
            // (kiosk's own message coming back via SSE before temp replacement)
            if (newMessage.sender_type === 'kiosk') {
              const matchingTemp = prev.find(
                (m) => m.id.startsWith('temp-') && 
                       m.message === newMessage.message &&
                       m.sender_type === 'kiosk'
              );
              if (matchingTemp) {
                // Replace temp message with real one
                return prev.map((m) => 
                  m.id === matchingTemp.id ? newMessage : m
                );
              }
            }
            return [...prev, newMessage];
          });

          // Update unread count if admin message
          if (newMessage.sender_type === 'admin' && !newMessage.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        } else if (data.type === 'message_updated') {
          const updatedMessage = data.message as ChatMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          );
        } else if (data.type === 'heartbeat') {
          // Keep connection alive
          setIsConnected(true);
        }
      } catch (err) {
        console.error('[useKioskChat] Error parsing SSE message:', err);
      }
    };

    return () => {
      console.log('[useKioskChat] Cleaning up SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [kioskId, loadHistory]);

  // Mark admin messages as read when they're displayed
  useEffect(() => {
    const adminMessages = messages.filter(
      (m) => m.sender_type === 'admin' && !m.is_read
    );
    if (adminMessages.length > 0) {
      const messageIds = adminMessages.map((m) => m.id);
      markAsRead(messageIds);
    }
  }, [messages, markAsRead]);

  return {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    clearHistory,
    unreadCount,
  };
}
