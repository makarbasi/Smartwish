"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

export default function PromoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="relative isolate flex items-center gap-x-4 overflow-hidden bg-gray-50 px-4 py-2 sm:gap-x-6 sm:px-6 sm:py-2.5 sm:before:flex-1 rounded-md">
      <div
        aria-hidden
        className="absolute top-1/2 left-[max(-7rem,calc(50%-52rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      >
        <div
          style={{
            clipPath:
              "polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)",
          }}
          className="aspect-577/310 w-144.25 bg-linear-to-r from-[#ff80b5] to-[#9089fc] opacity-30"
        />
      </div>
      <div
        aria-hidden
        className="absolute top-1/2 left-[max(45rem,calc(50%+8rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      >
        <div
          style={{
            clipPath:
              "polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)",
          }}
          className="aspect-577/310 w-144.25 bg-linear-to-r from-[#ff80b5] to-[#9089fc] opacity-30"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
        <p className="text-xs text-gray-900 sm:text-sm/6">
          <strong className="font-semibold">GeneriCon 2023</strong>
          <svg viewBox="0 0 2 2" aria-hidden className="mx-1.5 inline size-0.5 fill-current sm:mx-2">
            <circle r={1} cx={1} cy={1} />
          </svg>
          <span className="hidden sm:inline">Join us in Denver from June 7 – 9 to see what's coming next.</span>
          <span className="sm:hidden">Join us in Denver June 7-9</span>
        </p>
        <a
          href="#"
          className="flex-none rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 sm:px-3.5 sm:py-1 sm:text-sm"
        >
          Register now <span aria-hidden>&rarr;</span>
        </a>
      </div>
      <div className="flex flex-1 justify-end">
        <button type="button" className="-m-2 p-2 sm:-m-3 sm:p-3 focus-visible:-outline-offset-4" onClick={() => setVisible(false)}>
          <span className="sr-only">Dismiss</span>
          <XMarkIcon aria-hidden className="size-4 text-gray-900 sm:size-5" />
        </button>
      </div>
    </div>
  );
}