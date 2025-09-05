"use client";

// Wrapper page to reuse existing pixshop editor logic for template context.
// It forwards templateId/templateName/pageIndex query params and sets a pseudo dynamic param id='template-editor'
// so the shared pixshop page logic can detect template context.

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import React from 'react';

// Import the shared Pixshop component from the dynamic [id]/pixshop path
// We can't directly import a route segment's default export reliably if it has route-only assumptions,
// so optionally we could refactor into a shared component. For now we lazy load to avoid SSR issues.
const SharedPixshop = dynamic(() => import('../../[id]/pixshop/page').then(m => m.default), { ssr: false });

export default function TemplatePixshopProxy() {
  // Force render so search params are available (ensures hydration before load)
  const sp = useSearchParams(); // eslint-disable-line @typescript-eslint/no-unused-vars
  return <SharedPixshop />;
}
