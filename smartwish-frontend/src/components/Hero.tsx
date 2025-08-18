'use client'

import { useEffect, useState } from 'react'
import { heroSlides } from '@/resources/hero'

export default function Hero() {
  const [index, setIndex] = useState(0)
  const [lastIndex, setLastIndex] = useState(0)
  const [loaded, setLoaded] = useState<boolean[]>(() => new Array(heroSlides.length).fill(false))

  useEffect(() => {
    const id = setInterval(() => {
      setLastIndex((prev) => index)
      setIndex((i) => (i + 1) % heroSlides.length)
    }, 5000)
    return () => clearInterval(id)
  }, [index])

  const handleLoad = (i: number) => {
    setLoaded((arr) => {
      const next = arr.slice()
      next[i] = true
      return next
    })
  }

  const handleError = (i: number) => {
    setLoaded((arr) => {
      const next = arr.slice()
      next[i] = false
      return next
    })
  }

  return (
    <section className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative h-[280px] sm:h-[400px] lg:h-[520px] overflow-hidden rounded-lg sm:rounded-xl lg:rounded-2xl shadow bg-gray-200">
          {heroSlides.map((s, i) => {
            const isActive = i === index || (i === lastIndex && !loaded[index])
            return (
              <div
                key={s.title}
                className={`absolute inset-0 transition-opacity duration-700 ease-out ${isActive ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden={!isActive}
              >
                <img
                  src={s.image}
                  alt=""
                  onLoad={() => handleLoad(i)}
                  onError={() => handleError(i)}
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex items-end p-4 sm:p-6 lg:p-8">
                  <div className="max-w-xl">
                    <h1 className="text-xl sm:text-3xl lg:text-5xl font-bold text-white leading-tight">{s.title}</h1>
                    <p className="mt-1 sm:mt-2 text-white/90 text-sm sm:text-base lg:text-lg">{s.subtitle}</p>
                    <a
                      href={s.ctaHref}
                      className="mt-3 sm:mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-semibold text-white shadow hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      {s.ctaText}
                    </a>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => {
                  setLastIndex(index)
                  setIndex(i)
                }}
                className={`h-3 w-3 sm:h-2.5 sm:w-2.5 rounded-full transition ${i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}