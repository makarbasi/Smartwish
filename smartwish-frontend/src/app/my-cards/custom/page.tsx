'use client';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function CustomPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-6 min-w-0 flex-1">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back</span>
              </button>
              <div className="h-6 w-px bg-gray-300 flex-shrink-0"></div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900">Custom Page</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Custom Page</h2>
          <p className="text-gray-600">This is a custom page with dummy content.</p>
        </div>
      </div>
    </div>
  );
}
