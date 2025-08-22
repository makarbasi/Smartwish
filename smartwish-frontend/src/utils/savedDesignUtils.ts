// Utility functions for saved design operations

export interface SaveSavedDesignResponse {
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
      credentials: 'include',
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
 * Save saved design (update existing or create duplicate)
 */
export async function saveSavedDesign(
  designId: string,
  pageImages: string[],
  options: {
    action?: 'update' | 'duplicate'
    title?: string
    userId: string
  }
): Promise<SaveSavedDesignResponse> {
  try {
    let endpoint: string
    let method: string
    let body: any

    if (options.action === 'duplicate') {
      // For duplicate, create a new design using POST to /api/saved-designs
      endpoint = `/api/saved-designs`
      method = 'POST'
      body = {
        title: options.title,
        description: `Copy of design`,
        imageUrls: pageImages, // Updated page images
        thumbnail: pageImages[0], // First image becomes cover
        designData: {
          templateKey: 'custom',
          pages: pageImages.map((image, index) => ({
            header: '',
            image: image,
            text: '',
            footer: ''
          })),
          editedPages: Object.fromEntries(
            pageImages.map((_, index) => [index, pageImages[index]])
          )
        }
      }
    } else {
      // For update, use PUT to existing design
      endpoint = `/api/saved-designs/${designId}`
      method = 'PUT'
      body = {
        title: options.title,
        imageUrls: pageImages, // Updated page images
        thumbnail: pageImages[0], // First image becomes cover
        designData: {
          templateKey: 'custom',
          pages: pageImages.map((image, index) => ({
            header: '',
            image: image,
            text: '',
            footer: ''
          })),
          editedPages: Object.fromEntries(
            pageImages.map((_, index) => [index, pageImages[index]])
          )
        }
      }
    }
    
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Save design API error:', response.status, errorText)
      throw new Error(`Save failed (${response.status}): ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error saving saved design:', error)
    throw error
  }
}

/**
 * Complete save workflow: save design with images directly
 */
export async function saveSavedDesignWithImages(
  designId: string,
  pageImages: string[],
  options: {
    action?: 'update' | 'duplicate'
    title?: string
    userId: string
    designId?: string
  }
): Promise<{
  saveResult: SaveSavedDesignResponse
}> {
  try {
    console.log('🔄 Saving design with images...')
    
    // Save design directly with image URLs
    const saveResult = await saveSavedDesign(designId, pageImages, {
      action: options.action,
      title: options.title,
      userId: options.userId
    })
    
    if (!saveResult.success) {
      throw new Error(`Save failed: ${saveResult.error}`)
    }
    
    console.log('✅ Saved design updated successfully')
    
    return {
      saveResult
    }
  } catch (error) {
    console.error('Error in save workflow:', error)
    throw error
  }
}