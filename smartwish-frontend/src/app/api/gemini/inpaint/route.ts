import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const prompt = formData.get('prompt')?.toString() || ''

    // Support single or multiple files
    const images = formData.getAll('image') as File[]
    const extraImages = formData.getAll('extraImage') as File[]

    const imageFile = images && images.length > 0 ? images[0] : undefined

    if (!imageFile || !prompt) {
      return NextResponse.json({ message: 'Image and prompt are required' }, { status: 400 })
    }

    // Convert primary image to base64
    const imageBuf = Buffer.from(await imageFile.arrayBuffer())
    const base64Image = imageBuf.toString('base64')

  const parts: Record<string, unknown>[] = [
      {
        inline_data: {
          mime_type: imageFile.type || 'image/png',
          data: base64Image,
        },
      },
      {
        text: prompt,
      },
    ]

    // Optional extra image
    if (extraImages && extraImages.length > 0) {
      const extra = extraImages[0]
      const extraBuf = Buffer.from(await extra.arrayBuffer())
      const base64Extra = extraBuf.toString('base64')
      parts.push({
        inline_data: {
          mime_type: extra.type || 'image/png',
          data: base64Extra,
        },
      })
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generation_config: {
        response_modalities: ['image', 'text'],
        response_mime_type: 'text/plain',
      },
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: 'GEMINI_API_KEY is not configured' }, { status: 500 })
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      return NextResponse.json({ message: 'Gemini API failed', error: errorText }, { status: 500 })
    }

    const data = await response.json()

    // Response may include image in candidates[0].content.parts
    type Part = Record<string, unknown> & {
      inlineData?: { data: string; mime_type?: string }
      inline_data?: { data: string; mime_type?: string }
      text?: string
    }

    const partsResp = (data?.candidates?.[0]?.content?.parts as Part[]) || []

    const extractInline = (part: Part) => part.inlineData ?? part.inline_data ?? null

    const partWithImage = partsResp.find((p) => extractInline(p) !== null)

    if (partWithImage) {
      const inline = extractInline(partWithImage) as { data: string; mime_type?: string } | null
      if (!inline || !inline.data) {
        console.error('Malformed inline data from Gemini response', partWithImage)
        return NextResponse.json({ message: 'Malformed response from Gemini' }, { status: 500 })
      }

      const modifiedImageBase64 = inline.data
      const mimeType = inline.mime_type ?? 'image/png'

      // Return data URL to caller (base64 string)
      const dataUrl = `data:${mimeType};base64,${modifiedImageBase64}`

      return NextResponse.json({ imageBase64: dataUrl })
    } else {
      const fallback = partsResp.find((p) => typeof p.text === 'string')
      const fallbackText = fallback?.text
      console.error('No image returned from Gemini', fallbackText || data)
      return NextResponse.json({ message: 'No image returned from Gemini', details: fallbackText || data }, { status: 500 })
    }
  } catch (error) {
    console.error('Gemini inpaint route error:', error)
    return NextResponse.json({ message: 'Internal server error', error: String(error) }, { status: 500 })
  }
}
