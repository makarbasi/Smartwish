"use client"

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { HeartIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import HTMLFlipBook from "react-pageflip"

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

interface TemplatePreviewModalProps {
  open: boolean
  onClose: () => void
  product: TemplateCard | null
  onCustomize: (product: TemplateCard) => Promise<void>
}

export default function TemplatePreviewModal({ 
  open, 
  onClose, 
  product, 
  onCustomize
}: TemplatePreviewModalProps) {
  const [currentPage, setCurrentPage] = useState(0)
  
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Reset to first page when modal opens
  useEffect(() => {
    if (open) {
      setCurrentPage(0)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ left: 0 })
      }
    }
  }, [open])
  
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
  
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop 
        className="fixed inset-0 bg-black/40" 
        onClick={onClose}
      />
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
            <button onClick={() => onClose()} className="absolute right-3 top-3 rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold leading-snug">{product.name}</h2>
            <div className="mt-2 text-sm text-gray-600">By {product.publisher.name}</div>
            <div className="mt-1 text-xs text-gray-500">Document (A4 Portrait) • 21 × 29.7 cm • {totalPages} pages</div>
            
            
            <button 
              onClick={() => {
                console.log('🎯 Customize button clicked in TemplatePreviewModal')
                // Close modal and let parent handle authentication
                console.log('🚪 Closing preview modal...')
                onClose()
                console.log('🔄 Calling onCustomize...')
                onCustomize(product)
              }}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Customize this template
            </button>
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <button 
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 hover:bg-gray-200"
                onClick={() => {
                  // Handle like action - could implement later
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