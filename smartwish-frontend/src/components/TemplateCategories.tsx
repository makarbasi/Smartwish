'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'

type Template = {
  id: string
  slug: string
  title: string
  category_id: string
  author_id: string
  description: string
  price: number
  language: string
  region: string
  status: string
  popularity: number
  num_downloads: number
  cover_image: string
  current_version: string
  published_at: string
  created_at: string
  updated_at: string
  image_1: string
  image_2: string
  image_3: string
  image_4: string
}

type Category = {
  id: string
  name: string
  description: string
  slug: string
  created_at: string
  updated_at: string
}

type CategoryTemplates = {
  category: Category
  templates: Template[]
}

type ApiResponse = {
  success: boolean
  data: CategoryTemplates[]
  count: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function TemplateCardSkeleton() {
  return (
    <div className="group cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200">
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="aspect-[3/4] w-full bg-gray-200 animate-pulse" />
      </div>
      <div className="px-4 pt-3 pb-5 text-left">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
      </div>
    </div>
  )
}

function CategorySkeleton() {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48"></div>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-24"></div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4 lg:grid-cols-4">
        {Array(4).fill(0).map((_, i) => (
          <TemplateCardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    </div>
  )
}

export default function TemplateCategories() {
  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse>('/api/templates/categories?limit=4', fetcher)

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center text-red-600">
        Failed to load templates. Please try again later.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div>
        {Array(3).fill(0).map((_, i) => (
          <CategorySkeleton key={`category-skeleton-${i}`} />
        ))}
      </div>
    )
  }

  const categoryTemplates = apiResponse?.data || []

  if (categoryTemplates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-12 text-center text-gray-600">
        No templates found.
      </div>
    )
  }

  return (
    <div>
      {categoryTemplates.map((categoryData) => {
        const { category, templates } = categoryData
        
        return (
          <div key={category.id} className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                {category.name}
              </h2>
              <Link 
                href={`/templates?category=${category.id}`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                View all
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4 lg:grid-cols-4">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  href={`/templates?q=${encodeURIComponent(template.title)}`}
                  className="group cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
                >
                  <div className="relative overflow-hidden rounded-t-2xl">
                    <Image
                      alt={template.title}
                      src={template.image_1}
                      width={400}
                      height={533}
                      className="aspect-[3/4] w-full bg-gray-100 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute right-3 top-3">
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        template.price === 0 
                          ? 'bg-green-50 text-green-700 ring-green-200' 
                          : 'bg-gray-100 text-gray-900 ring-gray-200'
                      }`}>
                        {template.price === 0 ? 'Free' : `$${template.price.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 pt-3 pb-5 text-left">
                    <h3 className="line-clamp-1 text-[16px] font-semibold leading-6 text-gray-900">
                      {template.title}
                    </h3>
                    <div className="mt-1.5 text-[13px] text-gray-600">
                      {template.num_downloads.toLocaleString()} downloads
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}