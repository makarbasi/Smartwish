"use client";

import { usePathname, useRouter } from "next/navigation";
import {
    HomeIcon,
    CalendarDaysIcon,
    ShoppingBagIcon,
    PencilSquareIcon,
    UserCircleIcon,
} from "@heroicons/react/24/outline";
import {
    HomeIcon as HomeIconSolid,
    CalendarDaysIcon as CalendarIconSolid,
    ShoppingBagIcon as ShoppingBagIconSolid,
    PencilSquareIcon as PencilIconSolid,
    UserCircleIcon as UserCircleIconSolid,
} from "@heroicons/react/24/solid";

type TabItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeIcon: React.ComponentType<{ className?: string }>;
};

const tabs: TabItem[] = [
    { href: "/templates", label: "Templates", icon: HomeIcon, activeIcon: HomeIconSolid },
    { href: "/event", label: "Events", icon: CalendarDaysIcon, activeIcon: CalendarIconSolid },
    { href: "/my-cards", label: "Designs", icon: PencilSquareIcon, activeIcon: PencilIconSolid },
    { href: "/marketplace", label: "Market", icon: ShoppingBagIcon, activeIcon: ShoppingBagIconSolid },
    { href: "/settings", label: "Settings", icon: UserCircleIcon, activeIcon: UserCircleIconSolid },
];

export default function IOSTabBar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleTabClick = (href: string) => {
        router.push(href);
    };

    return (
        <div className="md:hidden">
            {/* iOS-style tab bar - fixed at bottom with safe area */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 z-40">
                {/* Tab bar content */}
                <div className="flex items-center justify-around px-2 pt-1 pb-safe">
                    {tabs.map((tab) => {
                        const isActive = pathname.startsWith(tab.href);
                        const Icon = isActive ? tab.activeIcon : tab.icon;

                        return (
                            <button
                                key={tab.href}
                                onClick={() => handleTabClick(tab.href)}
                                className="flex flex-col items-center justify-center flex-1 py-2 px-1 group"
                            >
                                <div
                                    className={`transition-all duration-200 ${isActive
                                            ? "scale-100"
                                            : "scale-100 group-active:scale-90"
                                        }`}
                                >
                                    <Icon
                                        className={`w-6 h-6 transition-colors ${isActive
                                                ? "text-indigo-600"
                                                : "text-gray-500 group-active:text-gray-700"
                                            }`}
                                    />
                                </div>
                                <span
                                    className={`text-[10px] mt-0.5 font-medium transition-colors ${isActive
                                            ? "text-indigo-600"
                                            : "text-gray-500 group-active:text-gray-700"
                                        }`}
                                >
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Safe area for home indicator on iOS */}
                <div className="h-safe bg-white/80" />
            </div>
        </div>
    );
}






