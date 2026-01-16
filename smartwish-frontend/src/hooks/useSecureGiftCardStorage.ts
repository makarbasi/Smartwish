/**
 * Secure Gift Card Storage Hook
 * 
 * Provides encrypted storage and retrieval of gift card data
 * Uses server-side encryption via API for maximum security
 */

'use client'

import { useState, useCallback } from 'react'

export interface GiftCardData {
  qrCode?: string
  storeLogo?: string
  storeName: string
  amount: number
  redemptionLink?: string
  code?: string
  pin?: string
  orderId?: string
  generatedAt: string
  source: string
  expiryDate?: string
}

interface SecureStorageResult {
  success: boolean
  error?: string
}

/**
 * Hook for secure gift card data storage with encryption
 */
export function useSecureGiftCardStorage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Save gift card data with encryption
   */
  const saveGiftCard = useCallback(async (
    cardId: string,
    giftCardData: GiftCardData
  ): Promise<SecureStorageResult> => {
    setIsLoading(true)
    setError(null)

    try {
      // Call server-side encryption API
      const response = await fetch('/api/giftcard/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftCardData })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Encryption failed')
      }

      const { encryptedData } = await response.json()

      // Store encrypted data in localStorage
      localStorage.setItem(`giftCard_${cardId}`, encryptedData)
      
      // Store metadata (non-sensitive) separately for quick access
      const metadata = {
        storeName: giftCardData.storeName,
        amount: giftCardData.amount,
        source: giftCardData.source,
        generatedAt: giftCardData.generatedAt,
        isEncrypted: true
      }
      localStorage.setItem(`giftCardMeta_${cardId}`, JSON.stringify(metadata))

      console.log('✅ Gift card saved securely for card:', cardId)
      return { success: true }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save gift card'
      setError(errorMessage)
      console.error('❌ Failed to save gift card:', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Retrieve and decrypt gift card data
   */
  const getGiftCard = useCallback(async (
    cardId: string
  ): Promise<GiftCardData | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const encryptedData = localStorage.getItem(`giftCard_${cardId}`)
      
      if (!encryptedData) {
        return null
      }

      // Check if data is already a JSON object (legacy unencrypted)
      try {
        const parsed = JSON.parse(encryptedData)
        if (typeof parsed === 'object' && parsed.storeName) {
          console.log('⚠️ Found legacy unencrypted gift card data')
          return parsed as GiftCardData
        }
      } catch {
        // Not JSON, proceed with decryption
      }

      // Call server-side decryption API
      const response = await fetch('/api/giftcard/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Decryption failed')
      }

      const { giftCardData } = await response.json()
      return giftCardData as GiftCardData
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to retrieve gift card'
      setError(errorMessage)
      console.error('❌ Failed to retrieve gift card:', errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get quick metadata without decryption
   */
  const getGiftCardMetadata = useCallback((cardId: string) => {
    try {
      const metadata = localStorage.getItem(`giftCardMeta_${cardId}`)
      return metadata ? JSON.parse(metadata) : null
    } catch {
      return null
    }
  }, [])

  /**
   * Delete gift card data
   */
  const deleteGiftCard = useCallback((cardId: string) => {
    localStorage.removeItem(`giftCard_${cardId}`)
    localStorage.removeItem(`giftCardMeta_${cardId}`)
    console.log('🗑️ Gift card deleted for card:', cardId)
  }, [])

  /**
   * Check if a gift card exists for a card
   */
  const hasGiftCard = useCallback((cardId: string): boolean => {
    return localStorage.getItem(`giftCard_${cardId}`) !== null
  }, [])

  /**
   * Migrate legacy unencrypted data to encrypted format
   */
  const migrateLegacyData = useCallback(async (cardId: string): Promise<boolean> => {
    try {
      const data = localStorage.getItem(`giftCard_${cardId}`)
      if (!data) return false

      // Check if already encrypted
      const metadata = localStorage.getItem(`giftCardMeta_${cardId}`)
      if (metadata) {
        const meta = JSON.parse(metadata)
        if (meta.isEncrypted) return true // Already encrypted
      }

      // Try parsing as JSON (legacy format)
      try {
        const parsed = JSON.parse(data)
        if (typeof parsed === 'object' && parsed.storeName) {
          // Re-save with encryption
          const result = await saveGiftCard(cardId, parsed)
          if (result.success) {
            console.log('✅ Migrated legacy gift card to encrypted format:', cardId)
            return true
          }
        }
      } catch {
        // Not JSON, might already be encrypted or corrupted
      }

      return false
    } catch {
      return false
    }
  }, [saveGiftCard])

  return {
    saveGiftCard,
    getGiftCard,
    getGiftCardMetadata,
    deleteGiftCard,
    hasGiftCard,
    migrateLegacyData,
    isLoading,
    error
  }
}

