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
  // Track the original image source for reverting
  const [originalImageSrc, setOriginalImageSrc] = useState(imageSrc);
  // Track if we have a pending blob that needs user confirmation
  const [pendingBlobSrc, setPendingBlobSrc] = useState<string | null>(null);
  // Track if user is canceling to prevent onProcess from updating the card
  const [isCanceling, setIsCanceling] = useState(false);
  
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
      imageSize: imageSrc?.length || 0,
      hasPendingBlob: !!pendingBlobSrc
    });
    
    // Clean up any stale sessionStorage data when switching pages
    try {
      const pixshopReturn = sessionStorage.getItem('pixshopToPintura');
      if (pixshopReturn) {
        const payload = JSON.parse(pixshopReturn);
        if (payload.pageIndex !== editingPageIndex) {
          console.log('🧹 Cleaning up stale sessionStorage data from different page:', {
            stalePageIndex: payload.pageIndex,
            currentPageIndex: editingPageIndex
          });
          sessionStorage.removeItem('pixshopToPintura');
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking sessionStorage for stale data:', error);
    }
    
    // If we have a pending blob, don't reset the state
    if (pendingBlobSrc) {
      console.log('🔒 Has pending blob - preserving current state and not resetting');
      console.log('🔒 Keeping currentImageSrc as blob, originalImageSrc as:', imageSrc?.substring(0, 50));
      
      // Only update originalImageSrc to the new prop, but keep currentImageSrc as the blob
      setOriginalImageSrc(imageSrc);
      return;
    }
    
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
    
    console.log('🔄 Normal state update - no pending blob');
    setCurrentImageSrc(imageSrc);
    setOriginalImageSrc(imageSrc);
    setPendingBlobSrc(null); // Clear any pending blobs when new image loads
    setIsCanceling(false); // Reset canceling flag
  }, [imageSrc, editingPageIndex, pendingBlobSrc]);

  // Check for returning blob from Pixshop
  useEffect(() => {
    console.log('🔍 PinturaEditorModal useEffect triggered:', {
      isVisible,
      editingPageIndex,
      currentImageSrc: currentImageSrc?.substring(0, 50)
    });
    
    if (!isVisible) {
      console.log('👁️ Not visible, skipping blob check');
      return;
    }
    
    const checkForPixshopReturn = () => {
      try {
        console.log('🔍 Checking sessionStorage for pixshopToPintura...');
        const pixshopReturn = sessionStorage.getItem('pixshopToPintura');
        
        if (pixshopReturn) {
          console.log('📦 Found pixshopToPintura in sessionStorage!');
          const payload = JSON.parse(pixshopReturn);
          console.log('📥 Received blob from Pixshop:', {
            hasEditedImage: !!payload.editedImage,
            dataSize: payload.editedImage?.length || 0,
            pageIndex: payload.pageIndex,
            currentEditingPageIndex: editingPageIndex,
            templateId: payload.templateId,
            pageIndexMatch: payload.pageIndex === editingPageIndex,
            payloadKeys: Object.keys(payload)
          });
          
          // Log the first chunk of the blob data
          if (payload.editedImage) {
            console.log('🔢 Blob data preview:', payload.editedImage.substring(0, 100));
          }
          
          if (payload.editedImage) {
            if (payload.pageIndex === editingPageIndex) {
              console.log('✅ Page index matches! Processing blob...');
              console.log('📥 Adding Pixshop blob to pending stack - waiting for user confirmation in Pintura');
              console.log('📥 Blob state transition: RECEIVED → PENDING_IN_STACK');
              console.log('📥 User must click "Done" in Pintura to confirm or "X" to remove from stack');
              
              // Set the pending blob and current image AFTER Pintura is ready
              setTimeout(() => {
                console.log('⏰ Setting blob after Pintura initialization delay');
                setPendingBlobSrc(payload.editedImage);
                setCurrentImageSrc(payload.editedImage);
                
                console.log('✅ Successfully set pending blob in Pintura');
              }, 300); // Give Pintura time to initialize
              
              // Clean up the sessionStorage
              sessionStorage.removeItem('pixshopToPintura');
              console.log('🧹 Cleaned up sessionStorage');
            } else {
              console.log('❌ Page index mismatch - cleaning up stale data:', {
                payloadPageIndex: payload.pageIndex,
                payloadPageIndexType: typeof payload.pageIndex,
                currentEditingPageIndex: editingPageIndex,
                currentEditingPageIndexType: typeof editingPageIndex
              });
              // Clean up stale data immediately to prevent issues on other pages
              sessionStorage.removeItem('pixshopToPintura');
              console.log('🧹 Removed stale sessionStorage data');
            }
          } else {
            console.log('❌ No editedImage in payload - cleaning up');
            sessionStorage.removeItem('pixshopToPintura');
          }
        } else {
          console.log('🔍 No pixshopToPintura data found in sessionStorage');
          
          // Let's also check what IS in sessionStorage
          const allKeys = Object.keys(sessionStorage);
          console.log('🗂️ All sessionStorage keys:', allKeys);
          allKeys.forEach(key => {
            const value = sessionStorage.getItem(key);
            console.log(`   📁 ${key}:`, value?.substring(0, 100) + ((value?.length || 0) > 100 ? '...' : ''));
          });
        }
      } catch (error) {
        console.error('❌ Failed to process Pixshop return:', error);
      }
    };
    
    // Check immediately when visible
    console.log('🚀 Running immediate blob check...');
    checkForPixshopReturn();
    
    // Also check with delays to handle race conditions
    console.log('⏱️ Setting up delayed blob checks...');
    const timeoutId1 = setTimeout(() => {
      console.log('⏰ Running delayed blob check (100ms)...');
      checkForPixshopReturn();
    }, 100);
    
    const timeoutId2 = setTimeout(() => {
      console.log('⏰ Running delayed blob check (500ms)...');
      checkForPixshopReturn();
    }, 500);
    
    const timeoutId3 = setTimeout(() => {
      console.log('⏰ Running delayed blob check (1000ms)...');
      checkForPixshopReturn();
    }, 1000);
    
    // Cleanup function
    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      
      // Clean up any stale data when component unmounts or page changes
      try {
        const pixshopReturn = sessionStorage.getItem('pixshopToPintura');
        if (pixshopReturn) {
          const payload = JSON.parse(pixshopReturn);
          if (payload.pageIndex !== editingPageIndex) {
            console.log('🧹 Cleanup: Removing stale sessionStorage data on component change');
            sessionStorage.removeItem('pixshopToPintura');
          }
        }
      } catch (error) {
        console.warn('⚠️ Error during cleanup:', error);
      }
      
      // Clean up DOM overlays and modal states when component unmounts or page changes
      try {
        const overlay = document.getElementById('pixshop-warning-overlay');
        if (overlay) {
          console.log('🧹 Cleanup: Removing pixshop warning overlay');
          overlay.remove();
        }
      } catch (error) {
        console.warn('⚠️ Error cleaning up overlay:', error);
      }
    };
  }, [isVisible, editingPageIndex]);

  // Reset warning dialog state when switching pages
  useEffect(() => {
    if (isWarningDialogOpen) {
      console.log('🧹 Resetting warning dialog state for page switch');
      setIsWarningDialogOpen(false);
      
      // Also clean up any overlay that might be stuck
      const overlay = document.getElementById('pixshop-warning-overlay');
      if (overlay) {
        console.log('🧹 Removing stuck overlay during page switch');
        overlay.remove();
      }
    }
  }, [editingPageIndex]);

  // Clean up warning dialog state when modal becomes invisible
  useEffect(() => {
    if (!isVisible && isWarningDialogOpen) {
      console.log('🧹 Cleaning up warning dialog state - modal not visible');
      setIsWarningDialogOpen(false);
      
      // Clean up any overlay
      const overlay = document.getElementById('pixshop-warning-overlay');
      if (overlay) {
        console.log('🧹 Removing overlay - modal not visible');
        overlay.remove();
      }
    }
  }, [isVisible, isWarningDialogOpen]);





  console.log("🎨 PinturaEditorModal rendered:", {
    imageSrc: imageSrc?.substring(0, 50),
    currentImageSrc: currentImageSrc?.substring(0, 50),
    pendingBlobSrc: pendingBlobSrc?.substring(0, 50),
    isVisible,
    hasPendingBlob: !!pendingBlobSrc,
    whatWillBePassedToPintura: currentImageSrc?.substring(0, 50)
  });

  const handleProcess = ({ dest }: { dest: File }) => {
    console.log("✅ Editor process complete:", dest);
    
    // If we're in canceling state, do not update the card
    if (isCanceling) {
      console.log('🚫 Canceling in progress - blocking onProcess to prevent card update');
      return;
    }
    
    // If we have a pending blob, confirm it by clearing the pending state
    if (pendingBlobSrc) {
      console.log('✅ User clicked Done in Pintura - confirming pending blob and adding to stack');
      console.log('✅ Blob state transition: PENDING → CONFIRMED → ADDED_TO_STACK');
      setPendingBlobSrc(null);
      setOriginalImageSrc(currentImageSrc); // Update original to the new confirmed state
      
      // Process the confirmed blob - this adds it to the final version
      if (dest) {
        console.log('📦 Adding confirmed blob to final card version');
        onProcess?.({ dest });
      }
    } else {
      // Normal processing without pending blob
      if (dest) {
        onProcess?.({ dest });
      }
    }
    onHide();
  };

  const handleHide = () => {
    console.log("🚪 Editor hide triggered");
    
    // If we have a pending blob, revert to original image and remove from stack
    if (pendingBlobSrc) {
      console.log('❌ User clicked X in Pintura - discarding pending blob and removing from stack');
      console.log('❌ Blob state transition: PENDING → DISCARDED → REMOVED_FROM_STACK');
      
      // Set canceling flag to prevent any onProcess calls
      setIsCanceling(true);
      
      setCurrentImageSrc(originalImageSrc);
      setPendingBlobSrc(null);
      
      // Also clear any sessionStorage just in case
      sessionStorage.removeItem('pixshopToPintura');
      console.log('🗑️ Removed pending blob from stack - will not be included in final version');
      console.log('🚫 IMPORTANT: onProcess will NOT be called - no card update will happen');
    }
    
    // Always call onHide to close the editor
    onHide();
    
    // Reset canceling flag after editor closes
    setTimeout(() => setIsCanceling(false), 100);
  };

  // Handle opening Pixshop with warning
  const handleOpenPixshop = () => {
    console.log('🎯 Opening Pixshop warning dialog');
    setIsWarningDialogOpen(true);
    
    // Add translucent overlay to Pintura editor via DOM
    setTimeout(() => {
      // Check if overlay already exists to prevent duplicates
      const existingOverlay = document.getElementById('pixshop-warning-overlay');
      if (existingOverlay) {
        console.log('⚠️ Overlay already exists, removing old one');
        existingOverlay.remove();
      }

      const pinturaEditor = document.querySelector('.pintura-editor, .PinturaModal, .PinturaRoot');
      if (pinturaEditor) {
        console.log('✅ Found Pintura editor, adding overlay');
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
        console.log('✅ Overlay added successfully');
      } else {
        console.warn('⚠️ Could not find Pintura editor for overlay');
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
    console.log('❌ User canceled Pixshop warning dialog');
    
    // Remove overlay when canceled
    const overlay = document.getElementById('pixshop-warning-overlay');
    if (overlay) {
      console.log('🧹 Removing overlay on cancel');
      overlay.remove();
    } else {
      console.log('ℹ️ No overlay found to remove on cancel');
    }
    
    setIsWarningDialogOpen(false);
    console.log('✅ Warning dialog closed');
  };

  // Handle image upload
  const handleImageUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      console.log('📁 User selected image file:', {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          console.log('📷 Converting uploaded file to data URL');
          setPendingBlobSrc(dataUrl);
          setCurrentImageSrc(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    
    // Clear the input value so the same file can be selected again
    input.value = '';
  };

  // Add upload button to Pintura's navigation
  const addUploadButton = () => {
    const navGroup = document.querySelector('.PinturaNavGroup:last-child');
    const doneButton = document.querySelector('.PinturaButtonExport');
    
    if (navGroup && doneButton && !document.getElementById('custom-upload-button')) {
      // Create upload input
      const uploadInput = document.createElement('input');
      uploadInput.type = 'file';
      uploadInput.accept = 'image/*';
      uploadInput.style.display = 'none';
      uploadInput.id = 'custom-upload-input';
      uploadInput.addEventListener('change', handleImageUpload);
      
      // Create upload button
      const uploadButton = document.createElement('button');
      uploadButton.type = 'button';
      uploadButton.id = 'custom-upload-button';
      uploadButton.className = 'PinturaButton';
      uploadButton.title = 'Upload Image';
      uploadButton.style.marginRight = '8px';
      
      uploadButton.innerHTML = `
        <span class="PinturaButtonInner">
          <svg class="PinturaButtonIcon" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" stroke-linecap="round" stroke-linejoin="round">
            <g><g fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor" stroke-width=".125em">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,5 17,10"></polyline>
              <line x1="12" y1="5" x2="12" y2="15"></line>
            </g></g>
          </svg>
          <span class="PinturaButtonLabel">Upload</span>
        </span>
      `;
      
      uploadButton.addEventListener('click', () => {
        uploadInput.click();
      });
      
      // Insert before the Done button
      navGroup.insertBefore(uploadInput, doneButton);
      navGroup.insertBefore(uploadButton, doneButton);
      
      console.log('✅ Added upload button to Pintura navigation');
    }
  };

  // Setup retouch button interception and upload button injection
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

    const setupButtons = () => {
      const retouchSuccess = setupRetouchInterception();
      addUploadButton();
      return retouchSuccess;
    };

    // Initial setup attempts
    setTimeout(setupButtons, 100);
    setTimeout(setupButtons, 500);
    setTimeout(setupButtons, 1000);
    
    // Use MutationObserver to watch for dynamically created buttons
    const observerTimeout = setTimeout(() => {
      if (!setupButtons()) {
        observer = new MutationObserver(() => {
          if (setupButtons() && observer) {
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
    }, 1500);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(observerTimeout);
      
      // Clean up custom elements
      const uploadInput = document.getElementById('custom-upload-input');
      const uploadButton = document.getElementById('custom-upload-button');
      if (uploadInput) uploadInput.remove();
      if (uploadButton) uploadButton.remove();
      
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

  console.log("🎯 About to render PinturaEditorModalComponent with src:", {
    src: currentImageSrc?.substring(0, 100),
    isDataUrl: currentImageSrc?.startsWith('data:'),
    isBlobUrl: currentImageSrc?.startsWith('blob:'),
    srcLength: currentImageSrc?.length,
    pendingBlobSrc: pendingBlobSrc?.substring(0, 50),
    hasPendingBlob: !!pendingBlobSrc
  });

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
