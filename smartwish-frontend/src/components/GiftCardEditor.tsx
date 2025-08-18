'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'

// Import Pintura configuration
import { getEditorDefaults } from '@pqina/pintura'

// Dynamically import PinturaEditor with proper SSR handling
const DynamicPinturaEditor = dynamic(() => import('./DynamicPinturaEditor'), {
  ssr: false,
})

type GiftCardEditorProps = {
  open: boolean
  onClose: (open: boolean) => void
  templateName: string
  templateImages: string[]
}

export default function GiftCardEditor({ open, onClose, templateName, templateImages }: GiftCardEditorProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [editedImages, setEditedImages] = useState<string[]>([])

  console.log('GiftCardEditor rendered with:', { open, templateName, templateImages })

  // Initialize with template images when component opens
  useEffect(() => {
    if (open && templateImages.length > 0) {
      setEditedImages([...templateImages])
      setCurrentPage(0)
    }
  }, [open, templateImages])

  // Get Pintura editor configuration
  const editorConfig = {
    ...getEditorDefaults(),
    // Set aspect ratio for gift cards (standard greeting card ratio)
    imageCropAspectRatio: 1.4 // 7:5 ratio for greeting cards
  }

  const handleSave = (result: { dest: File | string }) => {
    // Update the current page with edited image
    const newEditedImages = [...editedImages]
    // Convert File to URL for display
    if (result.dest instanceof File) {
      const url = URL.createObjectURL(result.dest)
      newEditedImages[currentPage] = url
      setEditedImages(newEditedImages)
    } else if (typeof result.dest === 'string') {
      newEditedImages[currentPage] = result.dest
      setEditedImages(newEditedImages)
    }
  }

  const goToPage = (pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < templateImages.length) {
      setCurrentPage(pageIndex)
    }
  }

  const handleFinish = () => {
    // Here you would typically save the edited images or send them to a backend
    console.log('Finished editing gift card:', {
      templateName,
      editedImages
    })
    onClose(false)
  }

  if (!open) return null

  const currentImage = editedImages[currentPage] || templateImages[currentPage]
  const totalPages = templateImages.length

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <DialogBackdrop className="fixed inset-0 bg-black/80" />
      <div className="fixed inset-0 overflow-hidden">
        <DialogPanel className="flex h-full w-full flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-900">
                Edit {templateName}
              </h1>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 0}
                      className="flex items-center justify-center rounded-md p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages - 1}
                      className="flex items-center justify-center rounded-md p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleFinish}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Save & Finish
              </button>
              <button
                onClick={() => onClose(false)}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Page Navigation (if multiple pages) */}
          {totalPages > 1 && (
            <div className="border-b border-gray-200 px-6 py-3">
              <div className="flex gap-2">
                {templateImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToPage(index)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      index === currentPage
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Page {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 p-6">
            {currentImage && (
              <div className="h-full">
                <DynamicPinturaEditor
                  {...editorConfig}
                  src={currentImage}
                  onProcess={handleSave}
                />
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
