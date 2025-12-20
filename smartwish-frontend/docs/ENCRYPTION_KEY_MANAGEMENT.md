# Gift Card Encryption & Key Management Guide

## Overview

SmartWish uses AES-256-GCM encryption to protect gift card data at rest. This document covers setup, key management, and rotation procedures.

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SmartWish Application                    │
├─────────────────────────────────────────────────────────────┤
│  Gift Card Data Flow:                                        │
│                                                              │
│  1. Tillo API → Gift Card (code, URL, PIN)                  │
│  2. Server encrypts with AES-256-GCM                        │
│  3. Encrypted blob stored in localStorage/DB                 │
│  4. On retrieval: Server decrypts for display               │
│                                                              │
│  Master Key Source (Production):                             │
│  ├── AWS KMS (recommended)                                   │
│  ├── HashiCorp Vault                                         │
│  ├── Azure Key Vault                                         │
│  └── Google Cloud KMS                                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Setup (Development)

```bash
# Generate a 256-bit encryption key
openssl rand -hex 32

# Add to .env.local
ENCRYPTION_KEY=<your-64-character-hex-key>
```

## Production Setup with AWS KMS

### 1. Create KMS Key

```bash
# Create a customer-managed key
aws kms create-key \
  --description "SmartWish Gift Card Encryption Key" \
  --key-usage ENCRYPT_DECRYPT \
  --customer-master-key-spec SYMMETRIC_DEFAULT \
  --tags TagKey=Application,TagValue=SmartWish

# Note the KeyId from the response
```

### 2. Create Key Alias

```bash
aws kms create-alias \
  --alias-name alias/smartwish-giftcard-key \
  --target-key-id <key-id>
```

### 3. Set Up Automatic Key Rotation

```bash
# Enable automatic annual rotation
aws kms enable-key-rotation \
  --key-id <key-id>
```

### 4. Generate Data Encryption Key

```bash
# Generate a data key encrypted by KMS
aws kms generate-data-key \
  --key-id alias/smartwish-giftcard-key \
  --key-spec AES_256 \
  --output json

# Response includes:
# - Plaintext: Use this as ENCRYPTION_KEY (base64 decode to hex)
# - CiphertextBlob: Store this to re-derive key if needed
```

### 5. Configure Application

```bash
# In your secrets manager or environment:
ENCRYPTION_KEY=<plaintext-data-key-as-hex>
AWS_KMS_KEY_ID=alias/smartwish-giftcard-key
```

## Production Setup with HashiCorp Vault

### 1. Enable Transit Secrets Engine

```bash
vault secrets enable transit
```

### 2. Create Encryption Key

```bash
vault write -f transit/keys/smartwish-giftcard \
  type=aes256-gcm96 \
  auto_rotate_period=90d
```

### 3. Configure Application

```javascript
// Use Vault API to encrypt/decrypt instead of local crypto
const vault = require('node-vault')({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
});

// Encrypt
const encrypted = await vault.write('transit/encrypt/smartwish-giftcard', {
  plaintext: Buffer.from(JSON.stringify(giftCardData)).toString('base64')
});

// Decrypt
const decrypted = await vault.write('transit/decrypt/smartwish-giftcard', {
  ciphertext: encrypted.data.ciphertext
});
```

## Key Rotation Procedure

### Manual Rotation Steps

1. **Generate new key:**
   ```bash
   openssl rand -hex 32
   ```

2. **Update environment with versioned keys:**
   ```bash
   # Keep old key for decrypting existing data
   ENCRYPTION_KEY_V1=<old-key>
   
   # Set new key as current version
   ENCRYPTION_KEY_V2=<new-key>
   ENCRYPTION_KEY=<new-key>
   ```

3. **Update key version in code:**
   ```typescript
   // In src/lib/encryption.ts
   const CURRENT_KEY_VERSION = 2  // Increment this
   ```

4. **Re-encrypt existing data (optional but recommended):**
   ```typescript
   // Run migration script to re-encrypt all gift cards with new key
   async function reencryptAllGiftCards() {
     const keys = Object.keys(localStorage).filter(k => k.startsWith('giftCard_'));
     for (const key of keys) {
       const cardId = key.replace('giftCard_', '');
       const data = await getGiftCard(cardId);  // Decrypts with old key
       await saveGiftCard(cardId, data);         // Encrypts with new key
     }
   }
   ```

5. **Remove old key after migration:**
   ```bash
   # After confirming all data is re-encrypted
   # Remove ENCRYPTION_KEY_V1
   ```

## Security Best Practices

### ✅ DO

- Use AWS KMS, HashiCorp Vault, or similar in production
- Enable automatic key rotation (90 days recommended)
- Store encrypted data key, not master key, in application
- Log all encryption/decryption operations (without sensitive data)
- Use separate keys for different environments (dev/staging/prod)
- Implement key access auditing

### ❌ DON'T

- Store encryption keys in source code
- Store encryption keys in .env files in production
- Log plaintext gift card codes or PINs
- Share keys between environments
- Disable key rotation
- Store keys in the same location as encrypted data

## Monitoring & Auditing

### CloudWatch Metrics (AWS KMS)

```bash
# Key usage metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name NumberOfSuccessfulDecryptions \
  --dimensions Name=KeyId,Value=<key-id> \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 86400 \
  --statistics Sum
```

### Application Logging

The encryption module logs masked audit trails:

```
🔐 Gift card data encrypted: {
  storeName: "Amazon",
  amount: 25,
  code: "****XY89",      // Masked
  url: "https://redeem.tillo.io/***",  // Masked
  timestamp: "2024-01-15T10:30:00Z"
}
```

## Incident Response

### If Key is Compromised

1. **Immediately rotate to new key**
2. **Revoke access to compromised key**
3. **Re-encrypt all data with new key**
4. **Review access logs for unauthorized decryption**
5. **Notify affected users if gift cards were exposed**

### If Encrypted Data is Lost

1. **Check backups for encrypted data**
2. **Verify KMS/Vault key is still accessible**
3. **Restore from backup and decrypt**

## Testing Encryption

```bash
# Run encryption tests
npm run test:encryption

# Or manually test in Node.js console
node -e "
  const { encryptGiftCardData, decryptGiftCardData, generateEncryptionKey } = require('./src/lib/encryption');
  
  // Generate test key
  const key = generateEncryptionKey();
  console.log('Test key:', key);
  
  // Test encryption/decryption
  process.env.ENCRYPTION_KEY = key;
  const data = { code: 'ABC123', amount: 25, storeName: 'Test' };
  const encrypted = encryptGiftCardData(data);
  console.log('Encrypted:', encrypted.substring(0, 50) + '...');
  
  const decrypted = decryptGiftCardData(encrypted);
  console.log('Decrypted:', decrypted);
"
```

## Compliance Notes

- **PCI DSS**: This encryption implementation helps meet PCI DSS requirements 3.4 (render PAN unreadable) if gift card codes are considered sensitive
- **SOC 2**: Demonstrates encryption at rest and key management controls
- **GDPR**: Supports data protection requirements for EU users

## Support

For questions about key management or encryption, contact:
- Security Team: security@smartwish.com
- DevOps: devops@smartwish.com

