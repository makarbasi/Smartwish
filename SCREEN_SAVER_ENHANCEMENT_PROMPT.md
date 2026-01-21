# Screen Saver Enhancement Prompt

## Overview

I need you to make a significant change to the screen saver mechanism in my Smartwish kiosk application. The current implementation has a single hardcoded screen saver component (`KioskScreenSaver.tsx`). I want to transform this into a flexible, configurable multi-screen-saver system.

---

## Design Decisions (Confirmed)

1. **HTML screen savers storage**: Store in **Supabase Storage** (not local `public/` folder)
2. **Admin UI**: Required now - full UI to configure screen savers per kiosk
3. **"None" type behavior**: Just **hide the screen saver overlay** (don't navigate anywhere)
4. **Analytics**: None needed - screen savers only show when **no session is active**
5. **Sound**: Always **muted** - no sound support for videos

---

## Current Implementation Summary

**Key files:**
- `smartwish-frontend/src/components/KioskScreenSaver.tsx` - Single hardcoded screen saver with card showcase
- `smartwish-frontend/src/hooks/useKioskInactivity.tsx` - Handles inactivity detection, screen saver triggering, and timeout
- `smartwish-frontend/src/components/AppChrome.tsx` - Renders the screen saver component
- `smartwish-frontend/src/utils/kioskConfig.ts` - Kiosk configuration types (has `ads.playlist` already)
- `smartwish-backend/backend/src/kiosks/kiosk-config.entity.ts` - Backend kiosk config entity with JSONB `config` field

**Current behavior:**
- After 60 seconds of inactivity, `KioskScreenSaver` appears (currently disabled via `SCREEN_SAVER_DISABLED = true`)
- Single screen saver design showing card templates and handwriting demo
- Theme-aware (Christmas vs default based on date)
- Screen savers only trigger when there is NO active kiosk session

---

## New Requirements

### 1. Multiple Screen Savers Per Kiosk

Each kiosk should support **multiple screen savers** configured in the kiosk configuration. The screen savers rotate based on their configured weights.

**Screen saver types:**
- **Video** - A video URL (YouTube, direct video link, or hosted file)
- **HTML** - A custom HTML page (either a URL to a hosted page, or generated/saved HTML content)
- **Default** - The existing `KioskScreenSaver.tsx` component (card showcase)
- **None** - Shows `/kiosk/home` page instead of a screen saver (for interleaving)

### 2. Weight-Based Rotation

- Each screen saver has a **weight** (number, e.g., 1-100)
- Higher weight = shown more frequently
- Screen savers rotate one after another, with probability based on weight
- Example: If screen saver A has weight 3 and B has weight 1, A shows 75% of the time, B shows 25%

### 3. Interleaving with Home Page

Admin can configure "no screen saver" periods by adding a screen saver entry with type `"none"` or `"home"`:
- When selected (based on weight), instead of showing a screen saver, the system shows `/kiosk/home`
- This allows the kiosk to cycle between screen savers and the home page

### 4. Generated HTML Screen Savers

When I ask you to generate a screen saver with specific materials (videos, images, text), you should:
1. Generate a complete HTML page with embedded assets or asset URLs
2. Upload the HTML file to **Supabase Storage** (`screensavers` bucket)
3. Provide me the public URL to use in the configuration

**Generated screen saver requirements:**
- Fullscreen, no scroll, touch-to-dismiss
- Responsive design for kiosk displays (typically portrait 1080x1920 or landscape 1920x1080)
- Can include: background videos, images, text overlays, animations, CSS effects
- Modern, visually appealing design
- All videos must be **muted** (no sound)

### 5. Session Awareness

- Screen savers **only show when there is NO active kiosk session**
- When a user starts interacting (session begins), screen saver is dismissed and won't reappear until session ends
- The inactivity timer only starts counting when there's no active session

---

## Data Model Changes

### Kiosk Configuration Schema

Update the `config` JSONB field in `kiosk_configs` table to include:

```typescript
interface ScreenSaverItem {
  id: string;                    // Unique identifier
  type: 'video' | 'html' | 'default' | 'none';
  name?: string;                 // Display name for admin UI
  url?: string;                  // Video URL or HTML page URL (for video/html types)
  weight: number;                // Weight for rotation (1-100)
  duration?: number;             // How long to show this screen saver (seconds) before rotating
  enabled?: boolean;             // Whether this screen saver is active
}

interface KioskConfig {
  // ... existing fields ...
  screenSavers: ScreenSaverItem[];
  screenSaverSettings?: {
    inactivityTimeout?: number;   // Seconds before screen saver activates (default: 60)
    rotationInterval?: number;    // Seconds between screen saver rotations (default: 30)
    enableRotation?: boolean;     // Whether to rotate or stick with one (default: true)
  };
}
```

### Example Configuration

```json
{
  "screenSavers": [
    {
      "id": "ss-1",
      "type": "video",
      "name": "Promo Video",
      "url": "https://example.com/videos/promo.mp4",
      "weight": 50,
      "duration": 30,
      "enabled": true
    },
    {
      "id": "ss-2", 
      "type": "html",
      "name": "Holiday Special",
      "url": "/screensavers/holiday-2024.html",
      "weight": 30,
      "duration": 20,
      "enabled": true
    },
    {
      "id": "ss-3",
      "type": "default",
      "name": "Card Showcase",
      "weight": 15,
      "duration": 25,
      "enabled": true
    },
    {
      "id": "ss-4",
      "type": "none",
      "name": "Show Home Page",
      "weight": 5,
      "duration": 15,
      "enabled": true
    }
  ],
  "screenSaverSettings": {
    "inactivityTimeout": 60,
    "rotationInterval": 30,
    "enableRotation": true
  }
}
```

---

## Implementation Plan

### Phase 1: Supabase Storage Setup

1. Create `screensavers` bucket in Supabase Storage
2. Set up public access policies for the bucket
3. Create API endpoint or utility for uploading HTML screen savers

### Phase 2: Data Model & Configuration

1. Update `smartwish-frontend/src/utils/kioskConfig.ts`:
   - Add `ScreenSaverItem` interface
   - Add `screenSavers` and `screenSaverSettings` to `KioskConfig` type
   - Add default values

2. Update backend DTO if needed (`update-kiosk-config.dto.ts`)

3. Create migration (if necessary) to set default values for existing kiosks

### Phase 3: Screen Saver Manager Component

Create a new `KioskScreenSaverManager.tsx` component that:
- Reads screen saver configuration from kiosk context
- Checks if there's an active session (don't show if session is active)
- Implements weighted random selection algorithm
- Manages rotation timing
- Renders the appropriate screen saver type:
  - `video`: Renders a fullscreen video player (muted, autoplay, loop)
  - `html`: Renders an iframe with the HTML page URL
  - `default`: Renders the existing `KioskScreenSaver` component
  - `none`: Hides the screen saver overlay (shows underlying page)

