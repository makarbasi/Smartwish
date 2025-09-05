"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import WarningDialog from "./pixshop/WarningDialog";
import {
  setPlugins,
  plugin_finetune,
  plugin_filter,
  plugin_annotate,
  plugin_sticker,
  plugin_retouch,
  plugin_finetune_defaults,
  plugin_filter_defaults,
  markup_editor_defaults,
  locale_en_gb,
  plugin_finetune_locale_en_gb,
  plugin_filter_locale_en_gb,
  plugin_annotate_locale_en_gb,
  plugin_sticker_locale_en_gb,
  plugin_retouch_locale_en_gb,
  markup_editor_locale_en_gb,
  createDefaultImageReader,
  createDefaultImageWriter,
  createDefaultShapePreprocessor,
  createMarkupEditorShapeStyleControls,
} from "@pqina/pintura";

// Set up the plugins WITHOUT crop and WITHOUT frame
setPlugins(
  plugin_finetune,
  plugin_filter,
  plugin_annotate,
  plugin_sticker,
  plugin_retouch
);

// Create custom editor defaults WITHOUT crop and WITHOUT frame
const createEditorDefaults = (handleOpenPixshop: () => void) => ({
  utils: ["finetune", "filter", "annotate", "sticker", "retouch"], // explicitly exclude 'crop' and 'frame'
  imageReader: createDefaultImageReader(),
  imageWriter: createDefaultImageWriter(),
  shapePreprocessor: createDefaultShapePreprocessor(),
  ...plugin_finetune_defaults,
  ...plugin_filter_defaults,
  ...markup_editor_defaults,
  // Add default stickers
  stickers: [
    [
      "Emoji",
      ["🎉", "🎂", "🎈", "🎁", "❤️", "😊", "😍", "🥳", "✨", "🌟", "⭐", "💫"],
    ],
    [
      "Hearts",
      ["💝", "💖", "💕", "💗", "💘", "💞", "💌", "🧡", "💛", "💚", "💙", "💜"],
    ],
    [
      "Celebration",
      ["🎊", "🎉", "🥳", "🎈", "🎁", "🎂", "🍰", "🧁", "🎪", "🎭", "🎨", "🎵"],
    ],
  ],
  // Add retouch tools configuration
  retouchTools: [],
  retouchShapeControls: createMarkupEditorShapeStyleControls(),

  locale: {
    ...locale_en_gb,
    ...plugin_finetune_locale_en_gb,
    ...plugin_filter_locale_en_gb,
    ...plugin_annotate_locale_en_gb,
    ...plugin_sticker_locale_en_gb,
    ...plugin_retouch_locale_en_gb,
    ...markup_editor_locale_en_gb,
  },
});

// Dynamic import for the editor modal
const PinturaEditorModalComponent = dynamic(
  () => import("./DynamicPinturaEditor"),
  {
    ssr: false,
  }
);

interface PinturaEditorModalProps {
  imageSrc: string;
  isVisible: boolean;
  onHide: () => void;
  onProcess?: (result: { dest: File }) => void;
  editingPageIndex?: number;
}

