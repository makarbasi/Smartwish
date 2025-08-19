'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import Link from 'next/link'
import Image from 'next/image'
import HTMLFlipBook from "react-pageflip"
import PinturaEditorModal from '@/components/PinturaEditorModal'
import useSWR from 'swr'
import { saveTemplateWithImages } from '@/utils/templateUtils'

type Template = {
  id: string
  title: string
  image_1: string
  image_2: string
  image_3: string
  image_4: string
  created_at: string
}

type ApiResponse = {
  success: boolean
  data: Template[]
  count: number
}

type CardData = {
  id: string
  name: string
  createdAt: string
  pages: string[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Transform template to card data
const transformTemplateToCard = (template: Template): CardData => {
  const pages = [
    template.image_1,
    template.image_2 || template.image_1, // Fallback to image_1 if image_2 doesn't exist
    template.image_3 || template.image_1, // Fallback to image_1 if image_3 doesn't exist  
    template.image_4 || template.image_1  // Fallback to image_1 if image_4 doesn't exist
  ].filter(Boolean) // Remove any null/undefined values

  return {
    id: template.id,
    name: template.title,
    createdAt: template.created_at,
    pages
  }
}

export default function CustomizeCardPage() {
  const params = useParams()
  const cardId = params?.id as string
  const [currentPage, setCurrentPage] = useState(0)
  const flipBookRef = useRef<any>(null)
  
  // Pintura Editor state
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null)
  const [pageImages, setPageImages] = useState<string[]>([])
  
  // Save functionality state
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  
  // Swipe functionality state
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Fetch all templates and find the specific one
  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse>('/api/templates', fetcher)
  
  const cardData = useMemo(() => {
    if (!apiResponse?.data || !cardId) return null
    const template = apiResponse.data.find(t => t.id === cardId)
    return template ? transformTemplateToCard(template) : null
  }, [apiResponse, cardId])

  // Initialize page images when card data is available
  useEffect(() => {
    if (cardData) {
      setPageImages([...cardData.pages])
    }
  }, [cardData])

  // Listen for page navigation events from Sidebar
  useEffect(() => {
    const handlePageNavigation = (event: any) => {
      const { action, page } = event.detail
      
      switch (action) {
        case 'prev':
          handleFlipPrev()
          break
        case 'next':
          handleFlipNext()
          break
        case 'goto':
          goToPage(page)
          break
      }
    }

    window.addEventListener('pageNavigation', handlePageNavigation)
    return () => window.removeEventListener('pageNavigation', handlePageNavigation)
  }, [currentPage])

  // Notify Sidebar about current page changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: { currentPage } }))
  }, [currentPage])

  // Swipe handling functions
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe && currentPage < 3) {
      handleFlipNext()
    }
    if (isRightSwipe && currentPage > 0) {
      handleFlipPrev()
    }
  }

  // Save functions
  const handleSave = async () => {
    if (!cardData) {
      alert('No card data available')
      return
    }

    setIsSaving(true)
    setSaveMessage('')

    try {
      console.log('💾 Saving card:', cardData.name)
      console.log('📸 Current page images:', pageImages)

      // Use a dummy userId for now - in a real app, this would come from auth context
      const userId = 'user_123' // TODO: Replace with actual user ID from auth

      const result = await saveTemplateWithImages(cardData.id, pageImages, {
        action: 'update',
        title: cardData.name,
        userId,
        designId: `updated_${cardData.id}_${Date.now()}`
      })

      console.log('✅ Save result:', result)
      setSaveMessage('Card saved successfully! Images uploaded to cloud.')
      
      // Log the cloud URLs for verification
      if (result.uploadResult?.cloudUrls) {
        console.log('🌐 Uploaded cloud URLs:', result.uploadResult.cloudUrls)
      }
      
      // Show success message for a few seconds
      setTimeout(() => setSaveMessage(''), 3000)

    } catch (error) {
      console.error('❌ Save failed:', error)
      setSaveMessage('Failed to save card. Please try again.')
      
      // Show error message for a few seconds
      setTimeout(() => setSaveMessage(''), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNewCopy = async () => {
    if (!cardData) {
      alert('No card data available')
      return
    }

    setIsSaving(true)
    setSaveMessage('')

    try {
      console.log('📄 Saving new copy of card:', cardData.name)
      console.log('📸 Current page images:', pageImages)

      // Use a dummy userId for now - in a real app, this would come from auth context
      const userId = 'user_123' // TODO: Replace with actual user ID from auth

      const result = await saveTemplateWithImages(cardData.id, pageImages, {
        action: 'duplicate',
        title: `Copy of ${cardData.name}`,
        userId,
        designId: `copy_${cardData.id}_${Date.now()}`
      })

      console.log('✅ Duplicate result:', result)
      setSaveMessage('New copy saved successfully! Images uploaded to cloud.')
      
      // Log the cloud URLs for verification
      if (result.uploadResult?.cloudUrls) {
        console.log('🌐 Uploaded cloud URLs:', result.uploadResult.cloudUrls)
      }
      
      // Show success message for a few seconds
      setTimeout(() => setSaveMessage(''), 3000)

    } catch (error) {
      console.error('❌ Duplicate failed:', error)
      setSaveMessage('Failed to save new copy. Please try again.')
      
      // Show error message for a few seconds
      setTimeout(() => setSaveMessage(''), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading card...</p>
        </div>
      </div>
    )
  }

  if (error || !cardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Card Not Found</h1>
          <p className="text-gray-600 mb-6">The card you&apos;re looking for doesn&apos;t exist.</p>
          <Link 
            href="/my-cards"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>
    )
  }

  const handleFlipNext = () => {
    // Check if we're on mobile/tablet (flipbook is hidden)
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      // Mobile/Tablet: directly update currentPage state
      if (currentPage < 3) {
        setCurrentPage(currentPage + 1)
      }
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage < 3) {
        flipBookRef.current.pageFlip().flipNext()
      }
    }
  }

  const handleFlipPrev = () => {
    // Check if we're on mobile/tablet (flipbook is hidden)
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      // Mobile/Tablet: directly update currentPage state
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1)
      }
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage > 0) {
        flipBookRef.current.pageFlip().flipPrev()
      }
    }
  }

  const handlePageFlip = (e: { data: number }) => {
    setCurrentPage(e.data)
  }

  const goToPage = (pageIndex: number) => {
    // Check if we're on mobile/tablet (flipbook is hidden)
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      // Mobile/Tablet: directly update currentPage state
      setCurrentPage(pageIndex)
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current) {
        flipBookRef.current.pageFlip().flip(pageIndex)
      }
    }
  }

  // Function to handle editing a specific page
  const handleEditPage = async (pageIndex: number) => {
    console.log('🎨 Opening Pintura editor for page:', pageIndex)
    
    if (!cardData || pageIndex >= cardData.pages.length) {
      console.error('❌ Invalid page index or no card data')
      return
    }

    try {
      // Convert image to blob URL for Pintura compatibility if needed
      const imageUrl = pageImages[pageIndex] || cardData.pages[pageIndex]
      const blobImageUrl = await convertImageToBlob(imageUrl)
      
      // Update the page images with blob URL if needed
      if (imageUrl !== blobImageUrl) {
        const updatedImages = [...pageImages]
        updatedImages[pageIndex] = blobImageUrl
        setPageImages(updatedImages)
      }
      
      setEditingPageIndex(pageIndex)
      setEditorVisible(true)
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
      
      console.log('🌐 Fetching image...')
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }
      
      console.log('📦 Converting response to blob...')
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      console.log('✅ Successfully created blob URL:', blobUrl)
      return blobUrl
    } catch (error) {
      console.error('❌ Failed to convert image to blob:', error)
      console.log('🔄 Falling back to original URL:', imageUrl)
      return imageUrl
    }
  }

  // Handle editor process result
  const handleEditorProcess = ({ dest }: { dest: File }) => {
    console.log('✅ Editor process complete:', dest)
    
    if (editingPageIndex !== null && dest) {
      // Create blob URL from the edited image
      const blobUrl = URL.createObjectURL(dest)
      
      // Update the page images
      const updatedImages = [...pageImages]
      updatedImages[editingPageIndex] = blobUrl
      setPageImages(updatedImages)
      
      console.log('📸 Updated page image at index:', editingPageIndex, 'with:', blobUrl)
    }
  }

  // Handle editor close
  const handleEditorClose = () => {
    console.log('🚪 Closing editor')
    setEditorVisible(false)
    setEditingPageIndex(null)
  }

  // Chat / Style Assistant removed

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
  <div className="bg-white border-b border-gray-200 pt-4 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 md:h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/my-cards"
                className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                Back
              </Link>
              <div className="h-6 w-px bg-white/30" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{cardData.name}</h1>
                <p className="text-sm text-gray-500">Created on {new Date(cardData.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
                {/* Save Status Message */}
                {saveMessage && (
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    saveMessage.includes('Failed') 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {saveMessage}
                  </div>
                )}

                {/* Save Menu */}
                <Menu as="div" className="relative inline-block text-left">
                  <MenuButton 
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                    <span className="hidden lg:inline">
                      {isSaving ? 'Saving...' : 'Options'}
                    </span>
                  </MenuButton>
                  <MenuItems
                    anchor="bottom end"
                    className="z-50 w-48 rounded-xl bg-white p-2 text-sm shadow-2xl ring-1 ring-black/5 origin-top-right data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
                  >
                    <MenuItem>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        💾 {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={handleSaveNewCopy}
                        disabled={isSaving}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        📄 {isSaving ? 'Creating copy...' : 'Save a new copy'}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        
        {/* Center - Card Editor */}
  <div className={`flex-1 flex items-center justify-center min-h-[calc(100vh-200px)] py-4 lg:py-8 transition-all duration-300 px-4`}>
          
          {/* Previous Page Button */}
          <button
            onClick={handleFlipPrev}
            disabled={currentPage === 0}
            className="hidden xl:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mr-4 xl:mr-8 text-gray-700"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>

          {/* Desktop Flipbook Container */}
          <div className="hidden xl:block relative">
            <HTMLFlipBook
              ref={flipBookRef}
              width={500}
              height={700}
              size="fixed"
              startPage={0}
              minWidth={200}
              maxWidth={1000}
              minHeight={200}
              maxHeight={1000}
              style={{}}
              maxShadowOpacity={0.8}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={handlePageFlip}
              className="flipbook-shadow"
              flippingTime={800}
              usePortrait={false}
              startZIndex={10}
              autoSize={false}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={false}
              disableFlipByClick={true}
              drawShadow={true}
            >
              {/* Front Cover - Page 1 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[0] || cardData.pages[0]}
                    alt="Gift Card Cover"
                    width={500}
                    height={700}
                    className="w-full h-full object-cover rounded-lg"
                    priority
                  />
                  {/* Edit icon blocking zone */}
                  <div 
                    className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleEditPage(0)
                      }}
                      className="p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inner Left Page - Page 2 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[1] || cardData.pages[1]}
                    alt="Gift Card Page 2"
                    width={500}
                    height={700}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon blocking zone */}
                  <div 
                    className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleEditPage(1)
                      }}
                      className="p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inner Right Page - Page 3 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[2] || cardData.pages[2]}
                    alt="Gift Card Page 3"
                    width={500}
                    height={700}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon */}
                  <button 
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleEditPage(2)
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200 z-20"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Back Cover - Page 4 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[3] || cardData.pages[3]}
                    alt="Gift Card Page 4"
                    width={500}
                    height={700}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon */}
                  <button 
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleEditPage(3)
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200 z-20"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
            </HTMLFlipBook>
          </div>
          
          {/* Desktop Page Indicator */}
          <div className="hidden xl:block absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg">
              Page {currentPage + 1} of 4
            </div>
          </div>
          
          {/* Mobile/Tablet Single Page View */}
          <div className="xl:hidden relative">
            <div 
              className="w-80 h-96 mx-auto bg-white rounded-xl shadow-2xl overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-full h-full relative">
                <Image
                  src={pageImages[currentPage] || cardData.pages[currentPage]}
                  alt={`Card Page ${currentPage + 1}`}
                  width={320}
                  height={384}
                  className="w-full h-full object-cover"
                />
                {/* Edit icon blocking zone */}
                <div 
                  className="absolute top-0 right-0 w-16 h-16 z-30 flex items-start justify-end pt-3 pr-3"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  style={{ pointerEvents: 'auto' }}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleEditPage(currentPage)
                    }}
                    className="p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                
                {/* Mobile Page Indicator */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm shadow-lg">
                    Page {currentPage + 1} of 4
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Next Page Button */}
          <button
            onClick={handleFlipNext}
            disabled={currentPage >= 3}
            className="hidden xl:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ml-4 xl:ml-8 text-gray-700"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>

  {/* Right Sidebar removed */}
      </div>


      {/* Mobile Overlay */}
  {/* Mobile Overlay placeholder (no assistant) */}

      {/* Pintura Editor Modal */}
      {editingPageIndex !== null && (
        <PinturaEditorModal
          imageSrc={pageImages[editingPageIndex] || cardData.pages[editingPageIndex]}
          isVisible={editorVisible}
          onHide={handleEditorClose}
          onProcess={handleEditorProcess}
        />
      )}

      <style jsx>{`
        .flipbook-shadow {
          filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
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
    </div>
  )
}
