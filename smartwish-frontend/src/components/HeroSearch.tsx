'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState, FormEvent } from 'react'
import useSWR from 'swr'
import { useDeviceMode } from '@/contexts/DeviceModeContext'
import { useKioskConfig } from '@/hooks/useKioskConfig'

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
  const { isKiosk } = useDeviceMode()
  const { config: kioskConfig } = useKioskConfig()
  const micEnabled = kioskConfig?.micEnabled !== false
  const [q, setQ] = useState(props.initialQuery ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [region, setRegion] = useState('Any region')
  const [language, setLanguage] = useState('Any language')
  const [author, setAuthor] = useState('Any author')
  const [category, setCategory] = useState(props.selectedCategory ?? '')

  // Fetcher function for SWR
  const fetcher = (url: string) => fetch(url).then((res) => res.json())

  // Fetch available regions, languages, and authors from the backend
  const { data: regionsData } = useSWR<{ regions: string[] }>('/api/templates/regions', fetcher)
  const { data: languagesData } = useSWR<{ languages: string[] }>('/api/templates/languages', fetcher)
  const { data: authorsData } = useSWR<{ authors: string[] }>('/api/templates/authors', fetcher)

  // Debug: Log available options when they load
  useEffect(() => {
    if (regionsData) {
      console.log('🌍 Available regions:', regionsData.regions)
    }
  }, [regionsData])

  useEffect(() => {
    if (languagesData) {
      console.log('🌐 Available languages:', languagesData.languages)
    }
  }, [languagesData])

  useEffect(() => {
    if (authorsData) {
      console.log('👥 Available authors:', authorsData.authors)
    }
  }, [authorsData])

  const availableRegions = regionsData?.regions || ['Any region']
  const availableLanguages = languagesData?.languages || ['Any language']
  const availableAuthors = authorsData?.authors || ['Any author']

  // Reset region/language if current value is not available
  useEffect(() => {
    if (regionsData?.regions && !regionsData.regions.includes(region)) {
      setRegion('Any region')
    }
  }, [regionsData, region])

  useEffect(() => {
    if (languagesData?.languages && !languagesData.languages.includes(language)) {
      setLanguage('Any language')
    }
  }, [languagesData, language])

  useEffect(() => {
    if (authorsData?.authors && !authorsData.authors.includes(author)) {
      setAuthor('Any author')
    }
  }, [authorsData, author])

  // Initialize filters from URL parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlRegion = urlParams.get('region')
      const urlLanguage = urlParams.get('language')
      const urlAuthor = urlParams.get('author')
      const urlCategory = urlParams.get('category')

      if (urlRegion) setRegion(urlRegion)
      if (urlLanguage) setLanguage(urlLanguage)
      if (urlAuthor) setAuthor(urlAuthor)
      if (urlCategory) setCategory(urlCategory)
    }
  }, [pathname])

  // Function to handle navigation with current state
  const navigateWithCurrentState = (overrides: {
    query?: string;
    region?: string;
    language?: string;
    author?: string;
    category?: string
  } = {}) => {
    const query = (overrides.query !== undefined ? overrides.query : q).trim()
    const currentRegion = overrides.region !== undefined ? overrides.region : region
    const currentLanguage = overrides.language !== undefined ? overrides.language : language
    const currentAuthor = overrides.author !== undefined ? overrides.author : author
    const currentCategory = overrides.category !== undefined ? overrides.category : category

    const params = new URLSearchParams()
    if (query.length > 0) params.set('q', query)

    // Determine the search route based on props or current pathname
    let searchRoute = props.searchRoute
    if (!searchRoute) {
      if (pathname?.startsWith('/marketplace')) {
        searchRoute = '/marketplace'
      } else {
        searchRoute = '/templates'
      }
    }

    // Add region/language/author/category filters for templates (whether auto-determined or from props)
    if (searchRoute === '/templates') {
      if (currentRegion && currentRegion !== 'Any region') params.set('region', currentRegion)
      if (currentLanguage && currentLanguage !== 'Any language') params.set('language', currentLanguage)
      if (currentAuthor && currentAuthor !== 'Any author') params.set('author', currentAuthor)
      if (currentCategory) params.set('category', currentCategory)
    }

    const search = params.toString()
    router.push(`${searchRoute}${search ? `?${search}` : ''}`)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigateWithCurrentState()
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
    if (!micEnabled) {
      alert('Microphone is disabled on this kiosk.')
      return
    }

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

    // Clear existing text when mic is clicked
    setQ('')
    setRecording(true)

    recognition.onstart = () => {
      console.log('🎤 Voice recognition started - previous text cleared')
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('🗣️ Voice input:', transcript)

      // Set the transcript as the new search query (replacing any previous text)
      setQ(transcript.trim())
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
    <div ref={ref} className="relative mx-auto max-w-4xl">
      <form
        onSubmit={onSubmit}
        className={`flex items-center gap-2 sm:gap-3 rounded-3xl bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-4 sm:p-5 shadow-2xl ring-2 ring-indigo-200/60 backdrop-blur-md transition-all duration-300 focus-within:ring-indigo-500 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.4)] focus-within:scale-[1.02] ${open ? 'ring-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]' : 'animate-pulse-glow'
          }`}
        style={{
          boxShadow: open 
            ? '0 20px 60px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)' 
            : '0 10px 40px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.1)'
        }}
      >
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQ(e.target.value)}
          type="text"
          aria-label="Search"
          placeholder="Search in natural language... e.g., 'birthday card for mom' or 'thank you card'"
          className="flex-1 min-w-0 rounded-2xl bg-transparent px-4 sm:px-6 py-3 sm:py-4 text-lg sm:text-xl text-gray-900 placeholder:text-gray-500 placeholder:font-medium focus:outline-none"
        />

        {/* Voice Input Button - hidden when micEnabled is false */}
        {micEnabled && (
          <button
            type="button"
            onClick={startVoice}
            disabled={recording}
            aria-label={recording ? "Recording..." : "Voice search"}
            className={`flex-shrink-0 mr-1 sm:mr-2 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 transition-all ${recording
              ? 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 animate-pulse'
              : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:scale-110 focus-visible:outline-indigo-600'
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
        )}

        <button
          type="submit"
          aria-label="Search"
          className="flex-shrink-0 mr-0.5 sm:mr-1 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg hover:from-indigo-500 hover:to-purple-500 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all transform"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </form>

      {open && props.categories && props.categories.length > 0 && (
        isKiosk ? (
          // KIOSK MODE - Modern App Design
          <div className="absolute left-0 right-0 top-full z-20 mt-3">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 shadow-2xl ring-2 ring-indigo-100 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter Templates
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Category Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCategory = e.target.value
                      setCategory(newCategory)
                      navigateWithCurrentState({ category: newCategory })
                    }}
                    className="w-full rounded-xl bg-white px-4 py-3.5 text-base font-semibold text-gray-800 shadow-lg ring-2 ring-indigo-200 hover:ring-indigo-400 focus:outline-none focus:ring-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {props.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Region Filter */}
                {!pathname?.startsWith('/marketplace') && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Region
                    </label>
                    <select
                      value={region}
                      onChange={(e) => {
                        const newRegion = e.target.value
                        setRegion(newRegion)
                        navigateWithCurrentState({ region: newRegion })
                      }}
                      className="w-full rounded-xl bg-white px-4 py-3.5 text-base font-semibold text-gray-800 shadow-lg ring-2 ring-green-200 hover:ring-green-400 focus:outline-none focus:ring-green-500 transition-all cursor-pointer"
                    >
                      {availableRegions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Language Filter */}
                {!pathname?.startsWith('/marketplace') && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => {
                        const newLanguage = e.target.value
                        setLanguage(newLanguage)
                        navigateWithCurrentState({ language: newLanguage })
                      }}
                      className="w-full rounded-xl bg-white px-4 py-3.5 text-base font-semibold text-gray-800 shadow-lg ring-2 ring-blue-200 hover:ring-blue-400 focus:outline-none focus:ring-blue-500 transition-all cursor-pointer"
                    >
                      {availableLanguages.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Author Filter */}
                {!pathname?.startsWith('/marketplace') && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Author
                    </label>
                    <select
                      value={author}
                      onChange={(e) => {
                        const newAuthor = e.target.value
                        setAuthor(newAuthor)
                        navigateWithCurrentState({ author: newAuthor })
                      }}
                      className="w-full rounded-xl bg-white px-4 py-3.5 text-base font-semibold text-gray-800 shadow-lg ring-2 ring-purple-200 hover:ring-purple-400 focus:outline-none focus:ring-purple-500 transition-all cursor-pointer"
                    >
                      {availableAuthors.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div 
                onClick={() => {
                  // Clear all filters
                  setCategory('')
                  setRegion('Any region')
                  setLanguage('Any language')
                  setAuthor('Any author')
                  // Navigate with cleared filters
                  navigateWithCurrentState({ 
                    category: '', 
                    region: 'Any region', 
                    language: 'Any language', 
                    author: 'Any author' 
                  })
                }}
                className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-indigo-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters
              </div>
            </div>
          </div>
        ) : (
          // REGULAR MODE - Compact Design
          <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-gray-200">
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Category"
                value={category}
                onChange={(e) => {
                  const newCategory = e.target.value
                  setCategory(newCategory)
                  navigateWithCurrentState({ category: newCategory })
                }}
                className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
              >
                <option value="">All Categories</option>
                {props.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {!pathname?.startsWith('/marketplace') && (
                <>
                  <select
                    aria-label="Region"
                    value={region}
                    onChange={(e) => {
                      const newRegion = e.target.value
                      setRegion(newRegion)
                      navigateWithCurrentState({ region: newRegion })
                    }}
                    className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
                  >
                    {availableRegions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Language"
                    value={language}
                    onChange={(e) => {
                      const newLanguage = e.target.value
                      setLanguage(newLanguage)
                      navigateWithCurrentState({ language: newLanguage })
                    }}
                    className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
                  >
                    {availableLanguages.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Author"
                    value={author}
                    onChange={(e) => {
                      const newAuthor = e.target.value
                      setAuthor(newAuthor)
                      navigateWithCurrentState({ author: newAuthor })
                    }}
                    className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none"
                  >
                    {availableAuthors.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="mt-3 text-center text-xs text-gray-500">
              {pathname?.startsWith('/marketplace')
                ? 'Select category to filter gift cards. Press Enter to search with text.'
                : 'Filters apply immediately. Press Enter to search with text.'
              }
            </div>
          </div>
        )
      )}

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 10px 40px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.1);
          }
          50% {
            box-shadow: 0 15px 50px rgba(99, 102, 241, 0.35), 0 0 0 1px rgba(99, 102, 241, 0.2);
          }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}


