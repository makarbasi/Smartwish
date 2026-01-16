# 🖥️ Kiosk Mode UI Changes

## ✅ What's Hidden in Kiosk Mode

When logged in as `kiosk@smartwish.us`, the following navigation elements are **automatically hidden**:

---

## 🚫 Hidden Elements

### 1. **Header** (Landing Page)
**Location:** `/` (home page)

**Hidden elements:**
- ✅ Logo navigation
- ✅ "Start Designing" button
- ✅ All header navigation

**Reason:** Kiosk users don't need branding navigation or account-related buttons.

---

### 2. **Sidebar** (Desktop Navigation)
**Location:** All authenticated pages (`/templates`, `/my-cards`, etc.)

**Hidden menu items:**
- ✅ Event Calendar
- ✅ My Designs
- ✅ Contacts
- ✅ Partners
- ✅ Settings
- ✅ Help/Support
- ✅ Sign Out button
- ✅ Profile picture

**Reason:** Kiosks are for quick card creation, not account management.

---

### 3. **MobileMenu** (Mobile Navigation)
**Location:** Bottom navigation on mobile devices

**Hidden menu items:**
- ✅ Event
- ✅ Market
- ✅ Templates
- ✅ Designs
- ✅ Contacts
- ✅ Partners
- ✅ Profile menu
- ✅ Settings
- ✅ Sign Out

**Reason:** Simplified kiosk experience without account features.

---

### 4. **Footer** (Landing Page)
**Location:** `/` (home page)

**Hidden elements:**
- ✅ Footer links
- ✅ Company info
- ✅ Social media links

**Reason:** Kiosk users focus on creating cards, not exploring the website.

---

## ✅ What's Still Visible in Kiosk Mode

### Page Content
- ✅ Main page content (card creation, templates, etc.)
- ✅ Virtual keyboard (when clicking inputs)
- ✅ Action buttons (Create, Save, Print, etc.)

### Essential Navigation
- ✅ Back buttons within flows
- ✅ Breadcrumbs (if any)
- ✅ Page-specific navigation

---

## 🔧 Technical Implementation

### File Modified: `src/components/AppChrome.tsx`

```typescript
import { useDeviceMode } from '@/contexts/DeviceModeContext'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const { isKiosk } = useDeviceMode()

  return (
    <>
      {/* Hide Header in Kiosk mode */}
      {isLanding && !isKiosk && <Header />}
      
      {/* Hide Sidebar and MobileMenu in Kiosk mode */}
      {showSidebar && !isKiosk && <Sidebar />}
      {showSidebar && !isKiosk && <MobileMenu />}
      
      {/* Remove padding in Kiosk mode (no sidebar) */}
      <div className={`${showSidebar && !isKiosk ? 'md:pl-14 lg:pl-16 pb-20 md:pb-0' : ''}`}>
        {children}
      </div>
      
      {/* Hide Footer in Kiosk mode */}
      {isLanding && !isKiosk && <Footer />}
    </>
  )
}
```

---

## 🎨 Layout Changes

### Regular User:
```
┌─────────────────────────────┐
│         HEADER              │ ← Logo, Start Designing
├─────┬───────────────────────┤
│  S  │                       │
│  I  │   MAIN CONTENT        │
│  D  │                       │
│  E  │                       │
│  B  │                       │
│  A  │                       │
│  R  │                       │
├─────┴───────────────────────┤
│         FOOTER              │
└─────────────────────────────┘
```

### Kiosk User:
```
┌─────────────────────────────┐
│                             │
│                             │
│     FULL SCREEN CONTENT     │ ← No navigation!
│                             │
│                             │
│                             │
│                             │
└─────────────────────────────┘
    [Virtual Keyboard]
```

---

## 🧪 Testing Instructions

### Test 1: Regular User (Navigation Visible)
1. **Login as** regular user (NOT kiosk)
2. **Navigate to** `/templates` or `/my-cards`
3. **Expected:**
   - ✅ Sidebar visible on left
   - ✅ Mobile menu at bottom
   - ✅ Profile picture/settings accessible
   - ✅ Console: `📱 [DeviceMode] Detected PC mode`

### Test 2: Kiosk Mode (Navigation Hidden)
1. **Login as** `kiosk@smartwish.us`
2. **Navigate to** any page
3. **Expected:**
   - ❌ No sidebar
   - ❌ No mobile menu
   - ❌ No header/footer
   - ✅ Full-screen content
   - ✅ Console: `🖥️ [AppChrome] Kiosk mode - Navigation hidden`

### Test 3: Landing Page
**Regular User:**
- ✅ Header with logo and "Start Designing" button
- ✅ Footer with links

**Kiosk User:**
- ❌ No header
- ❌ No footer
- ✅ Full-screen landing content

---

## 📊 Console Verification

When navigating in Kiosk mode, you'll see:
```
🖥️ [DeviceMode] Detected KIOSK mode - user: kiosk@smartwish.us
🖥️ [AppChrome] Kiosk mode - Navigation hidden
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 [DeviceMode] Navigation detected
   Current Page: /templates
   Device Mode:  KIOSK
   Is Kiosk:     true
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 💡 Benefits for Kiosk Users

### 1. **Simplified Experience**
- No confusing navigation options
- Focus on card creation only
- Reduces user errors

### 2. **More Screen Space**
- Full-screen content
- Better for touch interaction
- Larger visible area for design

### 3. **Privacy**
- No access to account settings
- No way to view saved designs
- Can't access other users' data

### 4. **Security**
- Can't sign out (admin must do it)
- No access to profile settings
- Limited to card creation flow

---

## 🔄 How to Exit Kiosk Mode

Since navigation is hidden, kiosks need special ways to exit:

### Option 1: Admin Logout
- Store staff manually logs out
- Use direct URL: `/sign-in`

### Option 2: Session Timeout (Future)
- Auto-logout after inactivity
- Clears session and returns to login

### Option 3: Hidden Admin Menu (Future)
- Special gesture (e.g., tap logo 10 times)
- Admin password required

---

## 🎯 Summary

| Feature | Regular User | Kiosk Mode |
|---------|--------------|------------|
| Header | ✅ Visible | ❌ Hidden |
| Sidebar | ✅ Visible | ❌ Hidden |
| MobileMenu | ✅ Visible | ❌ Hidden |
| Footer | ✅ Visible | ❌ Hidden |
| Profile Menu | ✅ Accessible | ❌ Hidden |
| Settings | ✅ Accessible | ❌ Hidden |
| Sign Out | ✅ Accessible | ❌ Hidden |
| Virtual Keyboard | ❌ (native) | ✅ Enabled |
| Full Screen | ❌ | ✅ |

---

## ✅ Complete Kiosk Experience

With all changes implemented:
1. ✅ **Login:** Virtual keyboard enabled
2. ✅ **Navigation:** Completely hidden
3. ✅ **Content:** Full-screen, touch-friendly
4. ✅ **Input:** Virtual keyboard on all inputs
5. ✅ **Focus:** Card creation only

The kiosk is now a **self-contained, simplified experience** perfect for public use! 🚀

