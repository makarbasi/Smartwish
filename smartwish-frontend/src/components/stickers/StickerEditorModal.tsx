"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useVirtualKeyboard } from "@/contexts/VirtualKeyboardContext";
import {
  setPlugins,
  plugin_crop,
  plugin_finetune,
  plugin_filter,
  plugin_annotate,
  plugin_sticker,
  plugin_crop_locale_en_gb,
  plugin_finetune_defaults,
  plugin_filter_defaults,
  plugin_finetune_locale_en_gb,
  plugin_filter_locale_en_gb,
  plugin_annotate_locale_en_gb,
  plugin_sticker_locale_en_gb,
  markup_editor_defaults,
  markup_editor_locale_en_gb,
  locale_en_gb,
  createDefaultImageReader,
  createDefaultImageWriter,
  createDefaultShapePreprocessor,
  createMarkupEditorToolStyles,
} from "@pqina/pintura";

// Set up plugins WITH crop for stickers
setPlugins(
  plugin_crop,
  plugin_finetune,
  plugin_filter,
  plugin_annotate,
  plugin_sticker
);

// Dynamic import for the Pintura editor modal (same as greeting cards)
const PinturaEditorModalComponent = dynamic(
  () => import("../DynamicPinturaEditor"),
  { ssr: false }
);

interface StickerEditorModalProps {
  imageSrc: string;
  isVisible: boolean;
  onHide: () => void;
  onProcess?: (result: { dest: File }) => void;
}

// Create editor defaults with circular crop for stickers
const createStickerEditorDefaults = (isKiosk: boolean = false) => {
  const defaultMarkupToolStyles = createMarkupEditorToolStyles({
    text: {
      color: [0, 0, 0],
      fontSize: "10%",
      fontFamily: "Palatino",
    },
  });

  return {
    layoutVerticalUtilsPreference: "top" as const,
    layoutVerticalToolbarPreference: "top" as const,
    layoutVerticalControlGroupsPreference: "top" as const,
    layoutVerticalControlTabsPreference: "top" as const,
    utils: ["crop", "finetune", "filter", "annotate", "sticker"],
    imageReader: createDefaultImageReader(),
    imageWriter: createDefaultImageWriter({
      // Output as square for circular sticker
      targetSize: {
        width: 900,
        height: 900,
      },
    }),
    shapePreprocessor: createDefaultShapePreprocessor(),
    ...plugin_finetune_defaults,
    ...plugin_filter_defaults,
    ...markup_editor_defaults,
    markupEditorToolStyles: defaultMarkupToolStyles,
    annotateToolShapes: defaultMarkupToolStyles,

    // Crop configuration for circular stickers
    imageCropAspectRatio: 1, // 1:1 for circle
    cropEnableButtonFlipHorizontal: true,
    cropEnableButtonFlipVertical: true,
    cropEnableButtonRotateLeft: true,
    cropEnableButtonRotateRight: true,
    cropEnableZoomInput: true,
    cropEnableRotationInput: true,
    cropActiveTransformTool: "zoom" as const,

    // Stickers for decoration
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
        "Fun",
        ["🌈", "🦋", "🌸", "🌺", "🌻", "🍭", "🍬", "🧁", "🎪", "🎨", "🎵", "🎶"],
      ],
    ],

    // Locale
    locale: {
      ...locale_en_gb,
      ...plugin_crop_locale_en_gb,
      ...plugin_finetune_locale_en_gb,
      ...plugin_filter_locale_en_gb,
      ...plugin_annotate_locale_en_gb,
      ...plugin_sticker_locale_en_gb,
      ...markup_editor_locale_en_gb,
      // Custom labels
      labelButtonExport: "Save Sticker",
      cropLabel: "Adjust",
    },
  };
};

