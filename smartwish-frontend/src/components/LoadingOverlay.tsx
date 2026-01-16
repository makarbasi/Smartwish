import React from 'react';

interface LoadingOverlayProps {
    message?: string;
    submessage?: string;
}

export default function LoadingOverlay({ message = 'Loading...', submessage }: LoadingOverlayProps) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-4 max-w-md mx-4">
                <svg
                    className="animate-spin h-16 w-16 text-indigo-600"
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
                <p className="text-lg font-semibold text-gray-900 text-center">{message}</p>
                {submessage && <p className="text-sm text-gray-600 text-center">{submessage}</p>}
            </div>
        </div>
    );
}

