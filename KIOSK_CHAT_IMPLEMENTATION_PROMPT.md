# Kiosk Chat System Implementation Prompt

## Overview
Implement a real-time chat system that allows kiosk users to communicate with admin users. The system should support multiple kiosks chatting simultaneously with the admin panel, with each kiosk maintaining its own chat history and session.

## Requirements

### 1. Frontend - Kiosk Side

#### 1.1 Floating Chat Button
- **Location**: Bottom right corner of the screen
- **Original Position**: `position: fixed; bottom: 24px; right: 24px;` (this is the default/restored position)
- **Visibility**: 
  - Visible on `/kiosk/home` page
  - Visible on kiosk sub-pages: `/templates`, `/stickers`, `/my-cards`, and any other kiosk routes
  - Hidden on admin pages (`/admin/*`), manager pages (`/manager/*`), and non-kiosk pages
- **Design**:
  - Circular button with chat icon (e.g., ChatBubbleLeftRightIcon from Heroicons)
  - Fixed position: `position: fixed; bottom: 24px; right: 24px;`
  - Size: 56px × 56px (or appropriate size)
  - Background: Primary brand color (indigo/blue)
  - Shadow: Elevated shadow for visibility
  - Z-index: High enough to appear above other content (e.g., 9999)
  - Hover effect: Scale up slightly on hover
  - Optional: Badge indicator showing unread message count (if admin sent messages while chat was closed)
- **Animation**: Smooth entrance animation when page loads
- **Timeout Behavior**: When idle timeout occurs, if chat window is open, close it and return the floating chat button to its original position (bottom: 24px, right: 24px)

#### 1.2 Chat Window Component
- **Trigger**: Opens when floating button is clicked
- **Position**: Bottom right corner, anchored to the chat button
- **Size**: 
  - Mobile: Full width minus padding, max height 80vh
  - Desktop: 400px width, 600px height (or responsive)
- **Layout**:
  - Header: Shows "Chat Support" or similar title, close button (X icon)
  - Messages area: Scrollable container showing chat history
  - Input area: Text input field with send button at bottom
- **Message Display**:
  - User messages: Right-aligned, different color (e.g., blue/indigo)
  - Admin messages: Left-aligned, different color (e.g., gray)
  - Timestamp: Show relative time (e.g., "2 minutes ago") or absolute time for older messages
  - Message bubbles with rounded corners
  - Show "typing..." indicator when admin is typing
- **Input**:
  - Textarea or input field
  - Send button (or Enter key to send)
  - Character limit: 1000 characters (show counter)
  - Disable send when message is empty
- **States**:
  - Loading: Show spinner while connecting/loading history
  - Connected: Show green indicator
  - Disconnected: Show red indicator with reconnect button
  - Empty state: "Start a conversation..." message

#### 1.3 Integration with Kiosk Pages
- **Component Location**: Add chat components to `AppChrome.tsx` or create a separate `KioskChatProvider` wrapper
- **Conditional Rendering**: Only render chat components when:
  - `isKiosk === true` (from DeviceModeContext)
  - Current path starts with `/kiosk/` OR is `/templates`, `/stickers`, `/my-cards` when in kiosk mode
- **Kiosk Identification**: Use `kioskId` from `KioskContext` to identify which kiosk is chatting
- **Route Handling**: Chat should persist across navigation within kiosk pages (maintain connection and history)

#### 1.4 Idle Timeout Handling
- **Integration**: Connect with `useKioskInactivity` hook
- **Behavior**: 
  - When kiosk inactivity timeout triggers (default 90 seconds), clear chat history from UI
  - Clear chat history when `navigateToHome()` is called in inactivity handler
  - Clear chat history when session timeout occurs
  - **Important**: Only clear UI history, NOT database history (admin should still see full history)
  - **Chat Window State**: When timeout occurs, close the chat window if it's open and return the floating chat button to its original position (bottom right corner)
- **Implementation**:
  - Listen to inactivity timeout events
  - Clear local state/messages array
  - Close chat window and reset button position
  - Optionally show a message: "Chat history cleared due to inactivity"
  - Keep WebSocket connection alive (or reconnect) if chat window is open

### 2. Backend - Real-time Communication

