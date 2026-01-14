"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ComputerDesktopIcon,
  UserGroupIcon,
  GiftIcon,
  CreditCardIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: HomeIcon },
  { name: "Chat", href: "/admin/chat", icon: ChatBubbleLeftRightIcon },
  { name: "Kiosks", href: "/admin/kiosks", icon: ComputerDesktopIcon },
  { name: "Managers", href: "/admin/managers", icon: UserGroupIcon },
  { name: "Gift Card Brands", href: "/admin/gift-card-brands", icon: GiftIcon },
  { name: "Gift Cards", href: "/admin/gift-cards", icon: CreditCardIcon },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (status === "unauthenticated") {
    return null;
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/sign-in" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50 lg:hidden"
          onClose={setSidebarOpen}
        >
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon
                        className="h-6 w-6 text-white"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </Transition.Child>

                {/* Mobile sidebar content */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-white" />
                    <span className="ml-2 text-xl font-bold text-white">
                      SmartWish Admin
                    </span>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={classNames(
                                  pathname === item.href
                                    ? "bg-indigo-700 text-white"
                                    : "text-indigo-200 hover:text-white hover:bg-indigo-700",
                                  "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6"
                                )}
                              >
                                <item.icon
                                  className={classNames(
                                    pathname === item.href
                                      ? "text-white"
                                      : "text-indigo-200 group-hover:text-white",
                                    "h-6 w-6 shrink-0"
                                  )}
                                  aria-hidden="true"
                                />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li className="mt-auto">
                        <button
                          onClick={handleSignOut}
                          className="group -mx-2 flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-indigo-200 hover:bg-indigo-700 hover:text-white"
                        >
                          <ArrowRightOnRectangleIcon
                            className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                            aria-hidden="true"
                          />
                          Sign out
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <ShieldCheckIcon className="h-8 w-8 text-white" />
            <span className="ml-2 text-xl font-bold text-white">
              SmartWish Admin
            </span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={classNames(
                          pathname === item.href
                            ? "bg-indigo-700 text-white"
                            : "text-indigo-200 hover:text-white hover:bg-indigo-700",
                          "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6"
                        )}
                      >
                        <item.icon
                          className={classNames(
                            pathname === item.href
                              ? "text-white"
                              : "text-indigo-200 group-hover:text-white",
                            "h-6 w-6 shrink-0"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>

              {/* User info & sign out */}
              <li className="mt-auto">
                <div className="border-t border-indigo-500 pt-4">
                  <div className="flex items-center gap-x-3 px-2 py-2 text-sm text-indigo-200">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500">
                      <span className="text-sm font-medium text-white">
                        {session?.user?.email?.[0]?.toUpperCase() || "A"}
                      </span>
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium text-white truncate">
                        {session?.user?.name || "Admin"}
                      </p>
                      <p className="text-xs text-indigo-300 truncate">
                        {session?.user?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="group mt-2 -mx-2 flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-indigo-200 hover:bg-indigo-700 hover:text-white"
                  >
                    <ArrowRightOnRectangleIcon
                      className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                      aria-hidden="true"
                    />
                    Sign out
                  </button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex flex-1 items-center justify-end gap-x-4 lg:gap-x-6">
            <div className="flex items-center gap-x-2">
              <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
              <span className="font-semibold text-gray-900">Admin Panel</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] lg:min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
