'use client'

import React, { useRef, useEffect } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { useVirtualKeyboard } from '@/contexts/VirtualKeyboardContext'
import { useDeviceMode } from '@/contexts/DeviceModeContext'
import { usePathname } from 'next/navigation'

export default function VirtualKeyboard() {
  const { isKeyboardVisible, inputValue, inputType, updateInputValue, hideKeyboard, currentInputRef } = useVirtualKeyboard()
  const { isKiosk } = useDeviceMode()
  const pathname = usePathname()
  const keyboardRef = useRef<any>(null)
  const isUpdatingFromKeyboard = useRef(false)
  const [layoutName, setLayoutName] = React.useState('default')
  const [capsLock, setCapsLock] = React.useState(false)

  console.log('🎹 [VirtualKeyboard] Component rendering...', { isKeyboardVisible, isKiosk })

  // Reset layout when keyboard is hidden or input type changes
  useEffect(() => {
    if (!isKeyboardVisible) {
      setLayoutName('default')
      setCapsLock(false)
    }
  }, [isKeyboardVisible, inputType])

  // Sync keyboard display with input value (only when not typing)
  useEffect(() => {
    if (keyboardRef.current && isKeyboardVisible && !isUpdatingFromKeyboard.current) {
      console.log('[VirtualKeyboard] Syncing keyboard display with value:', inputValue)
      keyboardRef.current.setInput(inputValue)
    }
  }, [inputValue, isKeyboardVisible])

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

  // Show keyboard if: Kiosk mode OR on login page (need keyboard to login as kiosk)
  const shouldShowKeyboard = isKiosk || isLoginPage

  // Debug logging
  console.log('[VirtualKeyboard] Debug Info:', {
    pathname,
    isLoginPage,
    isKiosk,
    shouldShowKeyboard,
    isKeyboardVisible
  })

  if (!shouldShowKeyboard) {
    console.log('[VirtualKeyboard] ❌ Keyboard disabled - Not in Kiosk mode and not on login page')
    return null
  }

  if (!isKeyboardVisible) {
    return null
  }

  if (isLoginPage && !isKiosk) {
    console.log('[VirtualKeyboard] Rendering keyboard - Login page')
  } else {
    console.log('[VirtualKeyboard] Rendering keyboard - Kiosk mode active')
  }

  return (
    <>
      {/* Keyboard */}
      <div className="virtual-keyboard-container fixed inset-x-0 bottom-0 z-[9999] bg-gray-100 shadow-2xl border-t-2 border-gray-300">
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
          background-color: #f3f4f6;
          padding: 8px;
          border-radius: 8px;
        }

        .kiosk-keyboard .hg-button {
          height: 50px;
          font-size: 16px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          color: #1f2937;
          font-weight: 500;
          margin: 3px;
          transition: all 0.1s ease;
        }

        .kiosk-keyboard .hg-button:active {
          background: #e5e7eb;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transform: scale(0.95);
        }

        .kiosk-keyboard .hg-button.hg-functionBtn {
          background: #6366f1;
          color: white;
          border-color: #4f46e5;
        }

        .kiosk-keyboard .hg-button.hg-functionBtn:active {
          background: #4f46e5;
        }

        .kiosk-keyboard .hg-close-button {
          background: #ef4444 !important;
          color: white !important;
          border-color: #dc2626 !important;
          font-weight: 600;
        }

        .kiosk-keyboard .hg-close-button:active {
          background: #dc2626 !important;
        }

        .kiosk-keyboard .hg-caps-active {
          background: #10b981 !important;
          color: white !important;
          border-color: #059669 !important;
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

        /* Prevent page scrolling when keyboard is visible */
        body:has(.kiosk-keyboard) {
          overflow: hidden;
        }
      `}</style>
    </>
  )
}