#### 2.1 Technology Choice
- **Option A**: Use Supabase Realtime (recommended, since you're already using Supabase)
  - Create `kiosk_chat_messages` table
  - Use Supabase Realtime subscriptions for live updates
  - Backend API routes for sending messages
- **Option B**: WebSocket (Socket.io or native WebSocket)
  - Requires WebSocket server setup
  - More control but more complex

#### 2.2 Database Schema
Create `kiosk_chat_messages` table:
```sql
CREATE TABLE kiosk_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id VARCHAR(128) NOT NULL REFERENCES kiosk_configs(kiosk_id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('kiosk', 'admin')),
    sender_id UUID, -- NULL for kiosk, user_id for admin
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kiosk_chat_messages_kiosk_id ON kiosk_chat_messages(kiosk_id, created_at DESC);
CREATE INDEX idx_kiosk_chat_messages_unread ON kiosk_chat_messages(kiosk_id, is_read) WHERE is_read = false;
```

Optional: `kiosk_chat_sessions` table to track active chat sessions:
```sql
CREATE TABLE kiosk_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id VARCHAR(128) NOT NULL REFERENCES kiosk_configs(kiosk_id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kiosk_chat_sessions_active ON kiosk_chat_sessions(kiosk_id, is_active) WHERE is_active = true;
```

#### 2.3 API Endpoints

**Kiosk Side:**
- `POST /api/kiosk/chat/send` - Send message from kiosk
  - Body: `{ message: string }`
  - Auth: Uses kioskId from context/localStorage
  - Response: `{ success: boolean, messageId: string }`

- `GET /api/kiosk/chat/history` - Get chat history for kiosk
  - Query: `?limit=50&before=messageId` (for pagination)
  - Auth: Uses kioskId from context
  - Response: `{ messages: Array<ChatMessage> }`

- `POST /api/kiosk/chat/mark-read` - Mark messages as read
  - Body: `{ messageIds: string[] }`
  - Auth: Uses kioskId from context

**Admin Side:**
- `GET /api/admin/chat/kiosks` - List all kiosks with active chats
  - Response: `{ kiosks: Array<{ kioskId: string, name: string, unreadCount: number, lastMessageAt: string }> }`
  - Auth: Admin role required

- `GET /api/admin/chat/messages/:kioskId` - Get chat history for specific kiosk
  - Query: `?limit=50&before=messageId`
  - Auth: Admin role required
  - Response: `{ messages: Array<ChatMessage> }`

- `POST /api/admin/chat/send` - Send message from admin to kiosk
  - Body: `{ kioskId: string, message: string }`
  - Auth: Admin role required
  - Response: `{ success: boolean, messageId: string }`

- `POST /api/admin/chat/mark-read/:kioskId` - Mark all messages as read for a kiosk
  - Auth: Admin role required

#### 2.4 Real-time Updates
- **Kiosk Side**: Subscribe to Supabase Realtime channel: `kiosk-chat-{kioskId}`
  - Listen for INSERT events on `kiosk_chat_messages` where `kiosk_id = currentKioskId`
  - Update UI when new messages arrive
  - Show notification badge if chat window is closed

- **Admin Side**: Subscribe to Supabase Realtime channel: `admin-chat-{kioskId}` (or global admin channel)
  - Listen for INSERT events on `kiosk_chat_messages` where `sender_type = 'kiosk'`
  - Update active chat windows when new messages arrive
  - Show unread indicators

### 3. Frontend - Admin Side

#### 3.1 Admin Chat Interface
- **Location**: New page at `/admin/chat` or add to existing admin dashboard
- **Layout**: 
  - Left sidebar: List of kiosks with active chats
    - Show kiosk name, unread count badge, last message preview, timestamp
    - Highlight active/selected kiosk
    - Search/filter kiosks
  - Right panel: Chat window for selected kiosk
    - Similar to kiosk chat window but shows kiosk name in header
    - Show kiosk info (name, location, etc.) in header
    - Message input at bottom
    - Show typing indicator when kiosk user is typing (if implemented)

#### 3.2 Multi-Kiosk Support
- **Tabbed Interface** (Optional): Allow admin to open multiple kiosk chats in tabs
- **Window Management**: 
  - Each kiosk chat maintains its own state
  - Switching between kiosks doesn't lose context
  - Unread counts persist per kiosk
- **Notifications**: 
  - Show browser notification when new message arrives (if tab is not focused)
  - Play sound notification (optional, configurable)
  - Update page title with unread count: "(3) Admin Chat"

#### 3.3 Admin Chat Features
- **Message Actions**:
  - Copy message text
  - View full message history (with pagination)
  - Export chat history (optional)
- **Kiosk Status**: Show if kiosk is online/offline (based on heartbeat)
- **Quick Actions**: 
  - Mark all as read
  - Clear chat (admin-side only, doesn't affect kiosk)
  - Archive chat (optional)

### 4. Edge Cases & Error Handling

#### 4.1 Connection Issues
- **WebSocket/Realtime Disconnection**:
  - Show "Disconnected" indicator
  - Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
  - Queue messages locally when disconnected, send when reconnected
  - Show "Reconnecting..." message

- **Network Errors**:
  - Show user-friendly error messages
  - Retry failed API calls
  - Don't lose messages if send fails (keep in input or queue)

#### 4.2 Multiple Instances
- **Same Kiosk, Multiple Tabs**: 
  - All tabs should receive real-time updates
  - Only one tab should mark messages as read (or sync read status)
  - Consider using BroadcastChannel API for cross-tab communication

- **Admin Multiple Tabs**:
  - Sync unread counts across tabs
  - Only one tab should play notification sound
  - Use BroadcastChannel or localStorage events for sync

#### 4.3 Message Ordering
- **Ensure Correct Order**:
  - Use `created_at` timestamp for ordering
  - Handle clock skew between client and server
  - Show loading placeholder for messages being sent
  - Update placeholder with actual message when server confirms

#### 4.4 Idle Timeout Edge Cases
- **Chat Open During Timeout**:
  - If chat window is open when timeout occurs, close the chat window
  - Return the floating chat button to its original position (bottom right corner)
  - Clear chat history from UI
  - Show warning message if needed: "Session expired, chat history cleared"
  - User can reopen chat and continue chatting (new session)

- **Messages During Timeout**:
  - If admin sends message during kiosk timeout, message should still be delivered
  - When kiosk reconnects/returns, show new messages
  - Don't clear messages that arrived during timeout
  - Unread badge should appear on chat button if messages arrived while chat was closed

#### 4.5 Kiosk Identification
- **Missing Kiosk ID**:
  - Don't show chat button if `kioskId` is not available
  - Show error if trying to send message without kioskId
  - Log error for debugging

- **Invalid Kiosk ID**:
  - Validate kioskId exists in database
  - Show error if kiosk is deactivated
  - Handle kiosk deletion gracefully

#### 4.6 Message Validation
- **Empty Messages**: Prevent sending empty or whitespace-only messages
- **Message Length**: Enforce character limit (1000 chars)
- **Rate Limiting**: Prevent spam (e.g., max 10 messages per minute)
- **Content Filtering**: Optional profanity filter or content moderation

#### 4.7 Performance
- **Large Chat History**:
  - Implement pagination (load 50 messages at a time)
  - Virtual scrolling for long message lists
  - Lazy load older messages on scroll up
  - Don't load all history at once

- **Memory Management**:
  - Limit in-memory message cache (e.g., last 100 messages)
  - Clear old messages from memory when navigating away
  - Use React.memo for message components

### 5. Security Considerations

#### 5.1 Authentication & Authorization
- **Kiosk Side**: 
  - Verify kioskId from localStorage/context matches database
  - Rate limit messages per kiosk
  - Validate kiosk is active before allowing chat

- **Admin Side**:
  - Require admin role (check NextAuth session)
  - Verify admin has permission to chat with specific kiosk
  - Log all admin messages for audit trail

#### 5.2 Data Protection
- **Message Encryption**: Consider encrypting sensitive messages (optional)
- **PII Handling**: Don't log sensitive user information in messages
- **SQL Injection**: Use parameterized queries
- **XSS Prevention**: Sanitize message content before displaying

#### 5.3 Rate Limiting
- **Per Kiosk**: Max 30 messages per minute
- **Per Admin**: Max 60 messages per minute
- **Global**: Max 1000 messages per hour per kiosk
- Return 429 status code with retry-after header

### 6. Testing Requirements

#### 6.1 Unit Tests
- Chat message component rendering
- Message ordering logic
- Idle timeout clearing logic
- Message validation

#### 6.2 Integration Tests
- Send message from kiosk → Admin receives
- Send message from admin → Kiosk receives
- Multiple kiosks chatting simultaneously
- Real-time updates work correctly
- Idle timeout clears history

#### 6.3 E2E Tests
- Open chat, send message, verify delivery
- Admin opens multiple kiosk chats
- Test reconnection after disconnect
- Test idle timeout behavior

### 7. Implementation Steps

1. **Database Setup**
   - Create migration file for `kiosk_chat_messages` table
   - Create indexes for performance
   - Set up Supabase Realtime (if using Supabase)

2. **Backend API**
   - Create API routes for sending/receiving messages
   - Implement authentication/authorization
   - Set up rate limiting
   - Add error handling

3. **Frontend - Kiosk Chat Component**
   - Create `KioskChatButton` component
   - Create `KioskChatWindow` component
   - Create `useKioskChat` hook for chat logic
   - Integrate with `AppChrome` or create `KioskChatProvider`
   - Connect to real-time updates
   - Handle idle timeout

4. **Frontend - Admin Chat Interface**
   - Create `/admin/chat` page
   - Create `AdminChatSidebar` component
   - Create `AdminChatWindow` component
   - Create `useAdminChat` hook
   - Implement multi-kiosk support
   - Add unread indicators

5. **Integration & Testing**
   - Test end-to-end flow
   - Test edge cases
   - Performance testing
   - Security audit

6. **Polish**
   - Add animations
   - Improve UX (loading states, error messages)
   - Add accessibility features (keyboard navigation, ARIA labels)
   - Mobile responsiveness

### 8. Technical Stack Recommendations

- **Real-time**: Supabase Realtime (already in use) OR Socket.io
- **State Management**: React Context API or Zustand for chat state
- **UI Components**: Tailwind CSS (already in use) + Headless UI or shadcn/ui
- **Icons**: Heroicons (already in use)
- **Date Formatting**: date-fns or dayjs for relative timestamps

### 9. Future Enhancements (Optional)

- File attachments (images, PDFs)
- Typing indicators (show when user is typing)
- Read receipts (show when message is read)
- Chat history search
- Chat templates/quick replies for admin
- Chat analytics (response time, message count, etc.)
- Chat export (CSV/PDF)
- Voice messages
- Screen sharing (for troubleshooting)

---

## Key Files to Create/Modify

### New Files:
- `smartwish-frontend/src/components/KioskChatButton.tsx`
- `smartwish-frontend/src/components/KioskChatWindow.tsx`
- `smartwish-frontend/src/hooks/useKioskChat.ts`
- `smartwish-frontend/src/contexts/KioskChatContext.tsx` (optional)
- `smartwish-frontend/src/app/admin/chat/page.tsx`
- `smartwish-frontend/src/components/admin/AdminChatSidebar.tsx`
- `smartwish-frontend/src/components/admin/AdminChatWindow.tsx`
- `smartwish-frontend/src/hooks/useAdminChat.ts`
- `smartwish-frontend/src/app/api/kiosk/chat/send/route.ts`
- `smartwish-frontend/src/app/api/kiosk/chat/history/route.ts`
- `smartwish-frontend/src/app/api/admin/chat/kiosks/route.ts`
- `smartwish-frontend/src/app/api/admin/chat/messages/[kioskId]/route.ts`
- `smartwish-frontend/src/app/api/admin/chat/send/route.ts`
- `smartwish-backend/backend/supabase_migration.sql` (add chat tables)

### Files to Modify:
- `smartwish-frontend/src/components/AppChrome.tsx` (add chat components)
- `smartwish-frontend/src/hooks/useKioskInactivity.tsx` (integrate chat clearing)
- `smartwish-frontend/src/app/admin/page.tsx` (add chat link/indicator)

---

## Success Criteria

✅ Chat button appears on kiosk pages  
✅ Chat window opens/closes smoothly  
✅ Messages send and receive in real-time  
✅ Each kiosk has separate chat history  
✅ Admin can chat with multiple kiosks simultaneously  
✅ Chat history clears from UI on idle timeout  
✅ Database retains full chat history  
✅ Handles disconnections gracefully  
✅ Works on mobile and desktop  
✅ No performance issues with many messages  
✅ Secure and properly authenticated  
