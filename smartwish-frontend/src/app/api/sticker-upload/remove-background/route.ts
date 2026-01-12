import { NextRequest, NextResponse } from 'next/server'

// POST - Remove background from image
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64 } = body

    if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Valid base64 image data is required' },
        { status: 400 }
      )
    }

    console.log('[RemoveBackground] Processing image, size:', imageBase64.length)

    // Dynamically import to avoid webpack bundling issues with native modules
    const { removeBackground } = await import('@imgly/background-removal-node')

    // Extract base64 data (everything after the comma)
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64
    
    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    console.log('[RemoveBackground] Buffer created, size:', imageBuffer.length, 'bytes')
    
    // Check image format by magic number
    const magicNumber = imageBuffer.slice(0, 4)
    const isJPEG = magicNumber[0] === 0xFF && magicNumber[1] === 0xD8
    const isPNG = magicNumber[0] === 0x89 && magicNumber[1] === 0x50 && magicNumber[2] === 0x4E && magicNumber[3] === 0x47
    const isWebP = magicNumber[0] === 0x52 && magicNumber[1] === 0x49 && magicNumber[2] === 0x46 && magicNumber[3] === 0x46
    
    console.log('[RemoveBackground] Image format detection:', {
      isJPEG,
      isPNG,
      isWebP,
      magicBytes: Array.from(magicNumber).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    })
    
    if (!isJPEG && !isPNG && !isWebP) {
      return NextResponse.json(
        { error: 'Unsupported image format. Please use JPEG, PNG, or WebP.' },
        { status: 400 }
      )
    }
    
    // Try with Buffer first (library accepts Buffer, Uint8Array, Blob, File, URL)
    let blob: Blob;
    try {
      blob = await removeBackground(imageBuffer)
    } catch (bufferError: any) {
      console.log('[RemoveBackground] Buffer failed, trying Blob...', bufferError?.message);
      // If Buffer fails, try Blob (Node.js 18+)
      const mimeType = isPNG ? 'image/png' : isWebP ? 'image/webp' : 'image/jpeg'
      const imageBlob = new Blob([imageBuffer], { type: mimeType })
      blob = await removeBackground(imageBlob)
    }
    
    // Convert Blob to base64
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const resultBase64 = `data:image/png;base64,${buffer.toString('base64')}`

    console.log('[RemoveBackground] Background removed successfully, result size:', resultBase64.length)

    return NextResponse.json({
      success: true,
      imageBase64: resultBase64
    })
  } catch (error) {
    console.error('[RemoveBackground] Error removing background:', error)
    return NextResponse.json(
      { error: 'Failed to remove background', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
