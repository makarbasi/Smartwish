'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface VirtualKeyboardContextType {
  isKeyboardVisible: boolean
  currentInputRef: HTMLInputElement | HTMLTextAreaElement | null
  inputValue: string
  inputType: 'text' | 'email' | 'tel' | 'number' | 'password'
  showKeyboard: (
    ref: HTMLInputElement | HTMLTextAreaElement,
    value: string,
    type?: 'text' | 'email' | 'tel' | 'number' | 'password'
  ) => void
  hideKeyboard: () => void
  updateInputValue: (value: string) => void
}

const VirtualKeyboardContext = createContext<VirtualKeyboardContextType | undefined>(undefined)

export function VirtualKeyboardProvider({ children }: { children: ReactNode }) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [currentInputRef, setCurrentInputRef] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [inputType, setInputType] = useState<'text' | 'email' | 'tel' | 'number' | 'password'>('text')
  const pathname = usePathname()

  const showKeyboard = useCallback(
    (
      ref: HTMLInputElement | HTMLTextAreaElement,
      value: string,
      type: 'text' | 'email' | 'tel' | 'number' | 'password' = 'text'
    ) => {
      setCurrentInputRef(ref)
      setInputValue(value)
      setInputType(type)
      setIsKeyboardVisible(true)
    },
    []
  )

  const hideKeyboard = useCallback(() => {
    setIsKeyboardVisible(false)
    setCurrentInputRef(null)
    setInputValue('')
    setInputType('text')
  }, [])

  // Hide keyboard when route changes
  useEffect(() => {
    hideKeyboard()
  }, [pathname, hideKeyboard])

  // Hide keyboard when clicking outside
  useEffect(() => {
    if (!isKeyboardVisible) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Don't hide if clicking on the keyboard itself
      if (target.closest('.hg-theme-default') || target.closest('.virtual-keyboard-container')) {
        return
      }

      // Don't hide if clicking on the current input
      if (currentInputRef && target === currentInputRef) {
        return
      }

      // Don't hide if clicking on any input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
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
  }, [isKeyboardVisible, currentInputRef, hideKeyboard])

  const updateInputValue = useCallback(
    (value: string) => {
      // Only update if value actually changed
      setInputValue((prev) => {
        if (prev === value) return prev
        return value
      })
      
      if (currentInputRef && currentInputRef.value !== value) {
        // Update the actual input element
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set

        if (currentInputRef instanceof HTMLInputElement && nativeInputValueSetter) {
          nativeInputValueSetter.call(currentInputRef, value)
        } else if (currentInputRef instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.call(currentInputRef, value)
        }

        // Trigger React's onChange event
        const event = new Event('input', { bubbles: true })
        currentInputRef.dispatchEvent(event)
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
        showKeyboard,
        hideKeyboard,
        updateInputValue,
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

