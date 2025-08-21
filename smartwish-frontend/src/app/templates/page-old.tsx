"use client"

import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { HeartIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { EllipsisHorizontalIcon, MagnifyingGlassIcon, FlagIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogBackdrop, DialogPanel, Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import HTMLFlipBook from "react-pageflip"
import useSWR from 'swr'
import HeroSearch from '@/components/HeroSearch'
import AuthModal from '@/components/AuthModal'
// Lazy-load the heavy editor (Pintura) only on the client when needed
const GiftCardEditorSimple = dynamic(() => import('@/components/GiftCardEditorSimple'), {
  ssr: false,
})

type ApiTemplate = {
  id: string
  slug: string
  title: string
  category_id: string
  author_id: string
  description: string
  price: string | number
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
  category_name?: string
  category_display_name?: string
  author?: string
}

type ApiResponse = {
  success: boolean
  data: ApiTemplate[]
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

type TemplateCard = {
  id: string
  name: string
  price: string
  rating: number
  reviewCount: number
  imageSrc: string
  imageAlt: string
  publisher: { name: string; avatar: string }
  downloads: number
  likes: number
  pages?: string[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Transform API data to TemplateCard format
function transformApiTemplate(apiTemplate: ApiTemplate): TemplateCard {
  // Handle price field which can be string or number
  const priceValue = typeof apiTemplate.price === 'string' ? parseFloat(apiTemplate.price) : apiTemplate.price
  const formattedPrice = priceValue > 0 ? `$${priceValue.toFixed(2)}` : '$0'
  
  return {
    id: apiTemplate.id,
    name: apiTemplate.title,
    price: formattedPrice,
    rating: Math.min(5, Math.max(1, Math.round(apiTemplate.popularity / 20))), // Convert popularity to 1-5 rating
    reviewCount: Math.floor(apiTemplate.num_downloads / 10), // Estimate reviews from downloads
    imageSrc: apiTemplate.image_1,
    imageAlt: `${apiTemplate.title} template`,
    publisher: { 
      name: apiTemplate.author || 'SmartWish Studio', 
      avatar: 'https://i.pravatar.cc/80?img=1' 
    },
    downloads: apiTemplate.num_downloads,
    likes: Math.floor(apiTemplate.num_downloads / 10), // Estimate likes from downloads
    pages: [apiTemplate.image_1, apiTemplate.image_2, apiTemplate.image_3, apiTemplate.image_4].filter(Boolean)
  }
}

function TemplateCardSkeleton() {
  return (
    <div className="group cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200">
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
        <div className="absolute right-3 top-3 flex gap-2">
          <div className="h-8 w-16 bg-gray-300 rounded-lg animate-pulse"></div>
          <div className="h-8 w-8 bg-gray-300 rounded-lg animate-pulse"></div>
        </div>
      </div>
      <div className="px-4 pt-3 pb-5 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <div className="mt-1.5 h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
      </div>
    </div>
  )
}


function TemplatesPageContent() {
  const { data: session, status } = useSession()
  const sp = useSearchParams()
  const q = sp?.get('q') ?? ''
  const region = sp?.get('region') ?? ''
  const language = sp?.get('language') ?? ''
  const category = sp?.get('category') ?? ''
  const pageFromQuery = sp?.get('page') ?? '1'
  const initialPage = Math.max(1, parseInt(pageFromQuery || '1', 10) || 1)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewProduct, setPreviewProduct] = useState<TemplateCard | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorProduct, setEditorProduct] = useState<TemplateCard | null>(null)
  const [page, setPage] = useState<number>(initialPage)
  const [selectedCategory, setSelectedCategory] = useState<string>(category)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const router = useRouter()
  
  // Debug: Track authModalOpen state changes (only when it changes)
  useEffect(() => {
    console.log('🎭 AuthModal state changed to:', authModalOpen)
  }, [authModalOpen])
  
  // Debug: Track auth state changes (only when status changes)
  useEffect(() => {
    console.log('🔒 Auth state changed:', { session: !!session, status, user: session?.user?.email })
  }, [session, status])
  
  // Fetch categories
  const { data: categoriesResponse } = useSWR<CategoriesResponse>('/api/categories', fetcher)
  const categories = categoriesResponse?.data || []

  // Build API URL with query parameters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (region && region !== 'Any region') params.set('region', region)
    if (language && language !== 'Any language') params.set('language', language)
    if (selectedCategory) params.set('category_id', selectedCategory)
    const queryString = params.toString()
    return `/api/templates${queryString ? `?${queryString}` : ''}`
  }, [q, region, language, selectedCategory])

  // Fetch data using SWR
  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse>(apiUrl, fetcher)

  const products = useMemo(() => {
    if (!apiResponse?.data) return []
    return apiResponse.data.map(transformApiTemplate)
  }, [apiResponse])

  const pageSize = 9
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pagedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return products.slice(start, start + pageSize)
  }, [products, safePage])

  useEffect(() => {
    setPage(initialPage)
  }, [initialPage])

  // Sync selectedCategory with URL parameter
  useEffect(() => {
    setSelectedCategory(category)
  }, [category])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [q, region, language, selectedCategory])

  // Check for template to auto-open from landing page
  useEffect(() => {
    const openTemplateId = sessionStorage.getItem('openTemplateId')
    if (openTemplateId && products.length > 0) {
      // Find the template in the current products
      const template = products.find(p => p.id === openTemplateId)
      if (template) {
        setPreviewProduct(template)
        setPreviewOpen(true)
        // Clear the stored ID
        sessionStorage.removeItem('openTemplateId')
      }
    }
  }, [products])

  const goToPage = (next: number) => {
    const target = Math.min(Math.max(1, next), totalPages)
    setPage(target)
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    params.set('page', String(target))
    router.push(`/templates?${params.toString()}`)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openEditor = async (product: TemplateCard) => {
    console.log('🚀 Opening editor for:', product.name)
    
    try {
      // Convert external image to blob URL for Pintura compatibility
      const blobImageUrl = await convertImageToBlob(product.imageSrc)
      
      // Create a new product object with the blob URL
      const productWithBlobImage = {
        ...product,
        imageSrc: blobImageUrl
      }
      
      setEditorProduct(productWithBlobImage)
      setPreviewOpen(false)
      setEditorOpen(true)
    } catch (error) {
      console.error('❌ Failed to open editor:', error)
      alert('Failed to load image for editing. Please try again.')
    }
  }

  // Convert external image URL to blob URL for Pintura
  const convertImageToBlob = async (imageUrl: string): Promise<string> => {
    try {
      console.log('🔄 Converting image to blob URL for Pintura compatibility:', imageUrl)
      
      // Check if it's already a blob URL
      if (imageUrl.startsWith('blob:')) {
        console.log('✅ Image is already a blob URL, returning as-is:', imageUrl)
        return imageUrl
      }
      
      // For demonstration: treat local images as "server" images that need blob conversion
      // In real app, you'd only do this for external URLs
      console.log('🌐 Fetching image as if from server...')
      
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }
      
      console.log('📦 Converting response to blob...')
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      console.log('✅ Successfully created blob URL:', blobUrl)
      console.log('📊 Blob details:', {
        size: blob.size,
        type: blob.type,
        blobUrl: blobUrl
      })
      
      return blobUrl
    } catch (error) {
      console.error('❌ Failed to convert image to blob:', error)
      console.log('🔄 Falling back to original URL:', imageUrl)
      // Fallback to original URL
      return imageUrl
    }
  }

  // Demo: Create multi-page template images for testing
  const getTemplateImages = (product: TemplateCard) => {
    // For demo purposes, we'll create a 2-page template
    // In a real app, this would come from the template data
    const images = [
      product.imageSrc, // Front page
      product.imageSrc  // Back page (using same image for demo)
    ]
    
    return images
  }

  const productHref = '/product/template'

  return (
    <main className="pb-24">
      <div className="px-4 pt-6 sm:px-6 lg:px-8" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* sticky show-on-scroll-up search */}
          <FloatingSearch initialQuery={q} categories={categories} selectedCategory={selectedCategory} />
          
          <section>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-3">
                {Array(9).fill(0).map((_, i) => (
                  <TemplateCardSkeleton key={`skeleton-${i}`} />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center text-red-600">
                Failed to load templates. Please try again later.
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-lg border border-gray-200 p-12 text-center text-gray-600">No templates found.</div>
            ) : (
              <>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-3">
                {pagedProducts.map((p, index) => {
                  const href = productHref
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        console.log('📋 Template card clicked for:', p.name)
                        alert(`Clicked on ${p.name}`)
                        setPreviewProduct(p)
                        setPreviewOpen(true)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setPreviewProduct(p)
                          setPreviewOpen(true)
                        }
                      }}
                      className="group cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
                    >
                      <div className="relative overflow-hidden rounded-t-2xl">
                        <a
                          href={href}
                          className="block overflow-hidden"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setPreviewProduct(p)
                            setPreviewOpen(true)
                          }}
                        >
                          <Image
                            alt={p.imageAlt}
                            src={p.imageSrc}
                            width={640}
                            height={989}
                            className="aspect-[640/989] w-full bg-gray-100 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </a>
                        <div className="absolute right-3 top-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="inline-flex items-center gap-1 rounded-lg bg-black/80 px-2.5 py-1.5 text-white shadow-sm hover:bg-black" 
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('❤️ Like button clicked. Auth state:', { session: !!session, status })
                              if (!session || status !== 'authenticated') {
                                console.log('🚫 User not authenticated, showing auth modal')
                                setAuthModalOpen(true)
                                return
                              }
                              console.log('✅ User authenticated, liking template:', p.name)
                            }}
                          >
                            <HeartIcon className="h-4 w-4 text-white drop-shadow" />
                            <span className="text-xs">{p.likes.toLocaleString()}</span>
                          </button>
                          <Menu as="div" className="relative inline-block text-left">
                            <MenuButton className="inline-flex items-center justify-center rounded-lg bg-black/80 p-1.5 text-white shadow-sm hover:bg-black" onClick={(e) => e.stopPropagation()}>
                              <EllipsisHorizontalIcon className="h-4 w-4" />
                            </MenuButton>
                            <MenuItems
                              anchor={{
                                to: (index + 1) % 2 === 0 ? "bottom start" : "bottom end",
                                gap: 8
                              }}
                              className="z-50 w-72 origin-top-right rounded-xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/5 transition data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                            >
                              <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold leading-snug">
                                {p.name}
                              </div>
                              <div className="py-1">
                                <MenuItem>
                                  <button
                                    onClick={() => {
                                      setPreviewProduct(p)
                                      setPreviewOpen(true)
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                                  >
                                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-500" />
                                    Preview template
                                  </button>
                                </MenuItem>
                                <MenuItem>
                                  <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50">
                                    <FlagIcon className="h-4 w-4 text-gray-500" />
                                    Report
                                  </button>
                                </MenuItem>
                              </div>
                            </MenuItems>
                          </Menu>
                        </div>

                      </div>
                      <div className="px-4 pt-3 pb-5 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-1 text-[16px] font-semibold leading-6 text-gray-900">
                            <a
                              href={href}
                              className="relative inline-block"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setPreviewProduct(p)
                                setPreviewOpen(true)
                              }}
                            >
                              {p.name}
                            </a>
                          </h3>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${p.price === '$0' ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-900 ring-gray-200'}`}>
                            {p.price === '$0' ? 'Free' : p.price}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[13px] text-gray-600">
                          by <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">{p.publisher.name}</a>
                        </div>
                        {/* bottom row removed: likes are shown on the image; price is overlaid */}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-10 flex justify-center" aria-label="Pagination">
                  <div className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-1 shadow-sm ring-1 ring-gray-300">
                    <button
                      onClick={() => goToPage(safePage - 1)}
                      disabled={safePage === 1}
                      title="Previous"
                      className="flex size-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`flex size-9 items-center justify-center rounded-full text-sm ring-1 ring-transparent ${p === safePage ? 'bg-indigo-600 text-white ring-indigo-600' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => goToPage(safePage + 1)}
                      disabled={safePage === totalPages}
                      title="Next"
                      className="flex size-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </nav>
              )}
              </>
            )}
          </section>

          {/* My cards moved to /my-cards */}
      </div>
      {previewProduct && (
        <TemplatePreviewModal 
          open={previewOpen} 
          onClose={setPreviewOpen} 
          product={previewProduct}
          onCustomize={openEditor}
          authModalOpen={authModalOpen}
          setAuthModalOpen={setAuthModalOpen}
        />
      )}
      {editorProduct && (
        <GiftCardEditorSimple
          open={editorOpen}
          onClose={(open: boolean) => {
            console.log('Editor close called with:', open)
            setEditorOpen(open)
            if (!open) {
              setEditorProduct(null)
            }
          }}
          templateName={editorProduct.name}
          templateImages={(() => {
            const images = getTemplateImages(editorProduct)
            console.log('🎬 Passing template images to GiftCardEditorSimple:', images)
            return images
          })()}
        />
      )}
      
      {/* Auth Modal - shared for both main page and preview modal */}
      <AuthModal 
        open={authModalOpen} 
        onClose={() => {
          setAuthModalOpen(false)
        }} 
      />
      
      {/* DEBUG: Show current state */}
      <div className="fixed bottom-4 right-4 bg-red-500 text-white p-2 rounded z-[10000]">
        AuthModal: {authModalOpen ? 'OPEN' : 'CLOSED'}
      </div>
    </main>
  )
}

