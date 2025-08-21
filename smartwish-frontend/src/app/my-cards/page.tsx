"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import Link from "next/link";
import Image from "next/image";
import useSWR from 'swr';

type MyCard = {
  id: string;
  name: string;
  thumbnail: string;
  lastEdited: string;
  category?: string;
  status?: string;
};

type SavedDesign = {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
};

type SavedDesignsResponse = {
  success: boolean;
  data: SavedDesign[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Transform saved design to MyCard format
const transformSavedDesign = (design: SavedDesign): MyCard => {
  const daysAgo = Math.floor((Date.now() - new Date(design.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  return {
    id: design.id,
    name: design.title,
    thumbnail: design.thumbnail || '/placeholder-card.png',
    lastEdited: `Edited ${daysAgo > 0 ? `${daysAgo}d` : '1d'} ago`,
    category: design.category,
    status: design.status || 'draft',
  };
};

export default function MyCardsPage() {
  const searchParams = useSearchParams();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Fetch saved designs from API first
  const { 
    data: savedDesignsResponse, 
    error: savedDesignsError, 
    isLoading: savedDesignsLoading,
    mutate: mutateSavedDesigns 
  } = useSWR<SavedDesignsResponse>('/api/saved-designs', fetcher, {
    refreshInterval: 0, // Don't auto-refresh
    revalidateOnFocus: false, // Don't revalidate on focus
    revalidateOnReconnect: false, // Don't revalidate on reconnect
  });

  // Check for new design success message and force refresh
  useEffect(() => {
    const newDesignId = searchParams?.get('newDesign');
    const message = searchParams?.get('message');
    
    if (newDesignId && message) {
      setSuccessMessage(decodeURIComponent(message));
      
      // Force a refresh of the saved designs data
      mutateSavedDesigns();
      
      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        // Clean up URL parameters
        window.history.replaceState({}, '', '/my-cards');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, mutateSavedDesigns]);
  
  // Transform saved designs to cards format
  const savedCards: MyCard[] = savedDesignsResponse?.data ? savedDesignsResponse.data.map(transformSavedDesign) : [];
  
  // Debug logging
  console.log('My Cards - Saved designs response:', savedDesignsResponse);
  console.log('My Cards - Saved cards:', savedCards);
  console.log('My Cards - Loading state:', savedDesignsLoading);
  console.log('My Cards - Error state:', savedDesignsError);
  
  // For now, keep published cards empty since we don't have published designs yet
  const publishedCards: MyCard[] = [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">My Cards</h1>
        <p className="mt-2 text-lg text-gray-600">Manage your saved and published greeting cards</p>
      </div>
      
      {/* Saved Cards Section */}
      <div className="mb-16">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Saved Designs</h2>
          <p className="text-sm text-gray-600">Cards you've created but haven't published yet</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
          {savedDesignsLoading ? (
            // Skeleton loading for saved cards
            Array(6).fill(0).map((_, index) => (
              <div key={`saved-skeleton-${index}`} className="group rounded-2xl bg-white ring-1 ring-gray-200">
                <div className="relative overflow-hidden rounded-t-2xl">
                  <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
                  <div className="absolute right-3 top-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="px-4 pt-3 pb-4 text-left">
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            ))
          ) : savedDesignsError ? (
            <div className="col-span-full text-center text-red-600 py-8">
              Failed to load saved cards. <button onClick={() => mutateSavedDesigns()} className="text-indigo-600 hover:text-indigo-500 underline ml-1">Try again</button>
            </div>
          ) : savedCards.length === 0 ? (
            <div className="col-span-full">
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="mt-4 text-sm font-medium text-gray-900">No saved designs</h3>
                <p className="mt-2 text-sm text-gray-500">Get started by creating your first greeting card from our templates.</p>
                <div className="mt-6">
                  <Link href="/templates" className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    <svg className="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Browse Templates
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            savedCards.map((c, index) => (
              <div
                key={c.id}
                className="group rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
              >
                <div className="relative overflow-hidden rounded-t-2xl">
                  <Link
                    href={`/my-cards/${c.id}`}
                    className="block overflow-hidden"
                  >
                    <Image
                      alt={c.name}
                      src={c.thumbnail}
                      width={640}
                      height={989}
                      className="aspect-[640/989] w-full bg-gray-100 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </Link>
                  <div className="absolute right-3 top-3 flex gap-2">
                    <Menu as="div" className="relative inline-block text-left">
                      <MenuButton className="inline-flex items-center justify-center rounded-lg bg-black/80 p-1.5 text-white shadow-sm hover:bg-black">
                        <EllipsisHorizontalIcon className="h-4 w-4" />
                      </MenuButton>
                      <MenuItems
                        anchor={{
                          to: (index + 1) % 2 === 0 ? "bottom start" : "bottom end",
                          gap: 8,
                          padding: 16
                        }}
                        className="z-50 w-48 rounded-md bg-white p-1 text-sm shadow-2xl ring-1 ring-black/5 origin-top-right data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
                      >
                        <MenuItem>
                          <Link
                            href={`/my-cards/${c.id}`}
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            View Card
                          </Link>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </a>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Publish
                          </a>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Duplicate
                          </a>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </a>
                        </MenuItem>
                      </MenuItems>
                    </Menu>
                  </div>
                </div>
                <div className="px-4 pt-3 pb-4 text-left">
                  <h3 className="line-clamp-1 text-[15px] font-semibold leading-6">
                    <Link
                      href={`/my-cards/${c.id}`}
                      className="text-gray-900 hover:text-indigo-600 transition-colors duration-200"
                    >
                      {c.name}
                    </Link>
                  </h3>
                  <div className="mt-1.5 text-[12px] text-gray-600">
                    {c.lastEdited}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="relative mb-16">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-6 text-sm font-medium text-gray-500">Published Cards</span>
        </div>
      </div>

      {/* Published Cards Section */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Published Cards</h2>
          <p className="text-sm text-gray-600">Cards you've shared with the community</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              <svg className="mr-1 h-2 w-2 fill-current" viewBox="0 0 8 8">
                <circle cx={4} cy={4} r={3} />
              </svg>
              Live
            </div>
            <span className="text-xs text-gray-500">Visible to all users</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
          {false ? ( // Published cards loading - disabled for now
            // Skeleton loading for published cards
            Array(3).fill(0).map((_, index) => (
              <div key={`published-skeleton-${index}`} className="group rounded-2xl bg-white ring-1 ring-gray-200">
                <div className="relative overflow-hidden rounded-t-2xl">
                  <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
                  <div className="absolute right-3 top-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="px-4 pt-3 pb-4 text-left">
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            ))
          ) : false ? ( // Published cards error - disabled for now
            <div className="col-span-full text-center text-red-600 py-8">
              Failed to load published cards
            </div>
          ) : publishedCards.length === 0 ? (
            <div className="col-span-full">
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                <h3 className="mt-4 text-sm font-medium text-gray-900">No published cards</h3>
                <p className="mt-2 text-sm text-gray-500">Share your designs with the community by publishing them.</p>
                <div className="mt-6">
                  <button type="button" className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                    Browse Templates
                  </button>
                </div>
              </div>
            </div>
          ) : (
            publishedCards.map((c, index) => (
              <div
                key={c.id}
                className="group rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
              >
                <div className="relative overflow-hidden rounded-t-2xl">
                  <Link
                    href={`/my-cards/${c.id}`}
                    className="block overflow-hidden"
                  >
                    <Image
                      alt={c.name}
                      src={c.thumbnail}
                      width={640}
                      height={989}
                      className="aspect-[640/989] w-full bg-gray-100 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </Link>
                  <div className="absolute right-3 top-3 flex gap-2">
                    <Menu as="div" className="relative inline-block text-left">
                      <MenuButton className="inline-flex items-center justify-center rounded-lg bg-black/80 p-1.5 text-white shadow-sm hover:bg-black">
                        <EllipsisHorizontalIcon className="h-4 w-4" />
                      </MenuButton>
                      <MenuItems
                        anchor={{
                          to: (index + 1) % 2 === 0 ? "bottom start" : "bottom end",
                          gap: 8,
                          padding: 16
                        }}
                        className="z-50 w-48 rounded-md bg-white p-1 text-sm shadow-2xl ring-1 ring-black/5 origin-top-right data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
                      >
                        <MenuItem>
                          <Link
                            href={`/my-cards/${c.id}`}
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            View Card
                          </Link>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </a>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Unpublish
                          </a>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Duplicate
                          </a>
                        </MenuItem>
                        <MenuItem>
                          <a
                            href="#"
                            className="block rounded px-2 py-1.5 text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </a>
                        </MenuItem>
                      </MenuItems>
                    </Menu>
                  </div>
                </div>
                <div className="px-4 pt-3 pb-4 text-left">
                  <h3 className="line-clamp-1 text-[15px] font-semibold leading-6">
                    <Link
                      href={`/my-cards/${c.id}`}
                      className="text-gray-900 hover:text-indigo-600 transition-colors duration-200"
                    >
                      {c.name}
                    </Link>
                  </h3>
                  <div className="mt-1.5 text-[12px] text-gray-600">
                    {c.lastEdited}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
