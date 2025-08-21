"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  console.log(
    "🎭 AuthModal render - open:",
    open,
    "mounted:",
    mounted,
    "visible:",
    visible
  );

  // Handle mount/unmount with a small show animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      // next frame to allow CSS transition from initial state
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleCloseAnimated() {
    setVisible(false);
    setTimeout(() => onClose(), 220);
  }

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        onClick={handleCloseAnimated}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Modal panel */}
      <div
        className={`relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg transform transition-all duration-200 ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-2 scale-95"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Sign in required</h3>
          <button onClick={handleCloseAnimated} className="text-gray-500">
            ✕
          </button>
        </div>

        <div className="text-sm text-gray-700 mb-4">
          You need to be signed in to use this feature. Signing in lets you save
          your work, access your cards and contacts, and more.
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={handleCloseAnimated}
            className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // navigate to the sign-in page and close modal with animation
              router.push("/sign-in");
              handleCloseAnimated();
            }}
            className="px-4 py-2 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
