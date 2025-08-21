"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
  closable?: boolean;
};

export default function AuthModal({ open, onClose, closable = true }: Props) {
  const router = useRouter();

  console.log("🎭 AuthModal render - open:", open);

  // Handle ESC key only if closable
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && closable) {
        onClose();
      }
    };

    if (open && closable) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [open, closable, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${closable ? 'z-[9999]' : 'z-[40]'} flex items-center justify-center p-4`}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop - separate layer */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closable ? onClose : undefined}
      />
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg z-10"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Sign in required</h3>
          {closable && (
            <button onClick={onClose} className="text-gray-500">
              ✕
            </button>
          )}
        </div>

        <div className="text-sm text-gray-700 mb-4">
          You need to be signed in to use this feature. Signing in lets you save
          your work, access your cards and contacts, and more.
        </div>

        <div className="flex justify-end gap-2">
          {closable && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => {
              router.push("/sign-in");
              onClose();
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
