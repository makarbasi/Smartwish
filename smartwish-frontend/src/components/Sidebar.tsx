"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PlusIcon } from "@heroicons/react/20/solid";
import {
  CalendarDaysIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  MegaphoneIcon,
  // CurrencyDollarIcon, // commented out because pricing link is commented below
  ShoppingBagIcon,
  ArrowRightStartOnRectangleIcon,
  // UserIcon removed (unused)
  UserGroupIcon,
} from "@heroicons/react/24/outline";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<Record<string, unknown>>;
};

const items: Item[] = [
  { href: "/event", label: "Event", icon: CalendarDaysIcon },
  { href: "/marketplace", label: "Market", icon: ShoppingBagIcon },
  { href: "/my-cards", label: "My cards", icon: PencilSquareIcon },
  { href: "/contacts", label: "Contacts", icon: UserGroupIcon },
];

// Page Navigator Component for card detail pages
function PageNavigator() {
  const [currentPage, setCurrentPage] = useState(1);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      // Emit custom event for page navigation
      window.dispatchEvent(
        new CustomEvent("pageNavigation", {
          detail: { action: "prev", page: currentPage - 1 },
        })
      );
    }
  };

  const handleNextPage = () => {
    if (currentPage < 4) {
      setCurrentPage(currentPage + 1);
      // Emit custom event for page navigation
      window.dispatchEvent(
        new CustomEvent("pageNavigation", {
          detail: { action: "next", page: currentPage + 1 },
        })
      );
    }
  };

  const goToPage = (pageIndex: number) => {
    setCurrentPage(pageIndex);
    // Emit custom event for page navigation
    window.dispatchEvent(
      new CustomEvent("pageNavigation", {
        detail: { action: "goto", page: pageIndex },
      })
    );
  };

  // Listen for page changes from the main component
  useEffect(() => {
    const handlePageChange = (event: Event) => {
      const ev = event as CustomEvent;
      if (ev?.detail?.currentPage !== undefined) {
        setCurrentPage(ev.detail.currentPage);
      }
    };

    window.addEventListener("pageChanged", handlePageChange);
    return () => window.removeEventListener("pageChanged", handlePageChange);
  }, []);

  return (
    <div className="fixed bottom-20 left-0 right-0 z-30 flex items-center justify-center"></div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: session } = useSession();
  const { user } = useUserProfile();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Get profile picture URL - prioritize Supabase profile image, fallback to session image, then default
  const profileImageUrl = user?.profileImage || (session?.user?.image as string) || "https://i.pravatar.cc/80?img=12";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <>
      {/* Desktop Sidebar - Same as before */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-50 hidden w-14 flex-col items-center border-r border-gray-200 bg-white py-6 md:flex lg:w-16"
      >
        {/* Logo placed above the + button (desktop) */}
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

        <Link
          href="/templates"
          title="Templates"
          className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-500"
        >
          <PlusIcon className="h-5 w-5" />
        </Link>

        <ul className="flex w-full flex-1 flex-col items-stretch gap-3 px-1">
          {items.map((it) => {
            const Icon = it.icon;
            const active = pathname === it.href;
            return (
              <li key={it.href} className="flex justify-center">
                <Link
                  href={it.href}
                  title={it.label}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-md ring-1 transition-colors ${
                    active
                      ? "bg-gray-100 text-gray-900 ring-gray-200"
                      : "text-gray-600 ring-transparent hover:bg-gray-50 hover:text-gray-900 hover:ring-gray-200"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Profile */}
        <div className="mt-auto w-full px-1 pb-1" ref={popoverRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5"
          >
            <span className="sr-only">Open profile</span>
            <Image
              src={profileImageUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full ring-1 ring-gray-200"
            />
          </button>

          {profileOpen && (
            <div className="absolute bottom-12 left-12 z-60 w-72 rounded-xl border border-gray-200 bg-white text-sm shadow-xl">
              <div className="p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Accounts
                </div>
                <div className="mt-2 flex items-center rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                  <div className="flex items-center gap-3">
                    <Image
                      src={profileImageUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full ring-1 ring-gray-200"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {(user?.name || session?.user?.name) ?? "Guest"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(user?.email || session?.user?.email) ?? "Not signed in"}
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
                  <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400" />{" "}
                  Help and resources
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <MegaphoneIcon className="h-5 w-5 text-gray-400" /> Whats new
                </a>
                {/*
                <a
                  href="#"
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <CurrencyDollarIcon className="h-5 w-5 text-gray-400" /> Plans
                  and pricing
                </a>
                */}
                <a
                  href="#"
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <ShoppingBagIcon className="h-5 w-5 text-gray-400" /> Purchase
                  history
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
                      // Store current page and redirect to sign-in with callback
                      const currentPath = pathname;
                      const callbackUrl = encodeURIComponent(currentPath);
                      router.push(`/sign-in?callbackUrl=${callbackUrl}`);
                    }
                  }}
                  className={
                    session
                      ? "flex items-center gap-3 rounded-md bg-red-50 px-2 py-2 font-medium text-red-600 hover:bg-red-100"
                      : "flex items-center gap-3 rounded-md bg-indigo-50 px-2 py-2 font-medium text-indigo-700 hover:bg-indigo-100"
                  }
                >
                  <ArrowRightStartOnRectangleIcon className="h-5 w-5" />{" "}
                  {session ? "Log out" : "Sign in"}
                </a>
              </div>
            </div>
          )}

          {/* Auth modal removed - sign-in navigates to /sign-in */}
        </div>
      </nav>

      {/* Mobile View */}
      <div className="md:hidden">
        {/* Page Navigation above Bottom Navigation - only show on card detail pages */}
        {pathname.includes("/my-cards/") && <PageNavigator />}

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
          <div className="grid grid-cols-5 py-2">
            <Link
              href="/marketplace"
              className="flex flex-col items-center py-2 px-1"
            >
              <ShoppingBagIcon className="w-6 h-6 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">Market</span>
            </Link>
            <Link
              href="/event"
              className="flex flex-col items-center py-2 px-1"
            >
              <CalendarDaysIcon className="w-6 h-6 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">Event</span>
            </Link>
            <Link
              href="/templates"
              className="flex flex-col items-center py-2 px-1"
            >
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <PlusIcon className="w-5 h-5 text-white" />
              </div>
            </Link>
            <Link
              href="/my-cards"
              className="flex flex-col items-center py-2 px-1"
            >
              <PencilSquareIcon className="w-6 h-6 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">My Cards</span>
            </Link>
            <Link
              href="/contacts"
              className="flex flex-col items-center py-2 px-1"
            >
              <UserGroupIcon className="w-6 h-6 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">Contacts</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