function TemplatePreviewModal({ open, onClose, product, onCustomize, authModalOpen, setAuthModalOpen }: { 
  open: boolean; 
  onClose: (v: boolean) => void; 
  product: TemplateCard | null;
  onCustomize: (product: TemplateCard) => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}) {
  const { data: session, status } = useSession()
  const [currentPage, setCurrentPage] = useState(0)
  
  // Debug: Check if props are being passed correctly
  useEffect(() => {
    console.log('🎭 Preview Modal mounted/updated - props:', { 
      authModalOpen, 
      setAuthModalOpen: typeof setAuthModalOpen,
      open 
    })
  }, [authModalOpen, setAuthModalOpen, open])
  const flipBookRef = useRef<any>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  if (!product) return null
  
  const templatePages = product.pages || [product.imageSrc]
  const totalPages = templatePages.length
  
  const handleNextPage = () => {
    // Check if we're on desktop (flipbook is visible)
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage < totalPages - 1) {
        flipBookRef.current.pageFlip().flipNext()
      }
    } else {
      // Tablet/Mobile: use scroll navigation
      if (currentPage < totalPages - 1) {
        scrollToPage(currentPage + 1)
      }
    }
  }
  
  const handlePrevPage = () => {
    // Check if we're on desktop (flipbook is visible)
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage > 0) {
        flipBookRef.current.pageFlip().flipPrev()
      }
    } else {
      // Tablet/Mobile: use scroll navigation
      if (currentPage > 0) {
        scrollToPage(currentPage - 1)
      }
    }
  }
  
  const handlePageFlip = (e: { data: number }) => {
    setCurrentPage(e.data)
  }
  
  // Handle scroll to update current page indicator
  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const scrollLeft = container.scrollLeft
    const containerWidth = container.clientWidth
    const newPage = Math.round(scrollLeft / containerWidth)
    
    if (newPage !== currentPage && newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage)
    }
  }
  
  // Scroll to specific page
  const scrollToPage = (pageIndex: number) => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const containerWidth = container.clientWidth
    const scrollLeft = pageIndex * containerWidth
    
    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    })
    setCurrentPage(pageIndex)
  }
  
  // Reset to first page when modal opens
  useEffect(() => {
    if (open) {
      setCurrentPage(0)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ left: 0 })
      }
    }
  }, [open])
  
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 sm:grid-cols-[2fr_1fr]">
          <DialogPanel className="col-span-1 rounded-2xl bg-transparent">
            <div className="relative overflow-hidden rounded-xl bg-white shadow-2xl">
              {/* Desktop: Flipbook View */}
              <div className="hidden lg:flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
                {/* Previous Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevPage()
                  }}
                  disabled={currentPage === 0}
                  className="absolute left-8 top-1/2 z-20 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                
                {/* Flipbook Container */}
                <div className="flipbook-container-desktop">
                  <HTMLFlipBook
                    ref={flipBookRef}
                    width={400}
                    height={550}
                    size="fixed"
                    startPage={0}
                    minWidth={200}
                    maxWidth={1000}
                    minHeight={200}
                    maxHeight={1000}
                    style={{}}
                    maxShadowOpacity={0.8}
                    showCover={true}
                    mobileScrollSupport={false}
                    onFlip={handlePageFlip}
                    className="flipbook-shadow"
                    flippingTime={800}
                    usePortrait={false}
                    startZIndex={10}
                    autoSize={false}
                    clickEventForward={true}
                    useMouseEvents={true}
                    swipeDistance={30}
                    showPageCorners={true}
                    disableFlipByClick={false}
                    drawShadow={true}
                  >
                    {templatePages.map((page, index) => (
                      <div key={index} className="page-hard">
                        <div className="page-content w-full h-full relative">
                          <Image
                            src={page}
                            alt={`${product.imageAlt} - Page ${index + 1}`}
                            width={400}
                            height={550}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      </div>
                    ))}
                  </HTMLFlipBook>
                </div>
                
                {/* Next Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNextPage()
                  }}
                  disabled={currentPage === totalPages - 1}
                  className="absolute right-8 top-1/2 z-20 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
                
                {/* Page indicator */}
                <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                  {currentPage + 1} / {totalPages}
                </div>
              </div>

              {/* Tablet & Mobile: Scrollable Pages View */}
              <div className="lg:hidden relative" onClick={(e) => e.stopPropagation()}>
                {/* Previous Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevPage()
                  }}
                  disabled={currentPage === 0}
                  className="absolute left-4 top-1/2 z-20 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                
                <div 
                  ref={scrollContainerRef}
                  className="overflow-x-auto scrollbar-hide"
                  onScroll={handleScroll}
                >
                  <div className="flex snap-x snap-mandatory">
                    {templatePages.map((page, index) => (
                      <div key={index} className="flex-none w-full snap-center">
                        <Image 
                          src={page} 
                          alt={`${product.imageAlt} - Page ${index + 1}`} 
                          width={600} 
                          height={800} 
                          className="w-full" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Next Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNextPage()
                  }}
                  disabled={currentPage === totalPages - 1}
                  className="absolute right-4 top-1/2 z-20 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
                
                {/* Page indicator dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {templatePages.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation()
                        scrollToPage(index)
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentPage ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
                
                {/* Page counter */}
                <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded-full text-xs backdrop-blur-sm">
                  {currentPage + 1}/{totalPages}
                </div>
              </div>
            </div>
          </DialogPanel>
          
          {/* Desktop Sidebar */}
          <div className="relative rounded-xl bg-white p-6 text-gray-900 shadow-2xl ring-1 ring-gray-100">
            <button onClick={() => onClose(false)} className="absolute right-3 top-3 rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold leading-snug">{product.name}</h2>
            <div className="mt-2 text-sm text-gray-600">By {product.publisher.name}</div>
            <div className="mt-1 text-xs text-gray-500">Document (A4 Portrait) • 21 × 29.7 cm • {totalPages} pages</div>
            
            {/* Temporary test button to force auth modal */}
            <button 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('🧪 Force auth modal button clicked - THIS SHOULD SHOW IN CONSOLE')
                console.log('🧪 Current authModalOpen state before:', authModalOpen)
                console.log('🧪 setAuthModalOpen function:', typeof setAuthModalOpen)
                alert('Test button clicked! Check console for details')
                setAuthModalOpen(true)
                console.log('🧪 Called setAuthModalOpen(true)')
              }}
              className="mt-2 mb-2 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              TEST: Force Auth Modal
            </button>
            
            <button 
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('🎯 Customize button clicked. Auth state:', { session: !!session, status, authModalOpen })
                console.log('🔍 Session details:', session)
                console.log('🔍 Status exact value:', status)
                
                // Force show auth modal for testing - check authentication properly
                if (status === 'loading') {
                  console.log('🕐 Auth status still loading, please wait')
                  return
                }
                
                if (!session || status !== 'authenticated') {
                  console.log('🚫 User not authenticated, showing auth modal. Setting authModalOpen to true...')
                  alert('User not authenticated! About to show auth modal')
                  setAuthModalOpen(true)
                  console.log('🚫 AuthModal state immediately after setState:', authModalOpen)
                  return
                }
                console.log('✅ User authenticated, opening editor for template:', product.name)
                await onCustomize(product)
              }}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Customize this template
            </button>
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <button 
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 hover:bg-gray-200"
                onClick={() => {
                  console.log('❤️ Preview like button clicked. Auth state:', { session: !!session, status })
                  if (!session || status !== 'authenticated') {
                    console.log('🚫 User not authenticated, showing auth modal')
                    setAuthModalOpen(true)
                    return
                  }
                  console.log('✅ User authenticated, liking template:', product.name)
                }}
              >
                <HeartIcon className="h-4 w-4 text-rose-500" />
                {product.likes.toLocaleString()}
              </button>
            </div>
            <div className="mt-4 text-xs text-gray-500">This template may contain paid elements</div>
          </div>
        </div>
      </div>
      
    </Dialog>
  )
}

function FloatingSearch({ initialQuery, categories, selectedCategory }: { initialQuery: string; categories?: Category[]; selectedCategory?: string }) {
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

// Add global styles for flipbook
const FlipbookStyles = () => (
  <style jsx global>{`
    .flipbook-shadow {
      filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
    }
    
    .flipbook-container-desktop {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0;
    }
    
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    
    .page-hard {
      width: 100%;
      height: 100%;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transform: translateZ(0);
    }
    
    .page-content {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transform: translateZ(0);
    }
  `}</style>
)

export default function TemplatesPage() {
  return (
    <>
      <FlipbookStyles />
      <Suspense fallback={<div>Loading...</div>}>
        <TemplatesPageContent />
      </Suspense>
    </>
  )
}
