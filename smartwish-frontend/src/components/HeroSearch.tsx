'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState, FormEvent } from 'react'

const quickActions = [
  'Design for me',
  'Create an image',
  'Draft a doc',
  'Code for me',
  'Create a video clip',
]

type Category = {
  id: string
  name: string
  description: string
  slug: string
  created_at: string
  updated_at: string
}

type Props = { 
  chips?: string[]; 
  initialQuery?: string; 
  searchRoute?: string;
  categories?: Category[];
  selectedCategory?: string;
}

export default function HeroSearch(props: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(props.initialQuery ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [region, setRegion] = useState('Any region')
  const [language, setLanguage] = useState('Any language')
  const [category, setCategory] = useState(props.selectedCategory ?? '')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const query = q.trim()
    const params = new URLSearchParams()
    if (query.length > 0) params.set('q', query)
    
    // Determine the search route based on props or current pathname
    let searchRoute = props.searchRoute
    if (!searchRoute) {
      if (pathname?.startsWith('/marketplace')) {
        searchRoute = '/marketplace'
      } else {
        searchRoute = '/templates'
        // Only add region/language/category filters for templates
        if (region && region !== 'Any region') params.set('region', region)
        if (language && language !== 'Any language') params.set('language', language)
        if (category) params.set('category', category)
      }
    }
    
    const search = params.toString()
    router.push(`${searchRoute}${search ? `?${search}` : ''}`)
    setOpen(false)
  }

  // close on outside click
  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(ev.target as Node)) setOpen(false)
    }
    function onEsc(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  // Sync when initialQuery prop changes
  useEffect(() => {
    if (typeof props.initialQuery === 'string') setQ(props.initialQuery)
  }, [props.initialQuery])

  // Sync when selectedCategory prop changes
  useEffect(() => {
    setCategory(props.selectedCategory ?? '')
  }, [props.selectedCategory])

  // Speech recognition
  const [recording, setRecording] = useState(false)

  const startVoice = () => {
    if (typeof window === 'undefined') return
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    setRecording(true)

    recognition.onstart = () => {
      console.log('🎤 Voice recognition started')
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('🗣️ Voice input:', transcript)
      
      // Add the transcript to the search query
      setQ((prev) => {
        const newQuery = prev ? `${prev} ${transcript}` : transcript
        return newQuery.trim()
      })
    }

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error)
      setRecording(false)
      
      // Show user-friendly error messages
      switch (event.error) {
        case 'no-speech':
          alert('No speech detected. Please try again.')
          break
        case 'audio-capture':
          alert('No microphone found. Please check your microphone permissions.')
          break
        case 'not-allowed':
          alert('Microphone access denied. Please allow microphone access and try again.')
          break
        case 'network':
          alert('Network error. Please check your internet connection.')
          break
        default:
          alert('Speech recognition failed. Please try again.')
      }
    }

    recognition.onend = () => {
      console.log('🔇 Voice recognition ended')
      setRecording(false)
    }

    recognition.start()
  }

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      <form
        onSubmit={onSubmit}
        className={`flex items-center gap-1 sm:gap-2 rounded-2xl bg-white/95 p-1.5 sm:p-2 shadow-sm ring-1 ring-gray-300 backdrop-blur transition focus-within:ring-indigo-400 ${
          open ? 'ring-indigo-400 shadow-md' : ''
        }`}
      >
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQ(e.target.value)}
          type="text"
          aria-label="Search"
          placeholder="Describe your idea, and we'll bring it to life"
          className="flex-1 min-w-0 rounded-2xl bg-transparent px-2 sm:px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />

        {/* Voice Input Button */}
        <button
          type="button"
          onClick={startVoice}
          disabled={recording}
          aria-label={recording ? "Recording..." : "Voice search"}
          className={`flex-shrink-0 mr-1 sm:mr-2 grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 transition-all ${
            recording 
              ? 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:outline-gray-600'
          }`}
        >
          {recording ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" aria-hidden>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <button
          type="submit"
          aria-label="Search"
          className="flex-shrink-0 mr-0.5 sm:mr-1 grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </form>

      {open && !pathname?.startsWith('/marketplace') && props.categories && props.categories.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-gray-200">
          {/* lightweight filters - only show for templates */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
            >
              <option value="">All Categories</option>
              {props.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
            >
              {['Any region', 'Global', 'United States', 'United Kingdom', 'Europe', 'India', 'Japan'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
            >
              {['Any language', 'English', 'Spanish', 'French', 'German', 'Hindi', 'Chinese'].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 text-center text-xs text-gray-500">Press Enter to search. Filters are optional.</div>
        </div>
      )}
    </div>
  )
}


