'use client'

import React, { useRef, useEffect } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { useVirtualKeyboard } from '@/contexts/VirtualKeyboardContext'
import { useDeviceMode } from '@/contexts/DeviceModeContext'
import { useKioskSafe } from '@/contexts/KioskContext'
import { usePathname } from 'next/navigation'

export default function VirtualKeyboard() {
  const { isKeyboardVisible, inputValue, inputType, updateInputValue, hideKeyboard, currentInputRef } = useVirtualKeyboard()
  const { isKiosk } = useDeviceMode()
  const kioskContext = useKioskSafe()
  const kioskConfig = kioskContext?.config ?? null
  const pathname = usePathname()
  const keyboardRef = useRef<any>(null)
  const isUpdatingFromKeyboard = useRef(false)
  const [layoutName, setLayoutName] = React.useState('default')
  const [capsLock, setCapsLock] = React.useState(false)

  // Disable virtual keyboard for admin routes
  const isAdminRoute = pathname?.startsWith('/admin')
  
  // Hide keyboard if it's visible and user navigated to admin route
  useEffect(() => {
    if (isAdminRoute && isKeyboardVisible) {
      hideKeyboard()
    }
  }, [isAdminRoute, isKeyboardVisible, hideKeyboard])

  // Reset layout when keyboard is hidden or input type changes
  // (Must be called before any early returns to maintain hooks order)
  useEffect(() => {
    if (isAdminRoute) return // Skip logic for admin routes
    if (!isKeyboardVisible) {
      setLayoutName('default')
      setCapsLock(false)
    }
  }, [isKeyboardVisible, inputType, isAdminRoute])

  // Sync keyboard display with input value (only when not typing)
  // (Must be called before any early returns to maintain hooks order)
  useEffect(() => {
    if (isAdminRoute) return // Skip logic for admin routes
    if (keyboardRef.current && isKeyboardVisible && !isUpdatingFromKeyboard.current) {
      console.log('[VirtualKeyboard] Syncing keyboard display with value:', inputValue)
      keyboardRef.current.setInput(inputValue)
    }
  }, [inputValue, isKeyboardVisible, isAdminRoute])

  // Early return for admin routes - AFTER all hooks
  if (isAdminRoute) {
    return null
  }

  // Get virtual keyboard config (with defaults - if no config, assume enabled)
  const virtualKeyboardEnabled = kioskConfig?.virtualKeyboard?.enabled !== false
  const showBuiltInKeyboard = kioskConfig?.virtualKeyboard?.showBuiltInKeyboard !== false

  console.log('🎹 [VirtualKeyboard] Component rendering...', { isKeyboardVisible, isKiosk, virtualKeyboardEnabled, showBuiltInKeyboard })

  const onChange = (input: string) => {
    console.log('[VirtualKeyboard] onChange triggered, input:', input)
    isUpdatingFromKeyboard.current = true
    updateInputValue(input)
    // Reset flag after a short delay
    setTimeout(() => {
      isUpdatingFromKeyboard.current = false
    }, 50)
  }

  const onKeyPress = (button: string) => {
    console.log('[VirtualKeyboard] Button pressed:', button)

    if (button === '{shift}') {
      // Toggle shift - temporary uppercase
      const newLayoutName = layoutName === 'default' ? 'shift' : 'default'
      setLayoutName(newLayoutName)
      console.log('[VirtualKeyboard] Shift toggled, new layout:', newLayoutName)
    } else if (button === '{lock}') {
      // Toggle caps lock - persistent uppercase
      setCapsLock(!capsLock)
      const newLayoutName = !capsLock ? 'shift' : 'default'
      setLayoutName(newLayoutName)
      console.log('[VirtualKeyboard] Caps lock toggled:', !capsLock, 'new layout:', newLayoutName)
    } else if (button === '{close}') {
      hideKeyboard()
    } else if (button === '{enter}') {
      // On /templates page, submit the form (trigger search)
      if (pathname?.includes('/templates')) {
        console.log('[VirtualKeyboard] Enter pressed on templates page - submitting form')
        if (currentInputRef) {
          // Find the parent form and submit it
          const form = currentInputRef.closest('form')
          if (form) {
            console.log('[VirtualKeyboard] Found form, submitting...')
            form.requestSubmit()
            hideKeyboard()
          } else {
            console.log('[VirtualKeyboard] No form found, dispatching Enter key event')
            // Fallback: dispatch Enter key event on the input
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            })
            currentInputRef.dispatchEvent(event)
          }
        }
      }
      // On other pages, just close keyboard
      // hideKeyboard()
    } else {
      // After typing a character, if shift was pressed (not caps lock), go back to default
      if (layoutName === 'shift' && !capsLock) {
        setLayoutName('default')
      }
    }
  }

  // Different layouts based on input type
  const getLayout = () => {
    switch (inputType) {
      case 'number':
      case 'tel':
        return {
          default: ['1 2 3', '4 5 6', '7 8 9', '. 0 {bksp}', '{close}'],
        }
      case 'email':
        return {
          default: [
            '1 2 3 4 5 6 7 8 9 0 {bksp}',
            'q w e r t y u i o p',
            'a s d f g h j k l',
            'z x c v b n m @ .',
            '{space} {close}',
          ],
          shift: [
            '! @ # $ % ^ & * ( ) {bksp}',
            'Q W E R T Y U I O P',
            'A S D F G H J K L',
            'Z X C V B N M _ -',
            '{space} {close}',
          ],
        }
      case 'password':
      case 'text':
      default:
        return {
          default: [
            '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
            '{tab} q w e r t y u i o p [ ] \\',
            "{lock} a s d f g h j k l ; ' {enter}",
            '{shift} z x c v b n m , . / {shift}',
            '{space} {close}',
          ],
          shift: [
            '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
            '{tab} Q W E R T Y U I O P { } |',
            '{lock} A S D F G H J K L : " {enter}',
            '{shift} Z X C V B N M < > ? {shift}',
            '{space} {close}',
          ],
        }
    }
  }

  const getDisplay = () => {
    return {
      '{bksp}': '⌫',
      '{enter}': 'Enter',
      '{shift}': '⇧',
      '{lock}': 'Caps',
      '{tab}': 'Tab',
      '{space}': 'Space',
      '{close}': 'Close',
    }
  }

  // Check if we're on login page (only login, not signup/forgot-password)
  const isLoginPage = pathname?.includes('/sign-in')

  // Show keyboard area if: (Kiosk mode AND virtualKeyboard enabled) OR on login page
  // (Admin routes already handled with early return above)
  const shouldEnableKeyboardSupport = (isKiosk && virtualKeyboardEnabled) || isLoginPage
  
  // Only show our built-in keyboard if the setting is enabled (or on login page where we always need it)
  const shouldShowBuiltInKeyboard = shouldEnableKeyboardSupport && (showBuiltInKeyboard || isLoginPage)

  // Debug logging
  console.log('[VirtualKeyboard] Debug Info:', {
    pathname,
    isLoginPage,
    isKiosk,
    virtualKeyboardEnabled,
    showBuiltInKeyboard,
    shouldEnableKeyboardSupport,
    shouldShowBuiltInKeyboard,
    isKeyboardVisible
  })

  // If virtual keyboard support is disabled entirely, return null (no shrinking, no keyboard)
  if (!shouldEnableKeyboardSupport) {
    console.log('[VirtualKeyboard] ❌ Keyboard support disabled in kiosk config')
    return null
  }

  if (!isKeyboardVisible) {
    // If keyboard support is enabled but keyboard isn't visible, render a placeholder for page shrinking
    // This allows the CSS to shrink the page when an input is focused, even if using Windows touch keyboard
    if (shouldEnableKeyboardSupport && !showBuiltInKeyboard && isKiosk) {
      // Return just the CSS without the keyboard UI - page will still shrink
      return (
        <style jsx global>{`
          /* Page shrinking for Windows Touch Keyboard mode - always shrink when virtual keyboard support is enabled */
          body.keyboard-space-reserved {
            padding-top: 380px !important;
            transition: padding-top 0.2s ease-out;
          }
          @media (max-width: 768px) {
            body.keyboard-space-reserved {
              padding-top: 340px !important;
            }
          }
        `}</style>
      )
    }
    return null
  }

  // If keyboard is visible but we shouldn't show our built-in keyboard, just add page shrinking
  if (!shouldShowBuiltInKeyboard) {
    console.log('[VirtualKeyboard] Page shrinking only - using Windows Touch Keyboard')
    return (
      <>
        {/* Invisible placeholder to trigger page shrinking CSS */}
        <div className="virtual-keyboard-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '350px', pointerEvents: 'none', zIndex: -1 }} />
        <style jsx global>{`
          body:has(.virtual-keyboard-container) {
            padding-top: 380px !important;
            transition: padding-top 0.2s ease-out;
          }
          @media (max-width: 768px) {
            body:has(.virtual-keyboard-container) {
              padding-top: 340px !important;
            }
          }
        `}</style>
      </>
    )
  }

  if (isLoginPage && !isKiosk) {
    console.log('[VirtualKeyboard] Rendering keyboard - Login page')
  } else {
    console.log('[VirtualKeyboard] Rendering keyboard - Kiosk mode active with built-in keyboard')
  }

  return (
    <>
      {/* Keyboard - positioned at TOP of screen, above everything including Pintura modal */}
      <div className="virtual-keyboard-container fixed top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-[999999] bg-gray-900 shadow-2xl border-b border-gray-700 rounded-2xl" style={{ zIndex: 999999, paddingBottom: '20px' }}>
        <div className="max-w-5xl mx-auto px-2 py-3">
          <Keyboard
            keyboardRef={(r: any) => (keyboardRef.current = r)}
            onChange={onChange}
            onKeyPress={onKeyPress}
            layout={getLayout()}
            layoutName={layoutName}
            display={getDisplay()}
            theme="hg-theme-default hg-layout-default kiosk-keyboard"
            buttonTheme={[
              {
                class: 'hg-close-button',
                buttons: '{close}',
              },
              {
                class: capsLock ? 'hg-caps-active' : '',
                buttons: '{lock}',
              },
            ]}
            onRender={() => {
              // Add custom event listener for close button
              const closeButton = document.querySelector('.hg-close-button')
              if (closeButton) {
                closeButton.addEventListener('click', hideKeyboard)
              }
            }}
          />
        </div>
      </div>

      <style jsx global>{`
        .kiosk-keyboard {
          max-width: 100%;
          background-color: #1f2937;
          padding: 10px;
          border-radius: 12px;
        }

        .kiosk-keyboard .hg-button {
          height: 50px;
          font-size: 16px;
          background: #374151;
          border: 1px solid #4b5563;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          color: #f9fafb;
          font-weight: 500;
          margin: 3px;
          transition: all 0.15s ease;
        }

        .kiosk-keyboard .hg-button:hover {
          background: #4b5563;
          border-color: #6b7280;
        }

        .kiosk-keyboard .hg-button:active {
          background: #6b7280;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
          transform: scale(0.97);
        }

        .kiosk-keyboard .hg-button.hg-functionBtn {
          background: #4b5563;
          color: #f9fafb;
          border-color: #6b7280;
        }

        .kiosk-keyboard .hg-button.hg-functionBtn:hover {
          background: #6b7280;
        }

        .kiosk-keyboard .hg-button.hg-functionBtn:active {
          background: #9ca3af;
        }

        .kiosk-keyboard .hg-close-button {
          background: #374151 !important;
          color: #f9fafb !important;
          border-color: #6b7280 !important;
          font-weight: 600;
        }

        .kiosk-keyboard .hg-close-button:hover {
          background: #4b5563 !important;
        }

        .kiosk-keyboard .hg-close-button:active {
          background: #6b7280 !important;
        }

        .kiosk-keyboard .hg-caps-active {
          background: #6b7280 !important;
          color: #ffffff !important;
          border-color: #9ca3af !important;
          box-shadow: 0 0 0 2px rgba(156, 163, 175, 0.3) !important;
        }

        /* Larger space bar */
        .kiosk-keyboard .hg-button[data-skbtn="{space}"] {
          max-width: 500px;
        }

        /* Adjust row spacing */
        .kiosk-keyboard .hg-row {
          margin-bottom: 4px;
        }

        /* Touch-friendly sizing for mobile */
        @media (max-width: 768px) {
          .kiosk-keyboard .hg-button {
            height: 45px;
            font-size: 14px;
            margin: 2px;
          }
        }

        /* When keyboard is visible, push body content DOWN with margin below keyboard */
        body:has(.virtual-keyboard-container) {
          padding-top: 380px !important;
          transition: padding-top 0.2s ease-out;
        }

        /* Adjust for smaller keyboards (number/tel) */
        @media (max-width: 768px) {
          body:has(.virtual-keyboard-container) {
            padding-top: 340px !important;
          }
        }
      `}</style>
    </>
  )
}

