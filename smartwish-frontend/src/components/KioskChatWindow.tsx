'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { ChatMessage } from '@/hooks/useKioskChat';
import { useKiosk } from '@/contexts/KioskContext';
import { useKioskChatContext } from '@/contexts/KioskChatContext';
// Simple date formatting without date-fns dependency
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
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  } catch {
    return '';
  }
};

interface KioskChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KioskChatWindow({ isOpen, onClose }: KioskChatWindowProps) {
  const { messages, isLoading, isConnected, error, sendMessage } = useKioskChatContext();
  const { kioskInfo, loading: kioskLoading } = useKiosk();
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when window opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isSending) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      await sendMessage(messageToSend);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[9998] w-full max-w-md h-[600px] max-h-[80vh] bg-white rounded-lg shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-indigo-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
          <h3 className="font-semibold">Chat Support</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-indigo-700 rounded transition-colors"
          aria-label="Close chat"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {kioskLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Initializing...</div>
          </div>
        ) : !kioskInfo?.kioskId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-center">
              <p className="font-medium">Chat unavailable</p>
              <p className="text-sm mt-1">Kiosk not configured</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500 text-sm">{error}</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-center">
              <p className="font-medium">Start a conversation</p>
              <p className="text-sm mt-1">Send a message to get help</p>
            </div>
          </div>
        ) : (
          messages.map((message: ChatMessage) => (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'kiosk' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.sender_type === 'kiosk'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.sender_type === 'kiosk' ? 'text-indigo-100' : 'text-gray-500'
                  }`}
                >
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            maxLength={1000}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim() || isSending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            aria-label="Send message"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">
            {inputMessage.length}/1000 characters
          </p>
          {!isConnected && (
            <p className="text-xs text-amber-500">Connecting...</p>
          )}
        </div>
      </div>
    </div>
  );
}
