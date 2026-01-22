'use client';

import { useState } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface KioskChatButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

export default function KioskChatButton({ isOpen, onToggle, unreadCount = 0 }: KioskChatButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const glowStyle = isHovered ? {
    boxShadow: `
      0 0 15px rgba(99, 102, 241, 0.7),
      0 0 30px rgba(99, 102, 241, 0.5),
      0 0 45px rgba(99, 102, 241, 0.3)
    `
  } : {
    boxShadow: `
      0 0 10px rgba(99, 102, 241, 0.5),
      0 0 20px rgba(99, 102, 241, 0.3),
      0 0 30px rgba(99, 102, 241, 0.2)
    `
  };

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        fixed bottom-6 right-6 z-[9999]
        h-14 w-14 rounded-full
        bg-indigo-600 hover:bg-indigo-700
        text-white
        transition-all duration-200
        flex items-center justify-center
        ${isOpen ? 'scale-95' : 'scale-100 hover:scale-110'}
        animate-in fade-in slide-in-from-bottom-4 duration-300
      `}
      style={glowStyle}
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
