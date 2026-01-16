'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface VirtualKeyboardContextType {
  isKeyboardVisible: boolean
  currentInputRef: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null
  inputValue: string
  inputType: 'text' | 'email' | 'tel' | 'number' | 'password'
  isLocked: boolean
  showKeyboard: (
    ref: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
    value: string,
    type?: 'text' | 'email' | 'tel' | 'number' | 'password'
  ) => void
  hideKeyboard: () => void
  updateInputValue: (value: string) => void
  lockKeyboard: () => void
  unlockKeyboard: () => void
}

const VirtualKeyboardContext = createContext<VirtualKeyboardContextType | undefined>(undefined)

export function VirtualKeyboardProvider({ children }: { children: ReactNode }) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [currentInputRef, setCurrentInputRef] = useState<HTMLInputElement | HTMLTextAreaElement | HTMLElement | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [inputType, setInputType] = useState<'text' | 'email' | 'tel' | 'number' | 'password'>('text')
  const [isLocked, setIsLocked] = useState(false)
  const pathname = usePathname()

  const showKeyboard = useCallback(
    (
      ref: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
      value: string,
      type: 'text' | 'email' | 'tel' | 'number' | 'password' = 'text'
    ) => {
      // Disable virtual keyboard for admin routes
      if (pathname?.startsWith('/admin')) {
        console.log('⌨️ [VirtualKeyboardContext] Keyboard disabled for admin routes')
        return
      }
      
      console.log('⌨️ [VirtualKeyboardContext] showKeyboard called!', { 
        value, 
        type,
        pathname,
        refType:
          ref instanceof HTMLInputElement
            ? 'input'
            : ref instanceof HTMLTextAreaElement
              ? 'textarea'
              : (ref as HTMLElement).isContentEditable
                ? 'contenteditable'
                : 'element'
      })
      setCurrentInputRef(ref)
      setInputValue(value)
      setInputType(type)
      setIsKeyboardVisible(true)
      console.log('✅ [VirtualKeyboardContext] Keyboard visibility set to TRUE')
    },
    [pathname]
  )

  const hideKeyboard = useCallback(() => {
    setIsKeyboardVisible(false)
    setCurrentInputRef(null)
    setInputValue('')
    setInputType('text')
    setIsLocked(false) // Also unlock when hiding
  }, [])

  const lockKeyboard = useCallback(() => {
    console.log('🔒 [VirtualKeyboard] Keyboard LOCKED - will not auto-hide')
    setIsLocked(true)
  }, [])

  const unlockKeyboard = useCallback(() => {
    console.log('🔓 [VirtualKeyboard] Keyboard UNLOCKED')
    setIsLocked(false)
  }, [])

  // Hide keyboard when route changes
  useEffect(() => {
    hideKeyboard()
  }, [pathname, hideKeyboard])

  // Hide keyboard when clicking outside (unless locked)
  useEffect(() => {
    if (!isKeyboardVisible) return

    const handleClickOutside = (event: MouseEvent) => {
      // Don't hide if keyboard is locked (e.g., in Pintura annotate mode)
      if (isLocked) {
        console.log('🔒 [VirtualKeyboard] Click outside ignored - keyboard is locked')
        return
      }

      const target = event.target as HTMLElement
      
      // Don't hide if clicking on the keyboard itself
      if (target.closest('.hg-theme-default') || target.closest('.virtual-keyboard-container')) {
        return
      }

      // Don't hide if clicking on the current input
      if (currentInputRef && target === currentInputRef) {
        return
      }

      // Don't hide if clicking on any input, textarea, or select element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return
      }

      // Don't hide if clicking on option elements (dropdown options)
      if (target.tagName === 'OPTION') {
        return
      }

      // Don't hide if clicking inside Pintura (when in annotate mode)
      if (target.closest('.PinturaModal') || target.closest('.PinturaRoot') || target.closest('.PinturaEditor')) {
        return
      }

      // Don't hide if clicking inside any select dropdown or its parent container
      // This handles category selectors and other filter dropdowns in HeroSearch
      if (target.closest('select') || 
          target.closest('[aria-label*="Category"]') ||
          target.closest('[aria-label*="Region"]') ||
          target.closest('[aria-label*="Language"]') ||
          target.closest('[aria-label*="Author"]')) {
        return
      }

      // Don't hide if clicking inside the search dropdown panel container
      // Check if we're inside a dropdown panel that contains select elements
      const parentContainer = target.closest('div')
      if (parentContainer) {
        // Check if this container or any parent has select elements (search filter dropdowns)
        const hasSelects = parentContainer.querySelector('select') !== null
        // Also check if we're in a dropdown-like container (has rounded corners, shadow, etc - typical dropdown styling)
        const isDropdownPanel = 
          parentContainer.classList.contains('rounded-2xl') || 
          parentContainer.classList.contains('shadow-lg') ||
          parentContainer.style.position === 'absolute' ||
          window.getComputedStyle(parentContainer).position === 'absolute'
        
        if (hasSelects && isDropdownPanel) {
          return
        }
      }

      // Hide keyboard for any other clicks
      hideKeyboard()
    }

    // Add slight delay to avoid immediate closing when opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside as any)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside as any)
    }
  }, [isKeyboardVisible, currentInputRef, hideKeyboard, isLocked])

  const updateInputValue = useCallback(
    (value: string) => {
      console.log('[VirtualKeyboard] updateInputValue called with:', value)
      
      // Update context state
      setInputValue(value)
      
      const updateTarget = (target: HTMLInputElement | HTMLTextAreaElement | HTMLElement) => {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          console.log('[VirtualKeyboard] Updating input/textarea element:', {
            id: target.id,
            name: target.getAttribute('name'),
            className: target.className,
            oldValue: target.value,
            newValue: value,
          })
        
          // Update the actual input element
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set
          const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set

          if (target instanceof HTMLInputElement && nativeInputValueSetter) {
            nativeInputValueSetter.call(target, value)
          } else if (target instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(target, value)
          }

          // Trigger React's onChange event
          target.dispatchEvent(new Event('input', { bubbles: true }))
          target.dispatchEvent(new Event('change', { bubbles: true }))
          console.log('[VirtualKeyboard] Input+change events dispatched')
          return
        }

        // contenteditable
        if ((target as HTMLElement).isContentEditable || target.getAttribute('contenteditable') === 'true') {
          console.log('[VirtualKeyboard] Updating contenteditable element:', {
            className: (target as HTMLElement).className,
            oldText: (target as HTMLElement).textContent,
            newText: value,
          })
          ;(target as HTMLElement).textContent = value
          target.dispatchEvent(new Event('input', { bubbles: true }))
          target.dispatchEvent(new Event('change', { bubbles: true }))
          return
        }
      }

      if (currentInputRef) {
        updateTarget(currentInputRef)
      }

      // Extra safety: if Pintura (or anything else) has the real active input focused,
      // also update it so the user sees changes immediately.
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        active !== currentInputRef &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active.isContentEditable ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        const isInsidePintura =
          !!active.closest('.PinturaModal') || !!active.closest('.PinturaRoot') || !!active.closest('.PinturaEditor')
        if (isInsidePintura) {
          console.log('[VirtualKeyboard] Also updating focused Pintura element')
          updateTarget(active)
        }
      }
    },
    [currentInputRef]
  )

  return (
    <VirtualKeyboardContext.Provider
      value={{
        isKeyboardVisible,
        currentInputRef,
        inputValue,
        inputType,
        isLocked,
        showKeyboard,
        hideKeyboard,
        updateInputValue,
        lockKeyboard,
        unlockKeyboard,
      }}
    >
      {children}
    </VirtualKeyboardContext.Provider>
  )
}

export function useVirtualKeyboard() {
  const context = useContext(VirtualKeyboardContext)
  if (context === undefined) {
    throw new Error('useVirtualKeyboard must be used within a VirtualKeyboardProvider')
  }
  return context
}

