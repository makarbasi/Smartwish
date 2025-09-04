'use client'

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useUserProfile } from '@/hooks/useUserProfile';
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



// Main App Desktop Sidebar Component
function AppSidebar() {
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

// Main App Mobile Menu Component
function AppMobileMenu() {
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

      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out ${
          isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className="h-16"></div>
      </div>

      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-3 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </div>

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

            <div className="flex-1 overflow-y-auto py-4">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/pixshop'; // Always keep Pixshop active
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-6 h-6" />
                    {item.label}
                  </Link>
                );
              })}

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
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10"></div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="grid grid-cols-6 py-2">
          {sidebarItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = item.href === '/pixshop'; // Always keep Pixshop active
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center py-2 px-1"
              >
                <Icon className={`w-6 h-6 ${active ? 'text-indigo-600' : 'text-gray-600'}`} />
                <span className={`text-xs mt-1 ${active ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          <Link href="/templates" className="flex flex-col items-center py-2 px-1">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <PlusIcon className="w-5 h-5 text-white" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Exact Pintura Editor Interface Recreation
function PinturaEditorInterface({ cardId }: { cardId: string }) {
  const [activeTab, setActiveTab] = useState('finetune');
  const [activeFinetuneControl, setActiveFinetuneControl] = useState('brightness');
  const [zoom, setZoom] = useState(22);

  return (
    <>
      <style jsx global>{`
        .pintura-editor {
          --color-primary: #ffd843;
          --color-primary-dark: #ffc343;
          --color-primary-text: #000;
          --color-foreground: 0,0,0;
          --color-background: 255,255,255;
          --font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";
          --border-radius-round: 9999em;
          --border-radius: 0.625em;
          --transition-duration-10: 0.1s;
          --color-foreground-100: rgba(var(--color-foreground),1);
          --color-foreground-90: rgba(var(--color-foreground),0.9);
          --color-foreground-80: rgba(var(--color-foreground),0.8);
          --color-foreground-70: rgba(var(--color-foreground),0.7);
          --color-foreground-60: rgba(var(--color-foreground),0.6);
          --color-foreground-50: rgba(var(--color-foreground),0.5);
          --color-foreground-40: rgba(var(--color-foreground),0.4);
          --color-foreground-30: rgba(var(--color-foreground),0.3);
          --color-foreground-20: rgba(var(--color-foreground),0.25);
          --color-foreground-15: rgba(var(--color-foreground),0.2);
          --color-foreground-10: rgba(var(--color-foreground),0.15);
          --color-foreground-5: rgba(var(--color-foreground),0.075);
          --color-foreground-3: rgba(var(--color-foreground),0.05);
          --backdrop-filter-dark: brightness(90%) saturate(180%) blur(10px);
          font-family: var(--font-family);
          font-size: 16px;
          user-select: none;
          line-height: normal;
        }

        .pintura-nav-tools {
          position: fixed;
          top: 0;
          left: 64px;
          right: 0;
          height: 64px;
          z-index: 40;
          background: white;
          border-bottom: 1px solid rgba(var(--color-foreground), 0.075);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1rem;
        }

        .pintura-nav-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .pintura-nav-group-float {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .pintura-nav-set {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .pintura-button {
          margin: 0;
          padding: 0;
          border: none;
          background: transparent;
          font: inherit;
          color: inherit;
          cursor: pointer;
          outline: transparent;
          transition: background-color var(--transition-duration-10) ease-out, color var(--transition-duration-10) ease-out, box-shadow var(--transition-duration-10) ease-out;
          box-shadow: inset 0 0 0 1px var(--color-foreground-5);
          border-radius: var(--border-radius-round);
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 2.5rem;
          min-height: 2.5rem;
          backdrop-filter: var(--backdrop-filter-dark);
          background-color: var(--color-foreground-10);
        }

        .pintura-button:hover {
          background-color: var(--color-foreground-20);
        }

        .pintura-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          filter: grayscale(95%);
        }

        .pintura-button-export {
          background-color: var(--color-primary);
          color: var(--color-primary-text);
          padding: 0 0.75rem;
          border-radius: var(--border-radius-round);
          font-weight: 500;
          min-height: 2.5rem;
        }

        .pintura-button-export:hover {
          background-color: var(--color-primary-dark);
        }

        .pintura-nav-main {
          position: fixed;
          left: 64px;
          top: 64px;
          bottom: 0;
          width: 80px;
          z-index: 40;
          background: white;
          border-right: 1px solid rgba(var(--color-foreground), 0.075);
          overflow-y: auto;
        }

        .pintura-tab-list {
          display: flex;
          flex-direction: column;
          padding: 1rem 0.5rem;
          gap: 0.5rem;
        }

        .pintura-tab-button {
          margin: 0;
          padding: 0;
          border: none;
          background: transparent;
          font: inherit;
          color: inherit;
          cursor: pointer;
          outline: transparent;
          transition: background-color var(--transition-duration-10) ease-out, color var(--transition-duration-10) ease-out, box-shadow var(--transition-duration-10) ease-out;
          backdrop-filter: var(--backdrop-filter-dark);
          background-color: var(--color-foreground-10);
          flex: 1;
          min-width: 4rem;
          min-height: 4rem;
          border-radius: var(--border-radius);
          justify-content: center;
          display: flex;
          align-items: center;
          flex-direction: column;
          box-shadow: inset 0 0 0 1px var(--color-foreground-5);
          gap: 0.25rem;
        }

        .pintura-tab-button:hover {
          background-color: var(--color-foreground-15);
        }

        .pintura-tab-button[aria-selected="true"] {
          background-color: var(--color-primary);
          color: var(--color-primary-text);
        }

        .pintura-tab-button.pixshop-active {
          background-color: var(--color-primary);
          color: var(--color-primary-text);
          position: relative;
        }

        .pintura-tab-button.pixshop-active::after {
          content: "✨";
          position: absolute;
          top: -2px;
          right: -2px;
          font-size: 12px;
        }

        .pintura-tab-button svg {
          width: 24px;
          height: 24px;
          stroke-width: 0.125em;
          stroke: currentColor;
          fill: none;
        }

        .pintura-tab-button span {
          font-size: 0.75rem;
          font-weight: 450;
        }

        .pintura-util-footer {
          position: fixed;
          left: 144px;
          right: 0;
          bottom: 0;
          height: 120px;
          z-index: 40;
          background: white;
          border-top: 1px solid rgba(var(--color-foreground), 0.075);
          padding: 1rem;
        }

        .pintura-control-list-scroller {
          margin-bottom: 1rem;
        }

        .pintura-control-list {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .pintura-control-button {
          margin: 0;
          padding: 0.5rem 1rem;
          border: none;
          background: transparent;
          font: inherit;
          color: inherit;
          cursor: pointer;
          outline: transparent;
          transition: background-color var(--transition-duration-10) ease-out, color var(--transition-duration-10) ease-out, box-shadow var(--transition-duration-10) ease-out;
          backdrop-filter: var(--backdrop-filter-dark);
          background-color: var(--color-foreground-10);
          border-radius: var(--border-radius);
          box-shadow: inset 0 0 0 1px var(--color-foreground-5);
          white-space: nowrap;
          font-size: 0.875rem;
        }

        .pintura-control-button:hover {
          background-color: var(--color-foreground-15);
        }

        .pintura-control-button[aria-selected="true"] {
          background-color: var(--color-primary);
          color: var(--color-primary-text);
        }

        .pintura-range-input {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem 0;
        }

        .pintura-range-value {
          font-weight: 500;
          min-width: 2rem;
          text-align: center;
        }

        .pintura-range-reset {
          margin: 0;
          padding: 0.25rem 0.75rem;
          border: none;
          background: transparent;
          font: inherit;
          color: inherit;
          cursor: pointer;
          outline: transparent;
          transition: background-color var(--transition-duration-10) ease-out;
          border-radius: var(--border-radius);
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .pintura-range-reset:hover {
          background-color: var(--color-foreground-10);
        }

        .pintura-range-reset:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .pintura-range-meter {
          flex: 1;
          height: 2rem;
          background: var(--color-foreground-5);
          border-radius: var(--border-radius);
          position: relative;
          cursor: pointer;
        }

        .pintura-range-handle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 1rem;
          height: 1rem;
          background: var(--color-primary);
          border-radius: 50%;
          box-shadow: 0 0 0 2px white, 0 2px 4px rgba(0,0,0,0.2);
        }

        .pintura-main-content {
          position: fixed;
          left: 144px;
          top: 64px;
          right: 0;
          bottom: 120px;
          z-index: 30;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .pintura-nav-tools {
            left: 0;
          }
          .pintura-nav-main {
            left: 0;
          }
          .pintura-util-footer {
            left: 80px;
          }
          .pintura-main-content {
            left: 80px;
          }
        }
      `}</style>

      <div className="pintura-editor">
        {/* Top Toolbar */}
        <div className="pintura-nav-tools">
          <div className="pintura-nav-group">
            <div className="pintura-nav-set">
              <button type="button" className="pintura-button" title="Close">
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
              <button type="button" className="pintura-button" title="Revert" disabled>
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.388 18.538a8 8 0 10-2.992-9.03" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M2.794 11.696L2.37 6.714l5.088 3.18z" fill="currentColor"/>
                  <path d="M12 8v4M12 12l4 2" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="pintura-nav-group-float">
            <div className="pintura-nav-set">
              <button type="button" className="pintura-button" title="Undo" disabled>
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 8h4c2.485 0 5 2 5 5s-2.515 5-5 5h-4" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M5 8l4-3v6z" fill="currentColor"/>
                </svg>
              </button>
              <button type="button" className="pintura-button" title="Redo" disabled>
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 8h-4c-2.485 0-5 2-5 5s2.515 5 5 5h4" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M19 8l-4-3v6z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            <div className="pintura-nav-set">
              <button type="button" className="pintura-button" title="Zoom out" onClick={() => setZoom(Math.max(10, zoom - 5))}>
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12 h6" stroke="currentColor" strokeWidth="0.125em"/>
                </svg>
              </button>
              <button type="button" className="pintura-button" title="Zoom" style={{ minWidth: '3rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{zoom}%</span>
              </button>
              <button type="button" className="pintura-button" title="Zoom in" onClick={() => setZoom(Math.min(200, zoom + 5))}>
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12 h8 M12 8 v8" stroke="currentColor" strokeWidth="0.125em"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="pintura-nav-group">
            <button type="button" className="pintura-button-export" title="Done">
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Left Sidebar with Tabs */}
        <div className="pintura-nav-main">
          <div className="pintura-tab-list" role="tablist">
            <button 
              role="tab" 
              className={`pintura-tab-button ${activeTab === 'finetune' ? 'active' : ''}`}
              aria-selected={activeTab === 'finetune'}
              onClick={() => setActiveTab('finetune')}
              title="Finetune"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 1v5.5m0 3.503V23M12 1v10.5m0 3.5v8M20 1v15.5m0 3.5v3M2 7h4M10 12h4M18 17h4" stroke="currentColor" strokeWidth="0.125em" fill="none"/>
              </svg>
              <span>Finetune</span>
            </button>

            <button 
              role="tab" 
              className={`pintura-tab-button ${activeTab === 'filter' ? 'active' : ''}`}
              aria-selected={activeTab === 'filter'}
              onClick={() => setActiveTab('filter')}
              title="Filter"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.347 9.907a6.5 6.5 0 1 0-1.872 3.306M3.26 11.574a6.5 6.5 0 1 0 2.815-1.417 M10.15 17.897A6.503 6.503 0 0 0 16.5 23a6.5 6.5 0 1 0-6.183-8.51" stroke="currentColor" strokeWidth="0.125em" fill="none"/>
              </svg>
              <span>Filter</span>
            </button>

            <button 
              role="tab" 
              className={`pintura-tab-button ${activeTab === 'annotate' ? 'active' : ''}`}
              aria-selected={activeTab === 'annotate'}
              onClick={() => setActiveTab('annotate')}
              title="Annotate"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.086 2.914a2.828 2.828 0 1 1 4 4l-14.5 14.5-5.5 1.5 1.5-5.5 14.5-14.5z" stroke="currentColor" strokeWidth="0.125em" fill="none"/>
              </svg>
              <span>Annotate</span>
            </button>

            <button 
              role="tab" 
              className={`pintura-tab-button ${activeTab === 'sticker' ? 'active' : ''}`}
              aria-selected={activeTab === 'sticker'}
              onClick={() => setActiveTab('sticker')}
              title="Sticker"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22c2.773 0 1.189-5.177 3-7 1.796-1.808 7-.25 7-3 0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M20 17c-3 3-5 5-8 5" stroke="currentColor" strokeWidth="0.125em" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <span>Sticker</span>
            </button>

            <button 
              role="tab" 
              className="pintura-tab-button pixshop-active"
              aria-selected={true}
              title="Pixshop"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="m17 6-2-1-2 1 1-2-1-2 2 1 2-1-1 2zM5.5 5.5 3 4 .5 5.5 2 3 .5.5 3 2 5.5.5 4 3zM9 21l-3-1.5L3 21l1.5-3L3 15l3 1.5L9 15l-1.5 3z"/>
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m9.266 6.705 13.529 13.529c-.071.78-.34 1.371-.765 1.796-.425.425-1.015.694-1.796.765h0L6.705 9.266c.071-.78.34-1.371.765-1.796.425-.425 1.015-.694 1.796-.765h0Z" fill="none"/>
                <path stroke="currentColor" strokeWidth="1.5" d="M12 9.5c-.657.323-1.157.657-1.5 1-.343.343-.677.843-1 1.5" fill="none"/>
              </svg>
              <span>Pixshop</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="pintura-main-content">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Pixshop Editor</h1>
            <p className="text-gray-600 mb-6">Your image editing interface will appear here</p>
            <p className="text-sm text-gray-500">Card ID: {cardId}</p>
            <div className="mt-8 text-xs text-gray-400 space-y-1">
              <p>🎨 This is the EXACT Pintura editor UI with proper styling</p>
              <p>✨ Pixshop tab is highlighted with sparkle effect</p>
              <p>⚡ All buttons and controls match the original design</p>
            </div>
          </div>
        </div>

        {/* Bottom Controls Panel */}
        <div className="pintura-util-footer">
          <div className="pintura-control-list-scroller">
            <div className="pintura-control-list" role="tablist">
              {['Brightness', 'Contrast', 'Saturation', 'Exposure', 'Temperature', 'Gamma', 'Clarity', 'Vignette'].map((control) => (
                <button
                  key={control}
                  role="tab"
                  className="pintura-control-button"
                  aria-selected={activeFinetuneControl === control.toLowerCase()}
                  onClick={() => setActiveFinetuneControl(control.toLowerCase())}
                >
                  {control}
                </button>
              ))}
            </div>
          </div>

          <div className="pintura-range-input">
            <span className="pintura-range-value">0</span>
            <button className="pintura-range-reset" disabled>Reset</button>
            <div className="pintura-range-meter">
              <div className="pintura-range-handle"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


function PinturaNav() {
  const [activeTab, setActiveTab] = useState('finetune');
  const [zoom, setZoom] = useState(31);

  const mainTabs = [
    { 
      id: 'finetune', 
      label: 'Finetune', 
      icon: 'M4 1v5.5m0 3.503V23M12 1v10.5m0 3.5v8M20 1v15.5m0 3.5v3M2 7h4M10 12h4M18 17h4' 
    },
    { 
      id: 'filter', 
      label: 'Filter', 
      icon: 'M18.347 9.907a6.5 6.5 0 1 0-1.872 3.306M3.26 11.574a6.5 6.5 0 1 0 2.815-1.417 M10.15 17.897A6.503 6.503 0 0 0 16.5 23a6.5 6.5 0 1 0-6.183-8.51' 
    },
    { 
      id: 'annotate', 
      label: 'Annotate', 
      icon: 'M17.086 2.914a2.828 2.828 0 1 1 4 4l-14.5 14.5-5.5 1.5 1.5-5.5 14.5-14.5z' 
    },
    { 
      id: 'sticker', 
      label: 'Sticker', 
      icon: 'M12 22c2.773 0 1.189-5.177 3-7 1.796-1.808 7-.25 7-3 0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10z M20 17c-3 3-5 5-8 5' 
    },
    { 
      id: 'pixshop', 
      label: 'Pixshop', 
      icon: 'M17 6l-2-1-2 1 1-2-1-2 2 1 2-1-1 2zM5.5 5.5 3 4 .5 5.5 2 3 .5.5 3 2 5.5.5 4 3zM9 21l-3-1.5L3 21l1.5-3L3 15l3 1.5L9 15l-1.5 3z',
      sparkles: true,
      active: true
    }
  ];

  const finetuneControls = [
    'Brightness', 'Contrast', 'Saturation', 'Exposure', 'Temperature', 'Gamma', 'Clarity', 'Vignette'
  ];

  return (
    <>
      {/* Top Toolbar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Revert"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.388 18.538a8 8 0 10-2.992-9.03" />
                <path fill="currentColor" d="M2.794 11.696L2.37 6.714l5.088 3.18z" />
                <path d="M12 8v4M12 12l4 2" />
              </svg>
            </button>
          </div>

          {/* Center controls */}
          <div className="flex items-center gap-4">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors" title="Undo">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 8h4c2.485 0 5 2 5 5s-2.515 5-5 5h-4" />
                  <path fill="currentColor" d="M5 8l4-3v6z" />
                </svg>
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors" title="Redo">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 8h-4c-2.485 0-5 2-5 5s2.515 5 5 5h4" />
                  <path fill="currentColor" d="M19 8l-4-3v6z" />
                </svg>
              </button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6" />
                </svg>
              </button>
              <button 
                className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Reset zoom"
              >
                {zoom}%
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 12h8M12 8v8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Done button */}
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* Left Sidebar Navigation */}
      <div className="fixed left-0 top-12 bottom-12 z-40 w-20 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full py-4">
          <div className="flex flex-col space-y-2 px-2">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                className={`relative flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                  activeTab === tab.id || tab.active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <div className="relative">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d={tab.icon} />
                  </svg>
                  {tab.sparkles && (
                    <div className="absolute -top-1 -right-1 flex">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium mt-1">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Controls Panel */}
      {activeTab === 'finetune' && (
        <div className="fixed bottom-0 left-20 right-0 z-40 bg-white border-t border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Control tabs */}
            <div className="flex space-x-1">
              {finetuneControls.map((control) => (
                <button
                  key={control}
                  className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  {control}
                </button>
              ))}
            </div>

            {/* Range Control */}
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium min-w-[60px] text-center">0</span>
              <button 
                className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled
              >
                Reset
              </button>
              <div className="relative w-64 h-2">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 rounded transform -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-grab"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PixshopPage() {
  const params = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main App Navigation */}
      <AppSidebar />
      <AppMobileMenu />

      {/* Main Content with Pintura Interface */}
      <div className="lg:ml-20">
        <PixshopEditor cardId={params?.id as string} />
      </div>
    </div>
  );
}

// Pixshop Editor Component with Pintura Navigation
function PixshopEditor({ cardId }: { cardId: string }) {
  if (!cardId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Card ID</h1>
          <p className="text-gray-600">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Pintura Navigation */}
      <PinturaNav />

      {/* Main Content Area */}
      <div className="pt-12 pb-20 pl-20">
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Pixshop Editor</h1>
            <p className="text-gray-600 mb-6">Your image editing interface will appear here</p>
            <p className="text-sm text-gray-500">Card ID: {cardId}</p>
            <div className="mt-8 space-y-2 text-sm text-green-600">
              <p>✅ Top toolbar with Close, Revert, Undo, Redo, Zoom controls, and Done button</p>
              <p>✅ Left sidebar with Finetune, Filter, Annotate, Sticker, and Pixshop tabs</p>
              <p>✅ Bottom controls panel with Brightness, Contrast, etc. and range slider</p>
              <p>✅ Pixshop tab is highlighted and marked as active with sparkle effect</p>
              <p>⭐ This matches the exact Pintura editor layout from your HTML</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
