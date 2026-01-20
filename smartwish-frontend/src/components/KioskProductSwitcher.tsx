"use client";

import { useRouter } from "next/navigation";
import { HomeIcon } from "@heroicons/react/24/outline";

export default function KioskProductSwitcher() {
  const router = useRouter();

  const handleGoHome = () => {
    router.push("/kiosk/home");
  };

  return (
    <>
      {/* Home Button - Large round button aligned with search bar */}
      <button
        onClick={handleGoHome}
        className="fixed top-[22px] left-4 sm:left-6 z-50 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full shadow-xl border-3 hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 group bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 border-white/30"
        aria-label="Go to home"
        title="Go to home"
      >
        {/* Home icon */}
        <HomeIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
      </button>
    </>
  );
}
