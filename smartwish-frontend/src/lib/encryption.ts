/**
 * Gift Card Data Encryption Module
 * 
 * Implements AES-256-GCM encryption for sensitive gift card data
 * with support for key rotation and versioning.
 * 
 * Production Setup:
 * - Use AWS KMS, HashiCorp Vault, or Azure Key Vault for key management
 * - Set ENCRYPTION_KEY via secure secrets manager (not .env in production)
 * - Enable key rotation every 90 days
 */

import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16  // 128 bits for GCM
const AUTH_TAG_LENGTH = 16  // 128 bits
const SALT_LENGTH = 32
const KEY_LENGTH = 32  // 256 bits for AES-256

// Key version for rotation support - increment when rotating keys
const CURRENT_KEY_VERSION = 1

/**
 * Get encryption key from environment
 * In production, this should come from AWS KMS, HashiCorp Vault, etc.
 */
function getEncryptionKey(version: number = CURRENT_KEY_VERSION): Buffer {
  // Support for key rotation - check versioned keys first
  const versionedKeyName = `ENCRYPTION_KEY_V${version}`
  const keyHex = process.env[versionedKeyName] || process.env.ENCRYPTION_KEY
  
  if (!keyHex) {
    throw new Error(
      'Encryption key not configured. Set ENCRYPTION_KEY or ENCRYPTION_KEY_V1 environment variable. ' +
      'Key must be 64 hex characters (256 bits).'
    )
  }
  
  // Validate key length
  if (keyHex.length !== 64) {
    throw new Error(
      `Invalid encryption key length. Expected 64 hex characters, got ${keyHex.length}. ` +
      'Generate a new key with: openssl rand -hex 32'
    )
  }
  
  return Buffer.from(keyHex, 'hex')
}

/**
 * Derive a unique key for each encryption operation using PBKDF2
 * This adds an extra layer of security even if the master key is compromised
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt sensitive gift card data
 * 
 * @param data - The plaintext data to encrypt (object or string)
 * @returns Encrypted data string (base64 encoded) with embedded metadata
 */
export function encryptGiftCardData(data: object | string): string {
  try {
    const masterKey = getEncryptionKey()
    
    // Generate random salt and IV for this encryption
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // Derive unique key for this operation
    const derivedKey = deriveKey(masterKey, salt)
    
    // Convert data to JSON string if object
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data)
    
    // Create cipher and encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    // Get authentication tag
    const authTag = cipher.getAuthTag()
    
    // Combine all components: version|salt|iv|authTag|ciphertext
    const combined = Buffer.concat([
      Buffer.from([CURRENT_KEY_VERSION]),  // 1 byte for version
      salt,                                  // 32 bytes
      iv,                                    // 16 bytes
      authTag,                               // 16 bytes
      Buffer.from(encrypted, 'base64')       // variable length ciphertext
    ])
    
    return combined.toString('base64')
  } catch (error: any) {
    console.error('Encryption failed:', error.message)
    throw new Error('Failed to encrypt gift card data')
  }
}

/**
 * Decrypt gift card data
 * 
 * @param encryptedData - The encrypted data string (base64)
 * @returns Decrypted data (parsed as JSON if valid, otherwise string)
 */
export function decryptGiftCardData(encryptedData: string): object | string {
  try {
    const combined = Buffer.from(encryptedData, 'base64')
    
    // Extract components
    let offset = 0
    
    const version = combined[offset]
    offset += 1
    
    const salt = combined.subarray(offset, offset + SALT_LENGTH)
    offset += SALT_LENGTH
    
    const iv = combined.subarray(offset, offset + IV_LENGTH)
    offset += IV_LENGTH
    
    const authTag = combined.subarray(offset, offset + AUTH_TAG_LENGTH)
    offset += AUTH_TAG_LENGTH
    
    const ciphertext = combined.subarray(offset)
    
    // Get the correct key version for decryption
    const masterKey = getEncryptionKey(version)
    
    // Derive the same key using the stored salt
    const derivedKey = deriveKey(masterKey, salt)
    
    // Create decipher and decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    const plaintext = decrypted.toString('utf8')
    
    // Try to parse as JSON, return string if not valid JSON
    try {
      return JSON.parse(plaintext)
    } catch {
      return plaintext
    }
  } catch (error: any) {
    console.error('Decryption failed:', error.message)
    throw new Error('Failed to decrypt gift card data. Data may be corrupted or key mismatch.')
  }
}

/**
 * Check if a string appears to be encrypted data
 */
export function isEncrypted(data: string): boolean {
  try {
    const buffer = Buffer.from(data, 'base64')
    // Minimum size: 1 (version) + 32 (salt) + 16 (iv) + 16 (authTag) + 1 (min ciphertext)
    if (buffer.length < 66) return false
    
    // Check version byte is valid
    const version = buffer[0]
    return version >= 1 && version <= 255
  } catch {
    return false
  }
}

/**
 * Generate a new encryption key (for initial setup or rotation)
 * Run this once and store the output securely in your secrets manager
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Mask sensitive gift card data for display/logging
 */
export function maskGiftCardCode(code: string): string {
  if (!code || code.length < 4) return '****'
  return '*'.repeat(code.length - 4) + code.slice(-4)
}

/**
 * Mask redemption URL for logging (show domain only)
 */
export function maskRedemptionUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}/***`
  } catch {
    return '***'
  }
}

// Browser-compatible encryption for client-side use
// Uses Web Crypto API instead of Node crypto

/**
 * Client-side encryption using Web Crypto API
 * For encrypting data in localStorage before storage
 */
export async function encryptClientSide(data: object | string, key: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('encryptClientSide can only be used in browser environment')
  }
  
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data)
  const encoder = new TextEncoder()
  
  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  
  const salt = crypto.getRandomValues(new Uint8Array(16))
  
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    derivedKey,
    encoder.encode(plaintext)
  )
  
  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

/**
 * Client-side decryption using Web Crypto API
 */
export async function decryptClientSide(encryptedData: string, key: string): Promise<object | string> {
  if (typeof window === 'undefined') {
    throw new Error('decryptClientSide can only be used in browser environment')
  }
  
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
  
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)
  
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    derivedKey,
    ciphertext
  )
  
  const plaintext = decoder.decode(decrypted)
  
  try {
    return JSON.parse(plaintext)
  } catch {
    return plaintext
  }
}