### Phase 4: Individual Screen Saver Renderers

Create renderer components:
- `VideoScreenSaver.tsx` - Fullscreen video with autoplay, loop, **always muted**, touch-to-dismiss
- `HtmlScreenSaver.tsx` - Fullscreen iframe with touch-to-dismiss overlay
- Keep existing `KioskScreenSaver.tsx` as the "default" type

### Phase 5: Update Inactivity Hook

Modify `useKioskInactivity.tsx` to:
- Read timeout from kiosk config (`screenSaverSettings.inactivityTimeout`)
- Support rotation interval
- Handle "none" type (just hide the overlay)
- Only activate when there's no active kiosk session

### Phase 6: Admin UI for Screen Saver Management

Create admin UI at `/admin/kiosks/[kioskId]/screensavers` or as a tab in the kiosk detail page:

**Features:**
- List all configured screen savers with drag-to-reorder
- Add new screen saver (select type: video, html, default, none)
- Edit existing screen saver (name, url, weight, duration, enabled toggle)
- Delete screen saver
- Preview screen saver in a modal
- Upload HTML files directly to Supabase storage
- Enter video URLs (YouTube, direct MP4, etc.)
- Configure global settings (inactivity timeout, rotation interval)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│ Screen Savers for Kiosk: [Kiosk Name]                       │
├─────────────────────────────────────────────────────────────┤
│ Settings:                                                   │
│   Inactivity Timeout: [60] seconds                          │
│   Rotation Interval:  [30] seconds                          │
│   Enable Rotation:    [✓]                                   │
├─────────────────────────────────────────────────────────────┤
│ Screen Savers:                                    [+ Add]   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ≡ 1. Promo Video          Video    Weight: 50   [✓] ✎ 🗑│ │
│ │     https://example.com/promo.mp4                       │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ≡ 2. Holiday Special      HTML     Weight: 30   [✓] ✎ 🗑│ │
│ │     screensavers/holiday-2024.html                      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ≡ 3. Card Showcase        Default  Weight: 15   [✓] ✎ 🗑│ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ≡ 4. No Screen Saver      None     Weight: 5    [✓] ✎ 🗑│ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Add/Edit Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│ Add Screen Saver                                      [X]   │
├─────────────────────────────────────────────────────────────┤
│ Name:     [Holiday Promo                    ]               │
│                                                             │
│ Type:     ( ) Video  ( ) HTML  ( ) Default  ( ) None        │
│                                                             │
│ [If Video selected:]                                        │
│ Video URL: [https://example.com/video.mp4   ]               │
│                                                             │
│ [If HTML selected:]                                         │
│ HTML Source:                                                │
│   ( ) Upload HTML file  [Choose File]                       │
│   ( ) Enter URL         [https://...        ]               │
│   ( ) Generate new      [Open Generator]                    │
│                                                             │
│ Weight:   [50] (1-100, higher = more frequent)              │
│ Duration: [30] seconds                                      │
│ Enabled:  [✓]                                               │
│                                                             │
│                              [Cancel]  [Save Screen Saver]  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 7: Screen Saver Generator Tool

Create a utility/prompt workflow where:
- I provide materials (images, video URLs, text content, theme preferences)
- You generate a complete HTML screen saver file
- Upload it to Supabase Storage (`screensavers` bucket)
- Return the public URL to use in configuration

---

## File Structure

```
smartwish-frontend/
├── src/
│   ├── app/
│   │   └── admin/
│   │       └── kiosks/
│   │           └── [kioskId]/
│   │               └── screensavers/
│   │                   └── page.tsx           # Admin UI for screen saver management
│   ├── components/
│   │   ├── screensavers/
│   │   │   ├── KioskScreenSaverManager.tsx    # Main orchestrator
│   │   │   ├── VideoScreenSaver.tsx           # Video renderer (always muted)
│   │   │   ├── HtmlScreenSaver.tsx            # HTML/iframe renderer
│   │   │   └── DefaultScreenSaver.tsx         # Renamed from KioskScreenSaver.tsx
│   │   ├── admin/
│   │   │   ├── ScreenSaverList.tsx            # Admin list component
│   │   │   ├── ScreenSaverForm.tsx            # Add/Edit form modal
│   │   │   └── ScreenSaverPreview.tsx         # Preview modal
│   │   └── KioskScreenSaver.tsx               # Keep as alias or update imports
│   ├── hooks/
│   │   └── useKioskInactivity.tsx             # Updated with config support
│   └── utils/
│       ├── kioskConfig.ts                     # Updated types
│       └── screenSaverUtils.ts                # Weight selection, Supabase upload, etc.

smartwish-backend/
├── backend/
│   └── src/
│       └── kiosks/
│           └── dto/
│               └── update-kiosk-config.dto.ts # Updated with screen saver types

Supabase Storage:
└── screensavers/                              # Bucket for HTML screen savers
    └── [kiosk-id]/                            # Organized by kiosk
        └── [screensaver-name].html
```

---

## Screen Saver Generator Instructions

When I ask you to generate a screen saver, I will provide:

**Required:**
- Theme/purpose (e.g., "Valentine's Day promo", "Store grand opening")

**Optional materials:**
- Background video URL
- Images (URLs or descriptions to use stock/placeholder)
- Text content (headlines, taglines, CTAs)
- Color scheme preferences
- Animation style (subtle, dynamic, minimal)
- Aspect ratio (portrait kiosk, landscape, both)

**You should generate:**
1. A complete, self-contained HTML file
2. Modern CSS animations and effects
3. Responsive design
4. Touch-to-dismiss functionality (sends event to parent or uses a data attribute)
5. Optimized for kiosk displays

**Example request:**
> "Generate a Valentine's Day screen saver with:
> - Background: soft pink gradient with floating hearts
> - Main text: 'Share the Love' (large, elegant font)
> - Subtext: 'Custom Valentine's Cards - Print Instantly'
> - Include a subtle heart animation
> - Portrait orientation (1080x1920)"

---

## Key Considerations

1. **Performance**: Screen savers should be lightweight, especially on kiosk hardware
2. **Touch handling**: All screen savers must respond to touch/click to dismiss
3. **Video handling**: Videos should autoplay, **always muted**, and loop
4. **Iframe security**: HTML screen savers in iframes need proper sandboxing
5. **Fallback**: If a screen saver fails to load, fall back to default or next in rotation
6. **Offline support**: Consider caching for offline kiosk scenarios
7. **Session awareness**: Screen savers only show when NO kiosk session is active
8. **Supabase storage**: HTML screen savers stored in Supabase Storage for easy management

---

## Testing Checklist

- [ ] Single screen saver works (video, html, default, none types)
- [ ] Multiple screen savers rotate correctly
- [ ] Weight-based selection distributes correctly over time
- [ ] "None" type hides the overlay correctly
- [ ] Duration-based rotation works
- [ ] Touch/click dismisses all screen saver types
- [ ] Configuration changes apply without restart
- [ ] Fallback works when screen saver URL fails
- [ ] Admin UI can add/edit/delete screen savers
- [ ] Admin UI can reorder screen savers
- [ ] Admin UI can upload HTML files to Supabase
- [ ] Admin UI can preview screen savers
- [ ] Screen saver does NOT show during active kiosk session
- [ ] Videos are always muted

---

## Confirmed Decisions

| Question | Decision |
|----------|----------|
| HTML screen saver storage | **Supabase Storage** (`screensavers` bucket) |
| Admin UI | **Required now** - full UI to configure per kiosk |
| "None" type behavior | **Hide overlay** (don't navigate) |
| Analytics | **None** - screen savers only show when no session |
| Sound | **Always muted** - no audio support |

---

## API Endpoints Needed

### Frontend API Routes (Next.js)

```
POST   /api/admin/screensavers/upload
       - Upload HTML file to Supabase Storage
       - Returns public URL

DELETE /api/admin/screensavers/[filename]
       - Delete HTML file from Supabase Storage
```

### Backend Endpoints (existing kiosk config endpoints should suffice)

The screen saver configuration is stored in the `config` JSONB field of `kiosk_configs` table, so existing update endpoints should work:

```
PATCH  /kiosk/config/:kioskId
       - Update kiosk config including screenSavers array
```

---

## Migration Notes

For existing kiosks without screen saver configuration:
- Default to showing the existing `KioskScreenSaver` (type: "default") with weight 100
- This maintains backward compatibility
- Admin can then customize via the new UI
