"use client"

import { useState, useEffect, useRef } from 'react'
import HeroSearch from '@/components/HeroSearch'

type Category = {
  id: string
  name: string
  description: string
  slug: string
  created_at: string
  updated_at: string
}

interface FloatingSearchProps {
  initialQuery: string
  categories?: Category[]
  selectedCategory?: string
}

export default function FloatingSearch({ initialQuery, categories, selectedCategory }: FloatingSearchProps) {
  const [visible, setVisible] = useState(true)
  const prevY = useRef<number>(0)
  
  useEffect(() => {
    prevY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y > prevY.current + 10) {
        // scrolling down
        setVisible(false)
      } else if (y < prevY.current - 10) {
        // scrolling up
        setVisible(true)
      }
      prevY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`sticky top-4 z-30 mb-6 transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'pointer-events-none -translate-y-3 opacity-0'}`}>
      <div className="mx-auto max-w-3xl">
        <HeroSearch initialQuery={initialQuery} categories={categories} selectedCategory={selectedCategory} />
      </div>
    </div>
  )
}