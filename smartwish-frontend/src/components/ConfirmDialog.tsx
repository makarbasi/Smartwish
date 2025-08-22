"use client";

import React from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonType?: "danger" | "warning" | "primary";
  isProcessing?: boolean;
  processingText?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel", 
  confirmButtonType = "danger",
  isProcessing = false,
  processingText = "Processing...",
}: ConfirmDialogProps) {
  const getConfirmButtonStyles = () => {
    switch (confirmButtonType) {
      case "danger":
        return "bg-red-600 hover:bg-red-500 focus-visible:outline-red-600";
      case "warning":
        return "bg-yellow-600 hover:bg-yellow-500 focus-visible:outline-yellow-600";
      case "primary":
        return "bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600";
      default:
        return "bg-red-600 hover:bg-red-500 focus-visible:outline-red-600";
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 transition-opacity"
        aria-hidden="true"
      />

      {/* Full-screen container to center the panel */}
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-md space-y-4 rounded-xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon
                className="h-6 w-6 text-yellow-600"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1">
              <DialogTitle
                as="h3"
                className="text-lg font-semibold leading-6 text-gray-900"
              >
                {title}
              </DialogTitle>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {message}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className={`inline-flex justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonStyles()}`}
            >
              {isProcessing ? (
                <div className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {processingText}
                </div>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}