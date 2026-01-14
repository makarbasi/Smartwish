'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useKioskChat, ChatMessage } from '@/hooks/useKioskChat';

interface KioskChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  unreadCount: number;
}

const KioskChatContext = createContext<KioskChatContextType | null>(null);

export function KioskChatProvider({ children }: { children: ReactNode }) {
  const chatState = useKioskChat();

  return (
    <KioskChatContext.Provider value={chatState}>
      {children}
    </KioskChatContext.Provider>
  );
}

export function useKioskChatContext() {
  const context = useContext(KioskChatContext);
  if (!context) {
    throw new Error('useKioskChatContext must be used within KioskChatProvider');
  }
  return context;
}