export default function PinturaEditorModal({
  imageSrc,
  isVisible,
  onHide,
  onProcess,
  editingPageIndex = 0,
}: PinturaEditorModalProps) {
  // Use state to manage the current image source so we can update it dynamically
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  
  // State for warning dialog
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Update currentImageSrc when imageSrc prop changes
  useEffect(() => {
    console.log('🖼️ PinturaEditorModal imageSrc changed:', {
      oldSrc: currentImageSrc?.substring(0, 50),
      newSrc: imageSrc?.substring(0, 50),
      editingPageIndex,
      isDataUrl: imageSrc?.startsWith('data:'),
      imageSize: imageSrc?.length || 0
    });
    
    // If this is a data URL (blob data), log more details
    if (imageSrc?.startsWith('data:')) {
      console.log('📊 Data URL image details:', {
        type: imageSrc.split(';')[0]?.replace('data:', '') || 'unknown',
        encoding: imageSrc.split(';')[1]?.split(',')[0] || 'unknown',
        dataSize: imageSrc.split(',')[1]?.length || 0,
        totalSize: imageSrc.length
      });
      
      console.log('✅ Using data URL directly with Pintura - this should work!');
      
      // Log a few chunks of the base64 data for verification
      const base64Data = imageSrc.split(',')[1] || '';
      if (base64Data) {
        console.log('🔢 Base64 data verification:');
        for (let i = 0; i < Math.min(200, base64Data.length); i += 50) {
          console.log(`   Base64 chunk ${Math.floor(i/50)+1}:`, base64Data.substring(i, i + 50));
        }
      }
    }
    
    setCurrentImageSrc(imageSrc);
  }, [imageSrc, currentImageSrc, editingPageIndex]);

  console.log("🎨 PinturaEditorModal rendered:", {
    imageSrc,
    currentImageSrc,
    isVisible,
  });

  const handleProcess = ({ dest }: { dest: File }) => {
    console.log("✅ Editor process complete:", dest);
    if (dest) {
      onProcess?.({ dest });
    }
    onHide();
  };

  const handleHide = () => {
    console.log("🚪 Editor hide triggered");
    onHide();
  };

  // Handle opening Pixshop with warning
  const handleOpenPixshop = () => {
    setIsWarningDialogOpen(true);
    
    // Add translucent overlay to Pintura editor via DOM
    setTimeout(() => {
      const pinturaEditor = document.querySelector('.pintura-editor, .PinturaModal, .PinturaRoot');
      if (pinturaEditor) {
        const overlay = document.createElement('div');
        overlay.id = 'pixshop-warning-overlay';
        overlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.4);
          z-index: 999999;
          pointer-events: none;
        `;
        pinturaEditor.appendChild(overlay);
      }
    }, 10);
  };

  const handleConfirmPixshop = async () => {
    // Remove overlay before redirecting
    const overlay = document.getElementById('pixshop-warning-overlay');
    if (overlay) {
      overlay.remove();
    }
    setIsWarningDialogOpen(false);
    
    const cardId = params.id as string | undefined;
    const templateId = searchParams?.get('templateId');
    const templateName = searchParams?.get('templateName');

    // Capture current Pintura state before navigating to Pixshop
    console.log('🎯 Capturing current Pintura state for Pixshop...');
    try {
      // Try to get the Pintura editor instance
      const pinturaEditor = document.querySelector('.PinturaEditor') as any;
      if (pinturaEditor?.editor) {
        console.log('📸 Found Pintura editor instance, extracting current state...');
        
        // Get the current edited image from Pintura
        const editedImageBlob = await pinturaEditor.editor.imageWriter();
        console.log('✅ Captured edited image blob:', editedImageBlob);
        
        // Convert blob to data URL for storage
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(editedImageBlob);
        });
        
        console.log('🔄 Converted blob to data URL (size:', dataUrl.length, 'chars)');
        
        // Store the current Pintura state for Pixshop to pick up
        const pinturaState = {
          originalImage: currentImageSrc,
          editedImage: dataUrl,
          editedBlob: URL.createObjectURL(editedImageBlob),
          pageIndex: editingPageIndex,
          templateId,
          templateName,
          fromPintura: true,
          timestamp: Date.now()
        };
        
        sessionStorage.setItem('pinturaToPixshop', JSON.stringify(pinturaState));
        console.log('💾 Stored Pintura state for Pixshop:', {
          hasOriginal: !!pinturaState.originalImage,
          hasEdited: !!pinturaState.editedImage,
          editedSize: pinturaState.editedImage.length,
          blobUrl: pinturaState.editedBlob
        });
      } else {
        console.warn('⚠️ Could not find Pintura editor instance, using current image source');
        // Fallback: use current image source
        const fallbackState = {
          originalImage: currentImageSrc,
          editedImage: currentImageSrc,
          pageIndex: editingPageIndex,
          templateId,
          templateName,
          fromPintura: true,
          fallback: true,
          timestamp: Date.now()
        };
        sessionStorage.setItem('pinturaToPixshop', JSON.stringify(fallbackState));
      }
    } catch (error) {
      console.error('❌ Failed to capture Pintura state:', error);
      // Continue with navigation even if capture fails
    }

    // Navigate to Pixshop with the captured state
    // If template context
    if (!cardId && templateId) {
      try {
        // Stash pages info if available (template-editor stored earlier)
        const stored = sessionStorage.getItem('templateForEditor');
        if (stored) {
          const parsed = JSON.parse(stored);
          const ctx = {
            templateId,
            templateName,
            pages: parsed?.pages || [],
            timestamp: Date.now()
          };
          sessionStorage.setItem('templateEditorForPixshop', JSON.stringify(ctx));
        }
      } catch {}
      const q = new URLSearchParams();
      q.set('templateId', templateId);
      if (templateName) q.set('templateName', templateName);
      q.set('pageIndex', String(editingPageIndex));
      q.set('returnToPintura', '1'); // Flag to indicate return to Pintura
      q.set('fromPintura', '1'); // Flag to indicate we're coming from Pintura with state
      router.push(`/my-cards/template-editor/pixshop?${q.toString()}`);
      return;
    }

    if (cardId) {
      const q = new URLSearchParams();
      q.set('pageIndex', String(editingPageIndex));
      q.set('fromPintura', '1'); // Flag to indicate we're coming from Pintura with state
      router.push(`/my-cards/${cardId}/pixshop?${q.toString()}`);
    } else {
      router.push('/pixshop');
    }
  };

  const handleCancelPixshop = () => {
    // Remove overlay when canceled
    const overlay = document.getElementById('pixshop-warning-overlay');
    if (overlay) {
      overlay.remove();
    }
    setIsWarningDialogOpen(false);
  };

  // Setup retouch button interception with MutationObserver
  useEffect(() => {
    if (!isVisible) return;

    let observer: MutationObserver | null = null;

    const setupRetouchInterception = () => {
      const retouchButton = document.querySelector('[title="Retouch"]');
      if (retouchButton && !retouchButton.getAttribute('data-pixshop-intercepted')) {
        retouchButton.setAttribute('data-pixshop-intercepted', 'true');
        retouchButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.log('🎨 Retouch button clicked - opening Pixshop warning');
          handleOpenPixshop();
        }, { capture: true });
        console.log('🎨 Retouch button interception setup complete');
        return true;
      }
      return false;
    };

    // Initial setup attempts
    setTimeout(setupRetouchInterception, 100);
    setTimeout(setupRetouchInterception, 500);
    
    // Use MutationObserver to watch for dynamically created buttons
    const observerTimeout = setTimeout(() => {
      if (!setupRetouchInterception()) {
        observer = new MutationObserver(() => {
          if (setupRetouchInterception() && observer) {
            observer.disconnect();
            observer = null;
          }
        });
        
        const pinturaRoot = document.querySelector('.PinturaRoot');
        if (pinturaRoot) {
          observer.observe(pinturaRoot, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['title']
          });
        }
      }
    }, 1000);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(observerTimeout);
      // Remove intercepted attribute from buttons
      const interceptedButtons = document.querySelectorAll('[data-pixshop-intercepted="true"]');
      interceptedButtons.forEach(button => {
        button.removeAttribute('data-pixshop-intercepted');
      });
    };
  }, [isVisible, handleOpenPixshop]);

  const handleLoad = (res: unknown) => {
    console.log("📷 Load editor image:", res);
  };

  if (!isVisible) {
    console.log("🎨 Editor not visible, returning null");
    return null;
  }

  console.log("🎨 Editor IS visible, rendering PinturaEditorModal");

  const editorDefaults = createEditorDefaults(handleOpenPixshop);

  return (
    <>
      <PinturaEditorModalComponent
        {...editorDefaults}
        src={currentImageSrc}
        onLoad={handleLoad}
        onHide={handleHide}
        onProcess={handleProcess}
      />
      
      {/* Warning Dialog */}
      <WarningDialog
        isOpen={isWarningDialogOpen}
        onContinue={handleConfirmPixshop}
        onCancel={handleCancelPixshop}
      />
    </>
  );
}
