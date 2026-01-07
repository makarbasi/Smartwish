'use client';

import { PixshopProvider } from '@/contexts/PixshopContext';

interface StickersLayoutProps {
  children: React.ReactNode;
}

export default function StickersLayout({ children }: StickersLayoutProps) {
  return (
    <PixshopProvider>
      {children}
    </PixshopProvider>
  );
}
