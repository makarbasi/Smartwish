'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useVirtualKeyboard } from '@/contexts/VirtualKeyboardContext'

interface VirtualInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function VirtualInput({ value, onChange, type = 'text', ...props }: VirtualInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { showKeyboard, currentInputRef } = useVirtualKeyboard()
  const [lastSyncedValue, setLastSyncedValue] = useState(value)

  const handleFocus = () => {
    if (inputRef.current) {
      const inputType = (type as 'text' | 'email' | 'tel' | 'number' | 'password') || 'text'
      showKeyboard(inputRef.current, value, inputType)
      setLastSyncedValue(value)
    }
  }

  // Update local state when value changes from parent
  useEffect(() => {
    setLastSyncedValue(value)
  }, [value])

  // Scroll to input when it becomes active in keyboard
  useEffect(() => {
    if (currentInputRef === inputRef.current && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [currentInputRef])

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={onChange}
      onFocus={handleFocus}
      type={type}
      {...props}
    />
  )
}

interface VirtualTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

export function VirtualTextarea({ value, onChange, ...props }: VirtualTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showKeyboard, currentInputRef } = useVirtualKeyboard()
  const [lastSyncedValue, setLastSyncedValue] = useState(value)

  const handleFocus = () => {
    if (textareaRef.current) {
      showKeyboard(textareaRef.current, value, 'text')
      setLastSyncedValue(value)
    }
  }

  // Update local state when value changes from parent
  useEffect(() => {
    setLastSyncedValue(value)
  }, [value])

  // Scroll to textarea when it becomes active in keyboard
  useEffect(() => {
    if (currentInputRef === textareaRef.current && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [currentInputRef])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onFocus={handleFocus}
      {...props}
    />
  )
}

