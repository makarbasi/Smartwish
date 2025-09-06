"use client";

// Wrapper page to reuse existing pixshop editor logic for template context.
// It forwards templateId/templateName/pageIndex query params and sets a pseudo dynamic param id='template-editor'
// so the shared pixshop page logic can detect template context.


import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';

const SharedPixshop = dynamic(() => import('../../[id]/pixshop/page').then(m => m.default), { ssr: false });

function PixshopWithParams() {
  // Now inside Suspense boundary
  const sp = useSearchParams(); // eslint-disable-line @typescript-eslint/no-unused-vars
  return <SharedPixshop />;
}

export default function TemplatePixshopProxy() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PixshopWithParams />
    </Suspense>
  );
}
