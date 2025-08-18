'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type Template = {
  id: string
  title: string
  image_1: string
  num_downloads: number
  created_at: string
  category_name?: string
  category_display_name?: string
  author?: string
}

type ApiResponse = {
  success: boolean
  data: Template[]
  count?: number
  total?: number
}

type Category = {
  id: string
  name: string
  description: string
  slug: string
  created_at: string
  updated_at: string
}

type CategoriesResponse = {
  success: boolean
  data: Category[]
  count: number
}

type GallerySectionProps = {
	chips?: string[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function GallerySection({ chips }: GallerySectionProps) {
    const router = useRouter()
    
    // Fetch categories from API
    const { data: categoriesResponse } = useSWR<CategoriesResponse>('/api/categories', fetcher)
    const categories = categoriesResponse?.data || []
    
    // Use first category as initial selection or fallback to hardcoded chips
    const availableCategories = categories.length > 0 ? categories : []
    const categoryChips = availableCategories.map(cat => cat.name)
    const allChips = categoryChips.length > 0 ? categoryChips : (chips || [])
    
    const initial = allChips.length > 0 ? allChips[0] : ''
    const [selected, setSelected] = useState<string>(initial)
    
    // Find selected category ID
    const selectedCategory = categories.find(cat => cat.name === selected)
    const selectedCategoryId = selectedCategory?.id
    
    // Fetch templates for selected category (max 4)
    const templatesUrl = selectedCategoryId ? `/api/templates?category_id=${selectedCategoryId}&limit=4` : '/api/templates?limit=4'
    const { data: apiResponse, error, isLoading } = useSWR<ApiResponse>(templatesUrl, fetcher)
    
    const templates = apiResponse?.data || []
    
    // Handle template click - navigate to templates page and open the clicked template
    const handleTemplateClick = (template: Template) => {
        // Store the template ID to open in sessionStorage
        sessionStorage.setItem('openTemplateId', template.id)
        // Navigate to templates page
        router.push('/templates')
    }

    // Update selected when categories are loaded and initial is empty
    useEffect(() => {
        if (categories.length > 0 && !selected && allChips.length > 0) {
            setSelected(allChips[0])
        }
    }, [categories, selected, allChips])
    
    // listen to external hero chip selections
    useEffect(() => {
        function handler(e: any) {
            const value = e?.detail
            if (typeof value === 'string' && allChips.includes(value)) {
                setSelected(value)
            }
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('gallery:select', handler as EventListener)
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.removeEventListener('gallery:select', handler as EventListener)
            }
        }
    }, [allChips])

	return (
        <div>
            {/* Centered chips filter */}
            {allChips && allChips.length > 0 && (
                <div className="mb-6 flex flex-wrap justify-center gap-2">
                    {allChips.map((c) => {
                        const active = selected === c
                        return (
                            <button
                                key={c}
                                onClick={() => setSelected(c)}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                                    active
                                        ? 'bg-indigo-600 text-white ring-indigo-600'
                                        : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {c}
                            </button>
                        )
                    })}
                </div>
            )}

			{/* Grid */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{isLoading ? (
					// Skeleton loading - exact same layout
					Array(4).fill(0).map((_, idx) => (
						<div key={`skeleton-${idx}`} className="group overflow-hidden rounded-lg border border-gray-200 bg-white">
							<div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
							<div className="p-3">
								<div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
								<div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
							</div>
						</div>
					))
				) : error ? (
					// Error state
					<div className="col-span-full text-center text-red-600 py-8">
						Failed to load templates
					</div>
				) : (
					// Template data
					templates.slice(0, 4).map((template, idx) => {
						const daysAgo = Math.floor((Date.now() - new Date(template.created_at).getTime()) / (1000 * 60 * 60 * 24))
						return (
							<div 
								key={template.id} 
								className="group overflow-hidden rounded-lg border border-gray-200 bg-white cursor-pointer"
								onClick={() => handleTemplateClick(template)}
							>
								<Image
									alt={template.title}
									src={template.image_1}
									width={640}
									height={989}
									className="aspect-[640/989] w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
								<div className="p-3">
									<div className="text-sm font-semibold leading-5 text-gray-900 line-clamp-1">{template.title}</div>
									<div className="mt-1 text-xs text-gray-600">Created {daysAgo > 0 ? `${daysAgo}d` : '1d'} ago</div>
								</div>
							</div>
						)
					})
				)}
			</div>
		</div>
	)
}

