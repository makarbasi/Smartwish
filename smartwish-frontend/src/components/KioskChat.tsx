'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useDeviceMode } from '@/contexts/DeviceModeContext';
import { useKiosk } from '@/contexts/KioskContext';
import { KioskChatProvider, useKioskChatContext } from '@/contexts/KioskChatContext';
import KioskChatButton from './KioskChatButton';
import KioskChatWindow from './KioskChatWindow';

function KioskChatInner() {
  const pathname = usePathname();
  const { isKiosk } = useDeviceMode();
  const { kioskInfo } = useKiosk();
  const kioskId = kioskInfo?.kioskId || null;
  const [isOpen, setIsOpen] = useState(false);
  const { clearHistory, unreadCount } = useKioskChatContext();

  // Determine if chat should be visible
  const shouldShowChat =
    isKiosk &&
    kioskId &&
    (pathname === '/kiosk/home' ||
      pathname.startsWith('/kiosk/') ||
      pathname === '/templates' ||
      pathname === '/stickers' ||
      pathname === '/my-cards');

  // Handle idle timeout - close chat and clear history
  useEffect(() => {
    const handleTimeout = () => {
      if (isOpen) {
        setIsOpen(false);
      }
      clearHistory();
    };

    // Listen for custom event from useKioskInactivity
    window.addEventListener('kiosk-timeout', handleTimeout);
    return () => {
      window.removeEventListener('kiosk-timeout', handleTimeout);
    };
  }, [isOpen, clearHistory]);

  if (!shouldShowChat) {
    return null;
  }

  return (
    <>
      <KioskChatButton isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} unreadCount={unreadCount} />
      <KioskChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default function KioskChat() {
  return (
    <KioskChatProvider>
      <KioskChatInner />
    </KioskChatProvider>
  );
}
