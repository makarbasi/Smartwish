'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

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

  const updateInputValue = useCallback(
    (value: string) => {
      setInputValue(value)
      if (currentInputRef) {
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

