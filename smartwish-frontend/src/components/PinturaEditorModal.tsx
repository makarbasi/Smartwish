"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams, useSearchParams } from "next/navigation";
// Removed WarningDialog import - now using direct redirect
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
  
  // Note: Removed warning dialog - now doing direct redirect to Pixshop
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Clean up any stale overlays when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      console.log('🧹 Modal became visible - cleaning up any stale overlays');
      
      // Clean up any stale overlays
      const overlays = document.querySelectorAll('#pixshop-warning-overlay');
      if (overlays.length > 0) {
        console.log(`🧹 Removing ${overlays.length} stale overlay(s) on modal open`);
        overlays.forEach(overlay => overlay.remove());
      }
    }
  }, [isVisible]);

  // Define retouch click handler early to avoid reference issues
  const handleRetouchClick = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🎨 Retouch button clicked via DOM - processing and saving image first');
    
    // Use the same flow as tool activation
    await handleRetouchToolActivated();
  };

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
        const overlays = document.querySelectorAll('#pixshop-warning-overlay');
        if (overlays.length > 0) {
          console.log(`🧹 Cleanup: Removing ${overlays.length} pixshop warning overlay(s)`);
          overlays.forEach(overlay => overlay.remove());
        }
      } catch (error) {
        console.warn('⚠️ Error cleaning up overlays:', error);
      }
    };
  }, [isVisible, editingPageIndex]);

  // Clean up on page/visibility changes
  useEffect(() => {
    console.log('🔄 Page/visibility change detected:', { editingPageIndex, isVisible });
    
    // Clean up any overlays that might be stuck
    const overlays = document.querySelectorAll('#pixshop-warning-overlay');
    if (overlays.length > 0) {
      console.log(`🧹 Removing ${overlays.length} stuck overlay(s) during page/visibility change`);
      overlays.forEach(overlay => overlay.remove());
    }
    
    // Reset button interception flags on page change to allow re-setup
    const interceptedButtons = document.querySelectorAll('[data-pixshop-intercepted="true"]');
    if (interceptedButtons.length > 0) {
      console.log(`🔄 Resetting ${interceptedButtons.length} button interception flag(s) for page change`);
      interceptedButtons.forEach(button => {
        button.removeEventListener('click', handleRetouchClick, { capture: true });
        button.removeAttribute('data-pixshop-intercepted');
      });
    }
  }, [editingPageIndex, isVisible, handleRetouchClick]);

  // Clean up overlays when modal becomes invisible
  useEffect(() => {
    if (!isVisible) {
      console.log('🧹 Cleaning up overlays - modal not visible');
      
      // Clean up any overlays
      const overlays = document.querySelectorAll('#pixshop-warning-overlay');
      if (overlays.length > 0) {
        console.log(`🧹 Removing ${overlays.length} overlay(s) - modal not visible`);
        overlays.forEach(overlay => overlay.remove());
      }
    }
  }, [isVisible]);





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
    
    // Check if this is from a retouch-triggered Done button
    const tempHandler = (window as any)?.tempPinturaOnProcess;
    if (tempHandler && typeof tempHandler === 'function') {
      console.log('🎨 Calling temporary retouch handler for processed image');
      tempHandler({ dest });
      // Clean up the temp handler
      (window as any).tempPinturaOnProcess = null;
      return;
    }
    
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
    
    // Clean up editor reference
    if (window) {
      (window as any).pinturaEditorInstance = null;
    }
    
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

  // Removed old popup functions - now using direct redirect

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
          <span class="PinturaButtonLabel hidden md:inline">Upload</span>
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

  // Direct redirect to Pixshop without popup
  const handleDirectRedirectToPixshop = async () => {
    const cardId = params.id as string | undefined;
    const templateId = searchParams?.get('templateId');
    const templateName = searchParams?.get('templateName');

    console.log('🎯 Processing Pintura content and saving entire card before Pixshop...');
    let cardSaved = false;
    
    try {
      // Step 1: Trigger Pintura "Done" to get the processed image
      const pinturaEditor = (window as any)?.pinturaEditorInstance || (document.querySelector('.PinturaEditor') as any)?.editor;
      if (pinturaEditor && cardId) {
        console.log('📸 Found Pintura editor instance, processing image...');
        
        // Get the current edited image from Pintura using exports API
        console.log('🔄 Exporting current Pintura state using exports API...');
        
        let editedImageBlob: Blob;
        
        // Use Pintura v8 proper export method - processImage() 
        if (typeof pinturaEditor.processImage === 'function') {
          console.log('✅ Using Pintura v8 processImage() method');
          try {
            // Call processImage() without parameters to use current editor state
            editedImageBlob = await pinturaEditor.processImage();
            console.log('✅ Pintura v8 processImage() successful');
          } catch (exportError) {
            console.warn('⚠️ processImage() failed, trying with explicit parameters:', exportError);
            try {
              // Try with explicit parameters if no-param version fails
              editedImageBlob = await pinturaEditor.processImage(
                pinturaEditor.imageFile || pinturaEditor.src,
                {
                  imageState: pinturaEditor.imageState
                }
              );
            } catch (paramError) {
              console.warn('⚠️ processImage() with params failed, falling back to imageWriter:', paramError);
              editedImageBlob = await pinturaEditor.imageWriter();
            }
          }
        } else if (typeof pinturaEditor.imageWriter === 'function') {
          console.log('📝 Using legacy imageWriter fallback method');
          editedImageBlob = await pinturaEditor.imageWriter();
        } else {
          throw new Error('No export method available on Pintura editor');
        }
        
        console.log('✅ Successfully exported image from Pintura:', {
          size: editedImageBlob.size,
          type: editedImageBlob.type,
          method: typeof pinturaEditor.processImage === 'function' ? 'processImage' : 'imageWriter'
        });
        
        // Create a File object for the onProcess handler
        const editedFile = new File([editedImageBlob], `pintura-edited-${Date.now()}.jpg`, {
          type: editedImageBlob.type || 'image/jpeg'
        });
        
        console.log('🔄 Applying Pintura changes via onProcess (simulating "Done" click)...');
        
        // Step 2: Apply the changes using the existing onProcess flow (this updates the page images)
        if (onProcess) {
          // This will trigger the onProcess callback which updates the page images
          onProcess({ dest: editedFile });
          console.log('✅ Applied Pintura changes to page images');
          
          // Step 3: After onProcess updates the images, we need to save the entire card
          // We need to wait a moment for the parent component to update the page images
          console.log('⏱️ Waiting for page images to update...');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Note: We can't directly call saveSavedDesignWithImages here because we don't have
          // access to the updated pageImages from the parent component.
          // We need to signal the parent to save after applying Pintura changes.
          
          // Set a flag in sessionStorage to tell the parent component to save and then redirect
          const saveAndRedirectState = {
            shouldSaveAndRedirect: true,
            redirectTo: 'pixshop',
            pageIndex: editingPageIndex,
            templateId,
            templateName,
            fromPintura: true,
            timestamp: Date.now()
          };
          
          sessionStorage.setItem('saveAndRedirectToPixshop', JSON.stringify(saveAndRedirectState));
          console.log('🚩 Set flag for parent to save card and redirect to Pixshop');
          
          cardSaved = true; // Will be handled by parent component
          
        } else {
          console.warn('⚠️ No onProcess handler available - cannot apply changes');
        }
        
      } else {
        console.log('📝 Skipping Pintura processing:', {
          hasEditor: !!pinturaEditor,
          hasCardId: !!cardId,
          context: cardId ? 'saved-design' : 'template'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to process Pintura content:', error);
    }

    // Hide the Pintura modal
    onHide();

    // If we couldn't save (template context or error), navigate directly
    if (!cardSaved) {
      console.log('📝 No card save needed, navigating directly to Pixshop');
      
      // Navigate to Pixshop directly
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
    }
  };

  // Setup retouch button interception and upload button injection
  useEffect(() => {
    if (!isVisible) return;

    let observer: MutationObserver | null = null;

    const setupRetouchInterception = () => {
      const retouchButtons = document.querySelectorAll('[title="Retouch"]');
      console.log(`🔍 Found ${retouchButtons.length} retouch button(s) in DOM`);
      let setupComplete = false;
      
      retouchButtons.forEach((retouchButton, index) => {
        const isAlreadyIntercepted = retouchButton.getAttribute('data-pixshop-intercepted');
        console.log(`🎨 Retouch button ${index + 1}:`, {
          element: retouchButton,
          alreadyIntercepted: isAlreadyIntercepted,
          title: retouchButton.getAttribute('title')
        });
        
        if (!isAlreadyIntercepted) {
          retouchButton.setAttribute('data-pixshop-intercepted', 'true');
          retouchButton.addEventListener('click', handleRetouchClick, { capture: true });
          console.log(`✅ Retouch button ${index + 1} interception setup complete`);
          setupComplete = true;
        } else {
          console.log(`⚠️ Retouch button ${index + 1} already intercepted, skipping`);
        }
      });
      
      if (retouchButtons.length === 0) {
        console.log('❌ No retouch buttons found in DOM');
      }
      
      return setupComplete || retouchButtons.length > 0;
    };

    const setupButtons = () => {
      const retouchSuccess = setupRetouchInterception();
      addUploadButton();
      return retouchSuccess;
    };

    // Initial setup attempts with more logging
    console.log('🚀 Starting button setup attempts...');
    setTimeout(() => {
      console.log('⏰ Running button setup (100ms)...');
      setupButtons();
    }, 100);
    setTimeout(() => {
      console.log('⏰ Running button setup (500ms)...');
      setupButtons();
    }, 500);
    setTimeout(() => {
      console.log('⏰ Running button setup (1000ms)...');
      setupButtons();
    }, 1000);
    setTimeout(() => {
      console.log('⏰ Running button setup (2000ms)...');
      setupButtons();
    }, 2000);
    
    // Use MutationObserver to watch for dynamically created buttons
    const observerTimeout = setTimeout(() => {
      console.log('⏰ Setting up MutationObserver...');
      observer = new MutationObserver((mutations) => {
        console.log('🔄 DOM mutation detected, checking for buttons...');
        setupButtons();
      });
      
      const pinturaRoot = document.querySelector('.PinturaRoot, .PinturaModal, body');
      if (pinturaRoot) {
        console.log('✅ Found DOM root for observer:', pinturaRoot);
        observer.observe(pinturaRoot, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['title', 'class']
        });
      } else {
        console.warn('⚠️ Could not find DOM root for observer');
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
      
      // Clean up intercepted buttons and event listeners
      const interceptedButtons = document.querySelectorAll('[data-pixshop-intercepted="true"]');
      interceptedButtons.forEach(button => {
        button.removeEventListener('click', handleRetouchClick, { capture: true });
        button.removeAttribute('data-pixshop-intercepted');
      });
    };
  }, [isVisible, handleRetouchClick]);

  const handleLoad = (res: unknown) => {
    console.log("📷 Load editor image:", res);
    
    // Get the editor instance to attach custom event listeners
    const editorElement = res as any;
    if (editorElement && editorElement.editor) {
      const editor = editorElement.editor;
      console.log("🎯 Pintura editor instance loaded, setting up proper v8 events");
      
      // Store editor reference immediately
      if (window) {
        (window as any).pinturaEditorInstance = editor;
      }
      
      // PRIMARY METHOD: Listen for retouch tool selection using v8 API
      if (typeof editor.on === 'function') {
        editor.on('selectutil', (utilId: string) => {
          console.log(`🔧 Pintura tool selected: ${utilId}`);
          if (utilId === 'retouch') {
            console.log('🎨 Retouch tool activated - auto-saving current state');
            handleRetouchToolActivated();
          }
        });
        
        // Monitor all util changes
        editor.on('update', (imageState: any) => {
          console.log("🔄 Pintura state updated:", {
            hasImageState: !!imageState,
            currentUtil: editor.util,
            stateKeys: imageState ? Object.keys(imageState) : []
          });
        });
        
        console.log("✅ Pintura v8 event listeners attached successfully");
      } else {
        console.warn("⚠️ Editor.on() not available, falling back to DOM interception");
      }
    }
  };
  
  // Handle retouch tool activation with proper save flow
  const handleRetouchToolActivated = async () => {
    try {
      console.log('🔄 Retouch tool activated - triggering Done button first');
      
      // Find and click the Done button to process the image first
      const doneButton = document.querySelector('.PinturaButtonExport') as HTMLButtonElement;
      if (doneButton && !doneButton.disabled) {
        console.log('✅ Found Done button, clicking it to process image');
        
        // Check if the button is clickable
        const isClickable = !doneButton.disabled && doneButton.offsetParent !== null;
        if (isClickable) {
          // Set up a promise to wait for onProcess to be called and capture the result
          let processCompleted = false;
          let processedFile: File | null = null;
          const originalOnProcess = onProcess;
          
          const waitForProcess = new Promise<File | null>((resolve) => {
            // Create a temporary onProcess handler to capture the processed file
            const tempOnProcess = (result: { dest: File }) => {
              console.log('🎯 onProcess callback triggered by Done button');
              processCompleted = true;
              processedFile = result.dest;
              
              // Call the original onProcess handler to update the card
              if (originalOnProcess) {
                originalOnProcess(result);
              }
              
              resolve(processedFile);
            };
            
            // Temporarily store the temp handler
            (window as any).tempPinturaOnProcess = tempOnProcess;
            
            // Fallback timeout in case onProcess is not called
            setTimeout(() => {
              if (!processCompleted) {
                console.log('⏰ Done button processing timeout, continuing anyway');
                resolve(null);
              }
            }, 3000);
          });
          
          doneButton.click();
          
          console.log('⏳ Waiting for Done processing to complete...');
          const processedImage = await waitForProcess;
          
          if (processedImage) {
            console.log('✅ Captured processed image from Done button:', {
              name: processedImage.name,
              size: processedImage.size,
              type: processedImage.type
            });
            
            // Store the processed image for Pixshop to use
            const imageUrl = URL.createObjectURL(processedImage);
            sessionStorage.setItem('retouchProcessedImage', imageUrl);
            sessionStorage.setItem('retouchProcessedImageTimestamp', Date.now().toString());
            
            console.log('📝 Stored processed image for Pixshop:', imageUrl.substring(0, 50));
          }
          
          console.log('🔄 Done button processing completed, now proceeding to save and redirect to Pixshop');
        } else {
          console.warn('⚠️ Done button found but not clickable, proceeding with direct save');
        }
      } else {
        console.warn('⚠️ Done button not found or disabled, proceeding with direct save');
      }
      
      // Wait a bit more to ensure card save completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await handleDirectRedirectToPixshop();
    } catch (error) {
      console.error('❌ Failed to handle retouch activation:', error);
    }
  };

  if (!isVisible) {
    console.log("🎨 Editor not visible, returning null");
    return null;
  }

  console.log("🎨 Editor IS visible, rendering PinturaEditorModal");

  const editorDefaults = createEditorDefaults(() => {}); // No longer needed

  console.log("🎯 About to render PinturaEditorModalComponent with src:", {
    src: currentImageSrc?.substring(0, 100),
    isDataUrl: currentImageSrc?.startsWith('data:'),
    isBlobUrl: currentImageSrc?.startsWith('blob:'),
    srcLength: currentImageSrc?.length,
    pendingBlobSrc: pendingBlobSrc?.substring(0, 50),
    hasPendingBlob: !!pendingBlobSrc
  });

  return (
    <PinturaEditorModalComponent
      {...editorDefaults}
      src={currentImageSrc}
      onLoad={handleLoad}
      onHide={handleHide}
      onProcess={handleProcess}
      // Pintura v8 event handlers for retouch detection
      onSelectUtil={(utilId: string) => {
        console.log(`🔧 Pintura onSelectUtil: ${utilId}`);
        if (utilId === 'retouch') {
          console.log('🎨 Retouch selected via onSelectUtil prop');
          handleRetouchToolActivated();
        }
      }}
      onReady={() => {
        console.log('🎯 Pintura editor ready for interaction');
      }}
      onUpdate={(imageState: any) => {
        console.log('🔄 Pintura onUpdate:', {
          hasState: !!imageState,
          stateType: typeof imageState
        });
      }}
    />
  );
}
