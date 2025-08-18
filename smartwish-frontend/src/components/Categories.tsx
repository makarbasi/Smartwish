'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'

export type Category = {
  name: string
  href: string
  imageSrc: string
}

type Props = {
  categories: Category[]
}

export default function Categories({ categories }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [itemsPerView, setItemsPerView] = useState(4)
  const [cardWidth, setCardWidth] = useState(240)
  const [gapPx, setGapPx] = useState(12)
  const [index, setIndex] = useState(0)

  const recalc = () => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const w = viewport.clientWidth
    const computed = window.getComputedStyle(track)
    const gap = parseInt(computed.columnGap || computed.gap || '12', 10) || 12

    const vw = window.innerWidth
    const per = vw >= 1280 ? 4 : vw >= 1024 ? 3 : vw >= 640 ? 2 : 1

    const totalGaps = gap * (per - 1)
    const cw = Math.max(160, Math.floor((w - totalGaps) / per))

    setItemsPerView(per)
    setGapPx(gap)
    setCardWidth(cw)

    const maxIndex = Math.max(0, categories.length - per)
    setIndex((i) => Math.min(i, maxIndex))
  }

  useEffect(() => {
    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxIndex = Math.max(0, categories.length - itemsPerView)
  const canPrev = index > 0
  const canNext = index < maxIndex

  const go = (dir: 1 | -1) => {
    setIndex((i) => {
      const next = i + dir
      if (next < 0) return 0
      if (next > maxIndex) return maxIndex
      return next
    })
  }

  return (
    <section className="w-full bg-white">
      <div className="py-8 sm:py-12 lg:py-16 xl:mx-auto xl:max-w-7xl xl:px-8">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-0 sm:flex sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Shop by Category</h2>
          <a href="#" className="hidden text-sm font-semibold text-indigo-600 hover:text-indigo-500 sm:block">
            Browse all categories
            <span aria-hidden> &rarr;</span>
          </a>
        </div>

        <div className="mt-4 sm:mt-6 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-white via-transparent to-white opacity-80 sm:opacity-0" />
          <button
            type="button"
            aria-label="Previous categories"
            onClick={() => go(-1)}
            disabled={!canPrev}
            className={`hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full p-2 shadow ring-1 ring-gray-200 ${
              canPrev ? 'bg-white/90 hover:bg-white' : 'bg-white/60 cursor-not-allowed'
            }`}
          >
            <ChevronLeftIcon className={`size-5 ${canPrev ? 'text-gray-700' : 'text-gray-300'}`} />
          </button>
          <button
            type="button"
            aria-label="Next categories"
            onClick={() => go(1)}
            disabled={!canNext}
            className={`hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full p-2 shadow ring-1 ring-gray-200 ${
              canNext ? 'bg-white/90 hover:bg-white' : 'bg-white/60 cursor-not-allowed'
            }`}
          >
            <ChevronRightIcon className={`size-5 ${canNext ? 'text-gray-700' : 'text-gray-300'}`} />
          </button>

          <div ref={viewportRef} className="relative overflow-hidden px-4 sm:px-6 lg:px-8 xl:px-0">
            <div
              ref={trackRef}
              className="grid grid-flow-col auto-cols-max transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${index * (cardWidth + gapPx)}px)`, columnGap: `${gapPx}px` }}
            >
              {categories.map((category, idx) => (
                <a
                  key={`${idx}-${category.name}`}
                  href={category.href}
                  className="group relative h-56 sm:h-72 lg:h-80 overflow-hidden rounded-lg"
                  style={{ width: `${cardWidth}px` }}
                >
                  <img
                    src={category.imageSrc}
                    alt=""
                    className="absolute inset-0 size-full object-cover transform transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-gray-800/70 to-transparent" />
                  <span className="relative z-10 mt-auto flex h-full items-end justify-center p-3 sm:p-4 lg:p-6 text-center text-base sm:text-lg lg:text-xl font-bold text-white">
                    {category.name}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Mobile arrows under the carousel */}
          <div className="mt-4 flex justify-center gap-4 sm:hidden">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={!canPrev}
              className={`rounded-full p-2 shadow ring-1 ring-gray-200 ${
                canPrev ? 'bg-white' : 'bg-white/70 cursor-not-allowed'
              }`}
            >
              <ChevronLeftIcon className={`size-5 ${canPrev ? 'text-gray-700' : 'text-gray-300'}`} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={!canNext}
              className={`rounded-full p-2 shadow ring-1 ring-gray-200 ${
                canNext ? 'bg-white' : 'bg-white/70 cursor-not-allowed'
              }`}
            >
              <ChevronRightIcon className={`size-5 ${canNext ? 'text-gray-700' : 'text-gray-300'}`} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}