'use client';

import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface KioskChatButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

export default function KioskChatButton({ isOpen, onToggle, unreadCount = 0 }: KioskChatButtonProps) {

  return (
    <button
      onClick={onToggle}
      className={`
        fixed bottom-6 right-6 z-[9999]
        h-14 w-14 rounded-full
        bg-indigo-600 hover:bg-indigo-700
        text-white shadow-lg hover:shadow-xl
        transition-all duration-200
        flex items-center justify-center
        ${isOpen ? 'scale-95' : 'scale-100 hover:scale-110'}
        animate-in fade-in slide-in-from-bottom-4 duration-300
        shadow-indigo-500/50 hover:shadow-indigo-500/70
        ring-2 ring-indigo-400/30 hover:ring-indigo-400/50
      `}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <XMarkIcon className="h-6 w-6" />
      ) : (
        <>
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}
