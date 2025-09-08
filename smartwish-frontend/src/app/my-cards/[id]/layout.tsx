'use client';

import { PixshopProvider } from '@/contexts/PixshopContext';

interface CardLayoutProps {
  children: React.ReactNode;
}

export default function CardLayout({ children }: CardLayoutProps) {
  return (
    <PixshopProvider>
      {children}
    </PixshopProvider>
  );
}