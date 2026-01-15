import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/kiosk/chat/stream
 * Server-Sent Events endpoint for real-time kiosk chat updates
 * Backend handles Supabase Realtime subscription and streams updates to frontend
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kioskId = searchParams.get('kioskId');
  const sessionId = searchParams.get('sessionId'); // Session ID for filtering messages

  if (!kioskId) {
    return new Response(
      JSON.stringify({ error: 'kioskId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log('[Kiosk Chat Stream] Starting stream for kiosk:', kioskId, 'session:', sessionId);

  // Verify kiosk exists
  const { data: kiosk, error: kioskError } = await supabaseServer
    .from('kiosk_configs')
    .select('kiosk_id, is_active')
    .eq('kiosk_id', kioskId)
    .single();

  if (kioskError || !kiosk) {
    return new Response(
      JSON.stringify({ error: 'Invalid kiosk ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Track last message timestamp to detect new messages (per connection)
      // Start from 5 seconds ago to avoid race conditions with history loading
      let lastMessageTime = new Date(Date.now() - 5000).toISOString();
      let lastMessageIds = new Set<string>();
      let isControllerClosed = false;

      // Send initial connection message
      const sendMessage = (data: object) => {
        if (isControllerClosed) return;
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('[Kiosk Chat Stream] Error sending message:', error);
          isControllerClosed = true;
        }
      };

      sendMessage({ type: 'connected', kioskId, sessionId });
      sendMessage({ type: 'status', status: 'connected' });

      // Load recent messages to avoid sending duplicates
      // Get messages from the last 30 seconds to build a set of known IDs
      try {
        let recentQuery = supabaseServer
          .from('kiosk_chat_messages')
          .select('id, created_at')
          .eq('kiosk_id', kioskId)
          .gte('created_at', new Date(Date.now() - 30000).toISOString());
        
        // STRICT: Only get messages from this session
        if (sessionId) {
          recentQuery = recentQuery.eq('session_id', sessionId);
        }
        
        const { data: recentMessages } = await recentQuery.order('created_at', { ascending: false });

        if (recentMessages && recentMessages.length > 0) {
          recentMessages.forEach((msg) => lastMessageIds.add(msg.id));
          // Use the most recent message time as baseline if available
          lastMessageTime = recentMessages[0].created_at;
        }
      } catch (error) {
        console.error('[Kiosk Chat Stream] Error loading recent messages:', error);
        // Continue anyway - stream should still work
      }

      let pollInterval: NodeJS.Timeout | null = null;
      let heartbeatInterval: NodeJS.Timeout | null = null;

      // Poll for new messages every 2 seconds
      const pollForMessages = async () => {
        if (isControllerClosed) return;
        
        try {
          // Build query for new messages
          let newMsgQuery = supabaseServer
            .from('kiosk_chat_messages')
            .select('*')
            .eq('kiosk_id', kioskId)
            .gt('created_at', lastMessageTime);
          
          // STRICT: Only get messages from this session
          if (sessionId) {
            newMsgQuery = newMsgQuery.eq('session_id', sessionId);
          }
          
          const { data: newMessages, error } = await newMsgQuery.order('created_at', { ascending: true });

          if (error) {
            console.error('[Kiosk Chat Stream] Poll error:', error);
            return;
          }

          if (newMessages && newMessages.length > 0) {
            // Send new messages
            newMessages.forEach((message) => {
              if (!lastMessageIds.has(message.id)) {
                sendMessage({
                  type: 'message',
                  message,
                });
                lastMessageIds.add(message.id);
              }
            });

            // Update last message time
            const latestMessage = newMessages[newMessages.length - 1];
            lastMessageTime = latestMessage.created_at;
          }

          // Also check for updated messages (read status changes)
          let updatedQuery = supabaseServer
            .from('kiosk_chat_messages')
            .select('*')
            .eq('kiosk_id', kioskId)
            .gt('updated_at', lastMessageTime);
          
          // STRICT: Only get messages from this session
          if (sessionId) {
            updatedQuery = updatedQuery.eq('session_id', sessionId);
          }
          
          const { data: updatedMessages } = await updatedQuery.order('updated_at', { ascending: true });

          if (updatedMessages && updatedMessages.length > 0) {
            updatedMessages.forEach((message) => {
              sendMessage({
                type: 'message_updated',
                message,
              });
            });
          }
        } catch (error) {
          console.error('[Kiosk Chat Stream] Poll error:', error);
        }
      };

      // Start polling
      pollInterval = setInterval(pollForMessages, 2000); // Poll every 2 seconds

      // Handle client disconnect
      const cleanup = () => {
        if (isControllerClosed) return;
        isControllerClosed = true;
        console.log('[Kiosk Chat Stream] Cleaning up');
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        try {
          controller.close();
        } catch (error) {
          // Controller may already be closed
        }
      };

      request.signal.addEventListener('abort', cleanup);

      // Keep connection alive with periodic heartbeat
      heartbeatInterval = setInterval(() => {
        try {
          sendMessage({ type: 'heartbeat', timestamp: Date.now() });
        } catch (error) {
          // Client disconnected
          cleanup();
        }
      }, 30000); // Every 30 seconds

      // Note: Don't return anything here - the stream stays open until cleanup is called
    },
    cancel() {
      console.log('[Kiosk Chat Stream] Stream cancelled by client');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  });
}