export default function StickerEditorModal({
  imageSrc,
  isVisible,
  onHide,
  onProcess,
}: StickerEditorModalProps) {
  const { isKiosk } = useDeviceMode();
  const { showKeyboard, hideKeyboard, isKeyboardVisible, lockKeyboard, unlockKeyboard } = useVirtualKeyboard();
  
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [isAnnotateActive, setIsAnnotateActive] = useState(false);
  
  // Refs for keyboard input handling
  const annotateInputRef = useRef<HTMLInputElement | null>(null);
  const pinturaTextTargetRef = useRef<HTMLElement | null>(null);

  // Update image source when prop changes
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
  }, [imageSrc]);

  // Helper to create/ensure annotate keyboard input exists
  const ensureAnnotateKeyboardInput = () => {
    let input = annotateInputRef.current || document.getElementById('sticker-annotate-keyboard-input') as HTMLInputElement | null;
    if (!input) {
      input = document.createElement('input');
      input.type = 'text';
      input.id = 'sticker-annotate-keyboard-input';
      input.style.cssText =
        'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999998;width:80%;max-width:500px;height:50px;font-size:18px;padding:12px 16px;border:3px solid #ec4899;border-radius:12px;background:white;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
      input.placeholder = 'Type your text here, then tap on sticker to place it...';
      document.body.appendChild(input);
      annotateInputRef.current = input;
      console.log('📝 Created sticker annotate keyboard input');
    }
    return input;
  };

  const hideAnnotateKeyboardUI = () => {
    try {
      unlockKeyboard();
      hideKeyboard();
    } catch {}

    const existingInput = document.getElementById('sticker-annotate-keyboard-input');
    if (existingInput) {
      existingInput.remove();
    }
    annotateInputRef.current = null;
    pinturaTextTargetRef.current = null;
  };

  // Setup annotate button detection (works in all modes, keyboard only in kiosk)
  useEffect(() => {
    if (!isVisible) return;

    let observer: MutationObserver | null = null;
    let annotateButtonFound = false;
    
    // Pre-create input in kiosk mode to avoid race conditions on first click
    if (isKiosk) {
      ensureAnnotateKeyboardInput();
    }

    const handleAnnotateClick = () => {
      console.log('📝 [Sticker] Annotate button clicked');
      setIsAnnotateActive(true);
      
      if (isKiosk) {
        console.log('📝 [Sticker] In kiosk mode, showing keyboard...');
        lockKeyboard();
        const input = ensureAnnotateKeyboardInput();
        if (input) {
          input.style.display = 'block';
          input.focus();
          showKeyboard(input, input.value || '', 'text');
        }
      }
    };

    const handleOtherToolClick = () => {
      console.log('📝 [Sticker] Other tool clicked, exiting annotate mode...');
      setIsAnnotateActive(false);
      if (isKiosk) {
        hideAnnotateKeyboardUI();
      }
    };

    const setupAnnotateDetection = () => {
      const annotateButton = document.querySelector('[title="Annotate"]');
      if (annotateButton && !annotateButton.hasAttribute('data-sticker-annotate-listener')) {
        annotateButton.setAttribute('data-sticker-annotate-listener', 'true');
        annotateButton.addEventListener('click', handleAnnotateClick);
        console.log('✅ [Sticker] Annotate button click listener attached');
        annotateButtonFound = true;
      }

      // Find other tool buttons to exit annotate mode
      const otherToolButtons = document.querySelectorAll('[title="Fine tune"], [title="Filter"], [title="Sticker"], [title="Adjust"]');
      otherToolButtons.forEach((button) => {
        if (!button.hasAttribute('data-sticker-exit-annotate-listener')) {
          button.setAttribute('data-sticker-exit-annotate-listener', 'true');
          button.addEventListener('click', handleOtherToolClick);
        }
      });

      if (annotateButtonFound && observer) {
        observer.disconnect();
        observer = null;
      }
    };

    // Initial attempts
    setTimeout(() => setupAnnotateDetection(), 10);
    setTimeout(() => setupAnnotateDetection(), 100);
    setTimeout(() => setupAnnotateDetection(), 300);

    // Observer as backup
    const observerTimeout = setTimeout(() => {
      if (annotateButtonFound) return;
      
      observer = new MutationObserver(() => {
        if (!annotateButtonFound) {
          setupAnnotateDetection();
        }
      });

      const pinturaRoot = document.querySelector('.PinturaRoot, .PinturaModal, body');
      if (pinturaRoot) {
        observer.observe(pinturaRoot, {
          childList: true,
          subtree: true
        });
      }
    }, 500);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(observerTimeout);

      const annotateButton = document.querySelector('[data-sticker-annotate-listener="true"]');
      if (annotateButton) {
        annotateButton.removeEventListener('click', handleAnnotateClick);
        annotateButton.removeAttribute('data-sticker-annotate-listener');
      }

      const otherButtons = document.querySelectorAll('[data-sticker-exit-annotate-listener="true"]');
      otherButtons.forEach((button) => {
        button.removeEventListener('click', handleOtherToolClick);
        button.removeAttribute('data-sticker-exit-annotate-listener');
      });

      if (isKiosk) {
        hideAnnotateKeyboardUI();
      }
    };
  }, [isVisible, isKiosk, hideKeyboard, showKeyboard, lockKeyboard, unlockKeyboard]);

  // Reliability: ensure keyboard is visible when annotate is active in kiosk mode
  useEffect(() => {
    if (!isVisible || !isKiosk) return;
    if (!isAnnotateActive) return;

    if (!isKeyboardVisible) {
      console.log('📝 [Sticker] Annotate active but keyboard hidden -> forcing showKeyboard()');
      lockKeyboard();
      const input = ensureAnnotateKeyboardInput();
      if (input) {
        input.style.display = 'block';
        input.focus();
        showKeyboard(input, input.value || '', 'text');
      }
    }
  }, [isVisible, isKiosk, isAnnotateActive, isKeyboardVisible, showKeyboard, lockKeyboard]);

  // Handle annotate mode text input detection for virtual keyboard in kiosk mode
  useEffect(() => {
    if (!isVisible || !isKiosk || !isAnnotateActive) {
      return;
    }

    console.log('📝 [Sticker] Setting up Pintura text input detection for annotate mode');

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      const insidePintura =
        !!target.closest('.PinturaModal') || !!target.closest('.PinturaRoot') || !!target.closest('.PinturaEditor');
      if (!insidePintura) return;

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        pinturaTextTargetRef.current = target;
        console.log('📝 [Sticker] Pintura input focused -> binding virtual keyboard');
        showKeyboard(target, target.value || '', 'text');
        lockKeyboard();
        return;
      }

      if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
        pinturaTextTargetRef.current = target;
        console.log('📝 [Sticker] Pintura contenteditable focused -> binding virtual keyboard');
        showKeyboard(target, target.textContent || '', 'text');
        lockKeyboard();
      }
    };

    const observer = new MutationObserver(() => {});

    const pinturaContainer = document.querySelector('.PinturaRoot') || 
                            document.querySelector('.PinturaModal') ||
                            document.querySelector('[class*="Pintura"]');
    
    if (pinturaContainer) {
      observer.observe(pinturaContainer, {
        childList: true,
        subtree: true
      });
    }

    document.addEventListener('focusin', handleFocusIn as any, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', handleFocusIn as any, true);
    };
  }, [isVisible, isKiosk, isAnnotateActive, showKeyboard, lockKeyboard]);

  // Reset annotate state when modal is hidden
  useEffect(() => {
    if (!isVisible) {
      setIsAnnotateActive(false);
    }
  }, [isVisible]);

  // Don't render if not visible
  if (!isVisible) return null;

  const editorDefaults = createStickerEditorDefaults(isKiosk);

  console.log("🎨 StickerEditorModal rendering:", {
    imageSrc: imageSrc?.substring(0, 50),
    isVisible,
    isKiosk,
    isAnnotateActive,
    isKeyboardVisible,
  });

  return (
    <PinturaEditorModalComponent
      {...editorDefaults}
      src={currentImageSrc}
      onLoad={(res: any) => {
        console.log("Sticker editor loaded:", res);
      }}
      onProcess={(result: { dest: File }) => {
        console.log("Sticker processed:", result);
        onProcess?.(result);
      }}
      onHide={() => {
        console.log("Sticker editor hidden");
        // Clean up keyboard state
        if (isKiosk) {
          hideAnnotateKeyboardUI();
        }
        setIsAnnotateActive(false);
        onHide();
      }}
      onSelectutil={(util: string) => {
        console.log('📝 [Sticker] Util selected:', util);
        if (util === 'annotate') {
          console.log('📝 [Sticker] Annotate tool selected');
          setIsAnnotateActive(true);
        } else if (isAnnotateActive) {
          console.log('📝 [Sticker] Leaving annotate mode');
          setIsAnnotateActive(false);
          if (isKiosk) {
            hideKeyboard();
          }
        }
      }}
    />
  );
}
