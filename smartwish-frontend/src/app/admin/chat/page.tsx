'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AdminChatSidebar from '@/components/admin/AdminChatSidebar';
import AdminChatWindow from '@/components/admin/AdminChatWindow';
import { useAdminChat } from '@/hooks/useAdminChat';

export default function AdminChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { selectedKioskId, selectKiosk, isConnected } = useAdminChat();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/admin/chat');
    }
  }, [status, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
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
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kiosk Chat</h1>
            <p className="text-sm text-gray-500 mt-1">
              Communicate with kiosk users in real-time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex overflow-hidden">
        <AdminChatSidebar
          selectedKioskId={selectedKioskId}
          onSelectKiosk={selectKiosk}
        />
        <AdminChatWindow kioskId={selectedKioskId} />
      </div>
    </div>
  );
}
