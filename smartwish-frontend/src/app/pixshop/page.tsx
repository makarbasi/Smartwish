'use client'

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useUserProfile } from '@/hooks/useUserProfile';
import PixshopStandalone from '@/components/pixshop/PixshopStandalone';
import { PlusIcon } from '@heroicons/react/20/solid';
import {
  CalendarDaysIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  MegaphoneIcon,
  ShoppingBagIcon,
  ArrowRightStartOnRectangleIcon,
  UserGroupIcon,
  PhotoIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Cloned sidebar items with Pixshop highlighted
const sidebarItems = [
  { href: '/event', label: 'Event', icon: CalendarDaysIcon },
  { href: '/marketplace', label: 'Market', icon: ShoppingBagIcon },
  { href: '/my-cards', label: 'My designs', icon: PencilSquareIcon },
  { href: '/pixshop', label: 'Pixshop AI', icon: PhotoIcon },
  { href: '/contacts', label: 'Contacts', icon: UserGroupIcon },
];

const mobileItems = [
  { href: '/event', label: 'Event', icon: CalendarDaysIcon },
  { href: '/marketplace', label: 'Market', icon: ShoppingBagIcon },
  { href: '/templates', label: 'Templates', icon: PencilSquareIcon },
  { href: '/my-cards', label: 'My designs', icon: PencilSquareIcon },
  { href: '/contacts', label: 'Contacts', icon: UserGroupIcon },
];

// Cloned Desktop Sidebar Component
function PixshopSidebar() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: session } = useSession();
  const { user } = useUserProfile();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);

  const profileImageUrl = user?.profileImage || (session?.user?.image as string) || null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-50 hidden w-14 flex-col items-center border-r border-gray-200 bg-white py-6 md:flex lg:w-16"
    >
      {/* Logo */}
      <div className="mb-4 flex items-center justify-center">
        <Link href="/" title="Home" className="inline-block">
          <Image
            src="/resources/logo/logo.png"
            alt="Smartwish"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
        </Link>
      </div>

      {/* Templates Button */}
      <Link
        href="/templates"
        title="Templates"
        className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-500"
      >
        <PlusIcon className="h-5 w-5" />
      </Link>

      {/* Navigation Items */}
      <ul className="flex w-full flex-1 flex-col items-stretch gap-3 px-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/pixshop'; // Always keep Pixshop active
          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                title={item.label}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-md ring-1 transition-colors ${
                  active
                    ? 'bg-gray-100 text-gray-900 ring-gray-200'
                    : 'text-gray-600 ring-transparent hover:bg-gray-50 hover:text-gray-900 hover:ring-gray-200'
                }`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Profile Section */}
      <div className="mt-auto w-full px-1 pb-1" ref={popoverRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5"
        >
          <span className="sr-only">Open profile</span>
          {profileImageUrl ? (
            <Image
              src={profileImageUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full ring-1 ring-gray-200"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-gray-500"
                aria-hidden="true"
              >
                <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
                <path d="M4 20c0-3.866 3.134-7 7-7s7 3.134 7 7H4z" />
              </svg>
            </div>
          )}
        </button>

        {profileOpen && (
          <div className="absolute bottom-12 left-12 z-60 w-72 rounded-xl border border-gray-200 bg-white text-sm shadow-xl">
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Accounts
              </div>
              <div className="mt-2 flex items-center rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                <div className="flex items-center gap-3">
                  {profileImageUrl ? (
                    <Image
                      src={profileImageUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full ring-1 ring-gray-200"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      >
                        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
                        <path d="M4 20c0-3.866 3.134-7 7-7s7 3.134 7 7H4z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {(user?.name || session?.user?.name) ?? 'Guest'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(user?.email || session?.user?.email) ?? 'Not signed in'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 p-1">
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Cog6ToothIcon className="h-5 w-5 text-gray-400" /> Settings
              </Link>
              <a
                href="#"
                className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
              >
                <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400" /> Help and resources
              </a>
              <a
                href="#"
                className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
              >
                <MegaphoneIcon className="h-5 w-5 text-gray-400" /> Whats new
              </a>
              <a
                href="#"
                className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
              >
                <ShoppingBagIcon className="h-5 w-5 text-gray-400" /> Purchase history
              </a>
            </div>
            <div className="border-t border-gray-200 p-2">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setProfileOpen(false);
                  if (session) {
                    signOut();
                  } else {
                    router.push('/sign-in?callbackUrl=/pixshop');
                  }
                }}
                className={
                  session
                    ? 'flex items-center gap-3 rounded-md bg-red-50 px-2 py-2 font-medium text-red-600 hover:bg-red-100'
                    : 'flex items-center gap-3 rounded-md bg-indigo-50 px-2 py-2 font-medium text-indigo-700 hover:bg-indigo-100'
                }
              >
                <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
                {session ? 'Log out' : 'Sign in'}
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Cloned Mobile Menu Component
function PixshopMobileMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user } = useUserProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profileImageUrl = user?.profileImage || (session?.user?.image as string) || 'https://i.pravatar.cc/80?img=12';

  const handleSignOut = async (e?: React.MouseEvent | React.TouchEvent) => {
    try {
      if (e) e.preventDefault();
      if (signingOut) return;

      setSigningOut(true);
      setMobileMenuOpen(false);
      await signOut({ redirect: false });
    } catch (err) {
      console.error('signOut error', err);
    } finally {
      router.push('/');
      setSigningOut(false);
    }
  };

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }

    if (typeof window !== 'undefined') {
      handleScroll();
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  if (status === 'loading') {
    return null;
  }

  return (
    <div className="md:hidden">
      <div className="h-16"></div>

      {/* Top bar on scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out ${
          isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className="h-16"></div>
      </div>

      {/* Hamburger Menu Button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-3 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'bg-black bg-opacity-30 pointer-events-auto' : 'bg-transparent pointer-events-none'
        }`}
      >
        <div
          className={`w-80 bg-white h-full shadow-xl transform transition-all duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Image
                  src="/resources/logo/logo-full.png"
                  alt="Smartwish"
                  width={140}
                  height={32}
                  className="h-32 w-auto object-contain"
                />
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Profile Section */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Image
                  src={profileImageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full ring-1 ring-gray-200"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {(user?.name || session?.user?.name) ?? 'Guest'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(user?.email || session?.user?.email) ?? 'Not signed in'}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto py-4">
              <Link
                href="/event"
                className="flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <CalendarDaysIcon className="w-6 h-6" />
                Event
              </Link>
              <Link
                href="/marketplace"
                className="flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ShoppingBagIcon className="w-6 h-6" />
                Market
              </Link>
              <Link
                href="/templates"
                className="flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <PencilSquareIcon className="w-6 h-6" />
                Templates
              </Link>
              <Link
                href="/my-cards"
                className="flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <PencilSquareIcon className="w-6 h-6" />
                My designs
              </Link>
              <Link
                href="/contacts"
                className="flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <UserGroupIcon className="w-6 h-6" />
                Contacts
              </Link>

              <div className="border-t border-gray-200 mt-4 pt-4">
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Cog6ToothIcon className="w-6 h-6" />
                  Settings
                </Link>
                <a
                  href="#"
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <QuestionMarkCircleIcon className="w-6 h-6" />
                  Help & Support
                </a>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full text-left transition-colors disabled:opacity-50"
                >
                  <ArrowRightStartOnRectangleIcon className="w-6 h-6" />
                  {session ? 'Sign Out' : 'Sign In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10"></div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="grid grid-cols-6 py-2">
          <Link href="/marketplace" className="flex flex-col items-center py-2 px-1">
            <ShoppingBagIcon className="w-6 h-6 text-gray-600" />
            <span className="text-xs text-gray-600 mt-1">Market</span>
          </Link>
          <Link href="/event" className="flex flex-col items-center py-2 px-1">
            <CalendarDaysIcon className="w-6 h-6 text-gray-600" />
            <span className="text-xs text-gray-600 mt-1">Event</span>
          </Link>
          <Link href="/templates" className="flex flex-col items-center py-2 px-1">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <PlusIcon className="w-5 h-5 text-white" />
            </div>
          </Link>
          <Link href="/my-cards" className="flex flex-col items-center py-2 px-1">
            <PencilSquareIcon className="w-6 h-6 text-gray-600" />
            <span className="text-xs text-gray-600 mt-1">My designs</span>
          </Link>
          <Link href="/contacts" className="flex flex-col items-center py-2 px-1">
            <UserGroupIcon className="w-6 h-6 text-gray-600" />
            <span className="text-xs text-gray-600 mt-1">Contacts</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main Pixshop Page Component
export default function PixshopPage() {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Sample image for initial state
  const sampleImageSrc = '/sample-landscape.jpg';

  useEffect(() => {
    if (!hasInitialized) {
      setCurrentImageSrc(sampleImageSrc);
      setHasInitialized(true);
    }
  }, [hasInitialized]);

  const handleImageUpdate = (newImageSrc: string) => {
    setCurrentImageSrc(newImageSrc);
  };

  return (
    <>
      {/* Cloned Sidebar and Mobile Menu */}
      <PixshopSidebar />
      <PixshopMobileMenu />

      {/* Main Content with proper spacing for sidebar */}
      <div className="md:pl-14 lg:pl-16 pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">Pixshop AI</h1>
                  <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-sm text-blue-700 font-medium">AI Powered</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Advanced AI-powered image editing tools • Standalone Editor
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  Enhanced by Artificial Intelligence
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="min-h-screen bg-gray-100">
          <div className="flex relative">
            <div className="flex-1 flex items-start justify-center min-h-[calc(100vh-200px)] py-4 lg:py-8 transition-all duration-300 px-4">
              <div className="w-full max-w-7xl mx-auto">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  
                  {/* Image Preview Area */}
                  <div className="xl:col-span-3">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                          Image Editor
                        </h2>
                        <p className="text-sm text-gray-600">
                          Your edited image will appear here. Use the tools on the right to modify your image.
                        </p>
                      </div>
                      
                      {/* Image Container */}
                      <div className="relative bg-gray-100 rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center">
                        {currentImageSrc ? (
                          <img
                            src={currentImageSrc}
                            alt="Current editing image"
                            className="max-w-full max-h-[600px] w-auto h-auto object-contain"
                          />
                        ) : (
                          <div className="text-center text-gray-500">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="mt-2 text-sm">
                              Upload an image to get started
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Image Upload Section */}
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                          Load New Image
                        </h3>
                        <div className="space-y-3">
                          {/* File Upload */}
                          <div>
                            <label htmlFor="file-upload" className="block text-xs text-gray-600 mb-1">
                              Upload from device:
                            </label>
                            <input
                              id="file-upload"
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const result = event.target?.result as string;
                                    setCurrentImageSrc(result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                          </div>

                          {/* URL Input */}
                          <div>
                            <label htmlFor="url-input" className="block text-xs text-gray-600 mb-1">
                              Load from URL:
                            </label>
                            <div className="flex gap-2">
                              <input
                                id="url-input"
                                type="url"
                                placeholder="https://example.com/image.jpg"
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const url = (e.target as HTMLInputElement).value;
                                    if (url) {
                                      setCurrentImageSrc(url);
                                    }
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById('url-input') as HTMLInputElement;
                                  const url = input.value;
                                  if (url) {
                                    setCurrentImageSrc(url);
                                  }
                                }}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                Load
                              </button>
                            </div>
                          </div>

                          {/* Sample Images */}
                          <div>
                            <p className="text-xs text-gray-600 mb-2">Or try a sample:</p>
                            <div className="flex gap-2 flex-wrap">
                              {[
                                { name: 'Landscape', src: '/sample-landscape.jpg' },
                                { name: 'Portrait', src: '/sample-portrait.jpg' },
                                { name: 'Test Image', src: '/test-image.jpg' }
                              ].map((sample) => (
                                <button
                                  key={sample.name}
                                  onClick={() => setCurrentImageSrc(sample.src)}
                                  className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                                >
                                  {sample.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = currentImageSrc;
                              link.download = 'edited-image.png';
                              link.click();
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => {
                              setCurrentImageSrc(sampleImageSrc);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Auto-save enabled
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pixshop Tools Panel */}
                  <div className="xl:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-fit">
                      <div className="p-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                          AI Tools
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          Select tools to edit your image
                        </p>
                      </div>
                      
                      <div className="h-[600px]">
                        <PixshopStandalone
                          currentImageSrc={currentImageSrc}
                          onImageUpdate={handleImageUpdate}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Help Section */}
                <div className="mt-8 bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">
                    Pixshop AI - Professional Image Editing
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
                    <div>
                      <h4 className="font-medium mb-2">🎯 Retouch</h4>
                      <p>Click on specific areas and describe changes. Perfect for adjusting elements, changing colors, or adding details with AI precision.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">⚡ Adjust</h4>
                      <p>Use AI to automatically enhance your images with brightness, contrast, saturation, and other professional adjustments.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">🎨 Filters</h4>
                      <p>Apply artistic filters and styles to transform your images with various effects and custom looks powered by AI.</p>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-white rounded-md border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <strong>💡 Pro Tip:</strong> Pixshop is also integrated into the card editor. When editing cards, 
                      click the "Pixshop" tab in the Pintura editor for context-aware image editing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
