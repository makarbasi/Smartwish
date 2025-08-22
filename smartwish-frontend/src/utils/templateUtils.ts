// Utility functions for template operations

export interface SaveTemplateResponse {
  success: boolean
  message: string
  data?: Record<string, unknown>
  action: 'update' | 'duplicate'
  error?: string
  details?: string
}

export interface UploadImagesResponse {
  success: boolean
  message: string
  cloudUrls: string[]
  designId: string
  count: number
  error?: string
  details?: string
}

/**
 * Validate that no blob URLs are present in images array
 */
function validateNoBlobUrls(images: string[]): void {
  const blobUrls = images.filter(img => img.startsWith('blob:'))
  if (blobUrls.length > 0) {
    console.error('❌ CRITICAL: Blob URLs detected in template save operation:', blobUrls)
    throw new Error(`Cannot save template with blob URLs. Found ${blobUrls.length} blob URLs that must be converted to Supabase URLs first.`)
  }
}

/**
 * Ensure all blob URLs are converted to Supabase URLs before saving
 */
async function ensureSupabaseUrls(images: string[]): Promise<string[]> {
  console.log('🔍 Checking for blob URLs in template images...')
  
  const blobUrls = images.filter(img => img.startsWith('blob:'))
  if (blobUrls.length === 0) {
    console.log('✅ No blob URLs detected, all images are already Supabase URLs')
    return images
  }
  
  console.log(`🔄 Converting ${blobUrls.length} blob URLs to Supabase URLs...`)
  
  // Convert blob URLs to base64, then upload to get Supabase URLs
  const base64Images = await convertBlobUrlsToBase64(blobUrls)
  
  // Make a temporary upload to get Supabase URLs
  const uploadResponse = await fetch('/api/upload-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      images: base64Images,
      userId: 'temp-conversion', // This will be updated by the actual save
      designId: 'blob-conversion'
    })
  })
  
  if (!uploadResponse.ok) {
    throw new Error('Failed to convert blob URLs to Supabase URLs')
  }
  
  const uploadResult = await uploadResponse.json()
  if (!uploadResult.success) {
    throw new Error(`Blob URL conversion failed: ${uploadResult.error}`)
  }
  
  // Replace blob URLs with Supabase URLs
  const finalImages = [...images]
  let supabaseIndex = 0
  for (let i = 0; i < finalImages.length; i++) {
    if (finalImages[i].startsWith('blob:')) {
      finalImages[i] = uploadResult.cloudUrls[supabaseIndex]
      supabaseIndex++
    }
  }
  
  console.log('✅ All blob URLs converted to Supabase URLs')
  return finalImages
}

/**
 * Convert blob URLs to base64 data for upload
 */
export async function convertBlobUrlsToBase64(imageUrls: string[]): Promise<string[]> {
  const base64Images: string[] = []
  
  for (const url of imageUrls) {
    try {
      if (url.startsWith('blob:')) {
        // Convert blob URL to base64
        const response = await fetch(url)
        const blob = await response.blob()
        const base64 = await blobToBase64(blob)
        base64Images.push(base64)
      } else if (url.startsWith('data:image/')) {
        // Already base64
        base64Images.push(url)
      } else {
        // External URL - fetch and convert
        const response = await fetch(url)
        const blob = await response.blob()
        const base64 = await blobToBase64(blob)
        base64Images.push(base64)
      }
    } catch (error) {
      console.error('Error converting image to base64:', error)
      // Fallback: try to use original URL
      base64Images.push(url)
    }
  }
  
  return base64Images
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Upload images to cloud storage
 */
export async function uploadImages(
  images: string[],
  userId: string,
  designId?: string
): Promise<UploadImagesResponse> {
  try {
    // Convert images to base64 if needed
    const base64Images = await convertBlobUrlsToBase64(images)
    
    const response = await fetch('/api/upload-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: base64Images,
        userId,
        designId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error uploading images:', error)
    throw error
  }
}

/**
 * Save template (update existing or create duplicate)
 */
export async function saveTemplate(
  templateId: string,
  pageImages: string[],
  options: {
    action?: 'update' | 'duplicate'
    title?: string
    userId: string
  }
): Promise<SaveTemplateResponse> {
  try {
    const response = await fetch(`/api/templates/${templateId}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageImages,
        action: options.action || 'update',
        title: options.title,
        userId: options.userId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error saving template:', error)
    throw error
  }
}

/**
 * Complete save workflow: upload images then save template
 */
export async function saveTemplateWithImages(
  templateId: string,
  pageImages: string[],
  options: {
    action?: 'update' | 'duplicate'
    title?: string
    userId: string
    designId?: string
  }
): Promise<{
  uploadResult: UploadImagesResponse
  saveResult: SaveTemplateResponse
}> {
  try {
    // Step 0: Ensure all blob URLs are converted to Supabase URLs
    console.log('🔍 Ensuring all images use Supabase URLs...')
    const finalPageImages = await ensureSupabaseUrls(pageImages)
    
    // Step 1: Validate no blob URLs remain
    validateNoBlobUrls(finalPageImages)
    console.log('✅ Blob URL validation passed - all images are Supabase URLs')
    
    // Step 2: Upload images to cloud storage (should be no-op if already Supabase URLs)
    console.log('🔄 Uploading images to cloud storage...')
    const uploadResult = await uploadImages(finalPageImages, options.userId, options.designId)
    
    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.error}`)
    }
    
    console.log('✅ Images uploaded successfully:', uploadResult.cloudUrls)
    
    // Step 3: Save template with cloud URLs
    console.log('🔄 Saving template...')
    const saveResult = await saveTemplate(templateId, uploadResult.cloudUrls, {
      action: options.action,
      title: options.title,
      userId: options.userId
    })
    
    if (!saveResult.success) {
      throw new Error(`Save failed: ${saveResult.error}`)
    }
    
    console.log('✅ Template saved successfully')
    
    return {
      uploadResult,
      saveResult
    }
  } catch (error) {
    console.error('Error in complete template save workflow:', error)
    throw error
  }
}
