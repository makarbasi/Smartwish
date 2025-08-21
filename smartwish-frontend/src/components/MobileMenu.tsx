"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Bars3Icon,
  XMarkIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  // MegaphoneIcon, // feedback link is commented out below
  // CurrencyDollarIcon, // pricing link commented out below
  ShoppingBagIcon,
  ArrowRightStartOnRectangleIcon,
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

export default function MobileMenu() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }

    if (typeof window !== "undefined") {
      handleScroll();
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <div className="md:hidden">
      {/* Content spacer to prevent overlap with hamburger button */}
      <div className="h-16"></div>

      {/* Container bar that appears on scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out ${
          isScrolled
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        }`}
      >
        <div className="h-16"></div>
      </div>

      {/* Fixed position hamburger button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-3 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Hamburger Menu Overlay */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ease-in-out ${
          mobileMenuOpen
            ? "bg-gray-700/30 pointer-events-auto"
            : "bg-transparent pointer-events-none"
        }`}
      >
        <div
          className={`w-80 bg-white h-full shadow-xl transform transition-all duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              {/* Replace Menu text with horizontal full logo for mobile header */}
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
                  src="https://i.pravatar.cc/80?img=12"
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full ring-1 ring-gray-200"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Abubakar Tariq
                  </div>
                  <div className="text-xs text-gray-500">
                    abubakar72@gmail.com
                  </div>
                </div>
              </div>
            </div>



            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto py-4">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </Link>
              ))}

              {/* Additional menu items */}
              <div className="border-t border-gray-200 mt-4 pt-4">
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Cog6ToothIcon className="w-6 h-6" />
                  Settings
                </Link>
                <Link
                  href="/help"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <QuestionMarkCircleIcon className="w-6 h-6" />
                  Help & Support
                </Link>
                {/*
                                <Link 
                                    href="/feedback" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <MegaphoneIcon className="w-6 h-6" />
                                    Feedback
                                </Link>
                                <Link 
                                    href="/pricing" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <CurrencyDollarIcon className="w-6 h-6" />
                                    Pricing
                                </Link>
                                */}
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                >
                  <ArrowRightStartOnRectangleIcon className="w-6 h-6" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Click outside to close */}
        <div
          className="absolute inset-0 -z-10"
          onClick={() => setMobileMenuOpen(false)}
        />
      </div>
    </div>
  );
}
