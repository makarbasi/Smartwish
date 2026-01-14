'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAdminChat, KioskChatInfo } from '@/hooks/useAdminChat';

interface AdminChatSidebarProps {
  selectedKioskId: string | null;
  onSelectKiosk: (kioskId: string) => void;
}

export default function AdminChatSidebar({
  selectedKioskId,
  onSelectKiosk,
}: AdminChatSidebarProps) {
  const { kiosks, isLoading } = useAdminChat();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredKiosks = kiosks.filter((kiosk) =>
    kiosk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kiosk.kioskId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMinutes < 1) {
        return 'just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else if (diffInDays < 7) {
        return `${diffInDays}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return '';
    }
  };

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Kiosk Chats</h2>
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search kiosks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Kiosks List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading kiosks...</div>
        ) : filteredKiosks.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No kiosks found' : 'No active chats'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredKiosks.map((kiosk: KioskChatInfo) => (
              <button
                key={kiosk.kioskId}
                onClick={() => onSelectKiosk(kiosk.kioskId)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedKioskId === kiosk.kioskId ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{kiosk.name}</h3>
                      {kiosk.unreadCount > 0 && (
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                          {kiosk.unreadCount > 9 ? '9+' : kiosk.unreadCount}
                        </span>
                      )}
                    </div>
                    {kiosk.lastMessage && (
                      <>
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {kiosk.lastMessage.senderType === 'kiosk' ? (
                            <span className="font-medium">{kiosk.name}:</span>
                          ) : (
                            <span className="text-gray-500">You:</span>
                          )}{' '}
                          {kiosk.lastMessage.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(kiosk.lastMessage.createdAt)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
