# Virtual Keyboard Implementation for Touch Screen Kiosk

## Overview
This implementation adds a comprehensive virtual keyboard system for your SmartWish application, designed specifically for touch screen kiosks where physical keyboards are not available.

## Features
✅ **Full QWERTY Keyboard** - Complete keyboard layout with shift, caps lock, numbers, and special characters
✅ **Smart Input Type Detection** - Different keyboard layouts for:
  - Text inputs (full QWERTY)
  - Email inputs (optimized with @ and . keys)
  - Number/Tel inputs (numeric keypad)
  - Password inputs (full keyboard)
✅ **Context-Aware** - Automatically appears when users tap on any text input field
✅ **Auto-Scroll** - Page automatically scrolls to keep the active input field visible above the keyboard
✅ **Close Button** - Red "Close" button to dismiss the keyboard
✅ **Touch-Friendly** - Large buttons optimized for touch input

## Files Created

### 1. Context (`src/contexts/VirtualKeyboardContext.tsx`)
Manages the global state of the virtual keyboard:
- Shows/hides keyboard
- Tracks current active input
- Handles value synchronization between keyboard and inputs

### 2. Keyboard Component (`src/components/VirtualKeyboard.tsx`)
The main keyboard UI component featuring:
- Full QWERTY layout with multiple key layouts (default, shift)
- Number pad layout for numeric inputs
- Email-optimized layout
- Custom styling for kiosk environment
- Large, touch-friendly buttons

### 3. Input Wrapper Components (`src/components/VirtualInput.tsx`)
- `VirtualInput` - Wraps standard `<input>` elements
- `VirtualTextarea` - Wraps `<textarea>` elements
- Both automatically trigger the virtual keyboard on focus

## Updated Pages

### ✅ Marketplace Page (`src/app/marketplace/page.tsx`)
- Search input
- Gift card amount input
- Payment form inputs (card number, expiry, CVV, cardholder name, recipient email)

### ✅ Contacts Page (`src/app/contacts/page.tsx`)
- Search input
- Contact form inputs (name, email, phone, company, occupation, address, notes, interests)

### ✅ Settings Page (`src/app/settings/page.tsx`)
- Profile inputs (name, phone, social media links, interests, hobbies)
- Password change inputs

### ✅ Hero Search Component (`src/components/HeroSearch.tsx`)
- Main search input used throughout the app

### ✅ Root Layout (`src/app/layout.tsx`)
- Added `VirtualKeyboardProvider` to wrap the entire app
- Added `VirtualKeyboard` component at the root level

## Dependencies Added
```json
{
  "react-simple-keyboard": "^3.x.x"
}
```

## Usage

### For Developers - Adding Virtual Keyboard to New Inputs

Simply replace standard inputs with the virtual keyboard-enabled versions:

**Before:**
```typescript
<input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text..."
  className="..."
/>
```

**After:**
```typescript
import { VirtualInput } from '@/components/VirtualInput'

<VirtualInput
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text..."
  className="..."
/>
```

For textareas:
```typescript
import { VirtualTextarea } from '@/components/VirtualInput'

<VirtualTextarea
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text..."
  className="..."
/>
```

## Customization

### Keyboard Layouts
Edit `src/components/VirtualKeyboard.tsx` to customize keyboard layouts:
- `getLayout()` function defines key arrangements
- `getDisplay()` function defines button labels
- Layouts automatically switch based on input type

### Styling
The keyboard uses inline styles and CSS classes:
- `.kiosk-keyboard` - Main keyboard container
- `.hg-button` - Individual key buttons
- `.hg-close-button` - Close button
- Modify the `<style jsx global>` section in VirtualKeyboard.tsx

### Button Sizes
Current configuration:
- Desktop: 50px height, 16px font
- Mobile: 45px height, 14px font
- Adjust in the `<style jsx global>` section

## How It Works

1. **User taps on input** → Input gets focus
2. **VirtualInput detects focus** → Calls `showKeyboard()` with input reference and current value
3. **Keyboard appears** → Positioned at bottom of screen
4. **User types on virtual keyboard** → Updates input value in real-time
5. **User taps Close or another element** → Keyboard hides

## Browser Compatibility
- ✅ Chrome/Edge (recommended for kiosks)
- ✅ Safari
- ✅ Firefox
- ✅ All modern touch-enabled browsers

## Performance Considerations
- Keyboard renders only when visible (conditional rendering)
- Uses React context for efficient state management
- Keyboard component is memoized to prevent unnecessary re-renders

## Testing Checklist
- [x] All input fields trigger keyboard on touch/focus
- [x] Number inputs show numeric keypad
- [x] Email inputs show email-optimized layout
- [x] Password inputs work correctly
- [x] Keyboard closes properly
- [x] Auto-scroll keeps inputs visible
- [x] Multiple inputs can be used sequentially

## Future Enhancements (Optional)
- [ ] Add haptic feedback for touch
- [ ] Add sound effects for key presses
- [ ] Support for multiple languages
- [ ] Swipe gestures for special actions
- [ ] Voice input integration toggle

## Support
For issues or questions, refer to:
- `react-simple-keyboard` docs: https://hodgef.com/simple-keyboard/
- Context API: React documentation

---
**Implementation Date:** November 6, 2025
**Status:** ✅ Complete and Production Ready

