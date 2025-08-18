import React, { useState } from 'react'
import Image from 'next/image'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'

export default function GeminiImageEditor() {
  const [image, setImage] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!image) return setError('Please choose an image.')
    if (!prompt.trim()) return setError('Please enter a prompt.')

    setLoading(true)
    setError(null)
    setResultUrl(null)

    try {
      const formData = new FormData()
      formData.append('image', image)
      formData.append('prompt', prompt)

      // POST to the documented backend endpoint
      const res = await fetch(`${baseUrl}/gemini-inpaint`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const data = await res.json()

      // Support different backend response shapes
      if (data?.imageUrl) {
        setResultUrl(data.imageUrl)
      } else if (data?.imageBase64) {
        setResultUrl(data.imageBase64)
      } else if (data?.image) {
        // some backends return { image: { url: '...' } }
        setResultUrl(data.image.url || data.image)
      } else {
        console.error('Unexpected response from inpaint endpoint', data)
        setError('No image returned from server')
      }
    } catch (err: unknown) {
      console.error('Gemini inpaint error', err)
      const message = err instanceof Error ? err.message : String(err)
      setError(message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="mt-1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your image edit..."
            className="w-full mt-1 p-2 border rounded"
            rows={4}
            required
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Generate with Gemini'}
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>

      {resultUrl && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Generated Image</h3>
          <div className="w-full">
            <Image src={resultUrl} alt="Generated" width={800} height={600} style={{ maxWidth: '100%', height: 'auto' }} unoptimized />
          </div>
          <div className="mt-2">
            <a href={resultUrl} download className="text-sm text-indigo-600 underline">
              Download Image
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
