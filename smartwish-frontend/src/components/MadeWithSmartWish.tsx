'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import useSWR from 'swr'

type Template = {
  id: string
  title: string
  image_1: string
  image_2: string
  image_3: string
  image_4: string
}

type ApiResponse = {
  success: boolean
  data: Template[]
  count: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function ImageSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 shadow-sm">
      <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
    </div>
  )
}

export default function MadeWithSmartWish() {
  const [randomImages, setRandomImages] = useState<string[]>([])
  
  // Fetch templates from API - get more than 8 to have variety for randomization
  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse>('/api/templates?limit=20', fetcher)
  
  const templates = apiResponse?.data || []

  // Generate random cover images when templates are loaded
  useEffect(() => {
    if (templates.length > 0) {
      // Collect only cover images (image_1) from templates
      const coverImages = templates
        .filter(template => template.image_1)
        .map(template => template.image_1)
      
      // Shuffle and select 8 random cover images
      const shuffled = coverImages.sort(() => 0.5 - Math.random())
      setRandomImages(shuffled.slice(0, 8))
    }
  }, [templates])

  return (
    <div>
      <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Made with SmartWish</h2>
      <p className="mx-auto mt-1 max-w-2xl text-center text-sm text-gray-500">Take a look at some of the cards created by our users.</p>
      
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {isLoading ? (
          // Show 8 skeleton loaders
          Array(8).fill(0).map((_, idx) => (
            <ImageSkeleton key={`skeleton-${idx}`} />
          ))
        ) : error ? (
          // Error state - show message
          <div className="col-span-full text-center text-red-600 py-8">
            Failed to load card samples
          </div>
        ) : (
          // Show random template images
          randomImages.map((src, idx) => (
            <div key={`${src}-${idx}`} className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 shadow-sm">
              <Image
                alt="Card sample"
                src={src}
                width={640}
                height={989}
                className="aspect-[640/989] w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}