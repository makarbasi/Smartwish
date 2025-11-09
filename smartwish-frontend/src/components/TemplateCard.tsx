"use client"

import Image from 'next/image'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { HeartIcon, EllipsisHorizontalIcon, MagnifyingGlassIcon, FlagIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'

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
  isLiked?: boolean
}

interface TemplateCardProps {
  template: TemplateCard
  index: number
  onPreview: (template: TemplateCard) => void
  onAuthRequired: () => void
  onLikeUpdate?: (templateId: string, isLiked: boolean, newLikesCount: number) => void
}

export default function TemplateCard({ template, index, onPreview, onAuthRequired, onLikeUpdate }: TemplateCardProps) {
  const { data: session, status } = useSession()
  const [isLiked, setIsLiked] = useState(template.isLiked || false)
  const [likesCount, setLikesCount] = useState(template.likes)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isUpdating) return

    try {
      setIsUpdating(true)

      // Optimistic UI update for immediate gratification
      const optimistic = likesCount + 1
      setLikesCount(optimistic)
      setIsLiked(true)
      onLikeUpdate?.(template.id, true, optimistic)

      // Fire-and-forget background update to the backend
      const res = await fetch(`/api/templates/${template.id}/increment-popularity`, {
        method: 'PATCH',
      })

      // If backend returns a value, sync to it; otherwise keep optimistic
      if (res.ok) {
        const data = await res.json()
        if (typeof data?.popularity === 'number') {
          setLikesCount(data.popularity)
          onLikeUpdate?.(template.id, true, data.popularity)
        }
      } else {
        const text = await res.text()
        console.error('Failed to increment popularity (keeping optimistic):', res.status, text)
      }
    } catch (err) {
      console.error('Error incrementing popularity (keeping optimistic):', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('📋 Template card clicked for:', template.name)
    onPreview(template)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview(template)
        }
      }}
      className="group cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
    >
      <div className="relative overflow-hidden rounded-t-2xl">
        <div
          className="block overflow-hidden cursor-pointer"
        >
          <Image
            alt={template.imageAlt}
            src={template.imageSrc}
            width={640}
            height={989}
            className="aspect-[640/989] w-full bg-gray-100 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        <div className="absolute right-3 top-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button 
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 shadow-sm transition-all ${
              isLiked 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-black/80 hover:bg-black'
            } text-white ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleLike}
            disabled={isUpdating}
          >
            {isLiked ? (
              <HeartIconSolid className="h-4 w-4 text-white drop-shadow" />
            ) : (
              <HeartIcon className="h-4 w-4 text-white drop-shadow" />
            )}
            <span className="text-xs">{likesCount.toLocaleString()}</span>
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
                {template.name}
              </div>
              <div className="py-1">
                <MenuItem>
                  <button
                    onClick={() => {
                      onPreview(template)
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
            <span
              className="relative inline-block cursor-pointer"
            >
              {template.name}
            </span>
          </h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${template.price === '$0' ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-900 ring-gray-200'}`}>
            {template.price === '$0' ? 'Free' : template.price}
          </span>
        </div>
        <div className="mt-1.5 text-[13px] text-gray-600">
          by <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">{template.publisher.name}</a>
        </div>
      </div>
    </div>
  )
}