"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
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

// Dynamic import for the Pintura editor
const PinturaEditor = dynamic(
  () => import("@pqina/react-pintura").then((mod) => mod.PinturaEditor),
  { ssr: false }
);

interface StickerEditorModalProps {
  imageSrc: string;
  isVisible: boolean;
  onHide: () => void;
  onProcess?: (result: { dest: File }) => void;
}

// Create editor defaults with circular crop for stickers
const createStickerEditorDefaults = () => {
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

    // Show circular mask preview
    cropWillRenderImageSelectionGuides: (
      interaction: string,
      interactionFraction: number
    ) => {
      // Return guides for circular preview
      return [
        {
          // Center crosshair
          id: "center-h",
          x: 0.5,
          y: 0.5,
          width: 0.1,
          height: 0.002,
          opacity: 0.5,
        },
        {
          id: "center-v",
          x: 0.5,
          y: 0.5,
          width: 0.002,
          height: 0.1,
          opacity: 0.5,
        },
      ];
    },

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
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const editorRef = useRef<any>(null);

  // Update image source when prop changes
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
  }, [imageSrc]);

  if (!isVisible) return null;

  const editorDefaults = createStickerEditorDefaults();

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onHide}
        className="absolute top-4 right-4 z-60 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        aria-label="Close editor"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Circular mask indicator */}
      <div className="absolute top-4 left-4 z-60 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-white"></span>
          Circular sticker (3" diameter)
        </span>
      </div>

      {/* Editor container */}
      <div
        className="w-full h-full max-w-4xl max-h-[90vh] mx-4"
        style={{
          // Add circular crop overlay CSS
          ["--pintura-color-primary" as any]: "#ec4899", // pink-500
          ["--pintura-color-primary-dark" as any]: "#be185d", // pink-700
        }}
      >
        <PinturaEditor
          ref={editorRef}
          {...editorDefaults}
          src={currentImageSrc}
          onLoad={(res: any) => {
            console.log("Sticker editor loaded:", res);
          }}
          onProcess={(result: { dest: File }) => {
            console.log("Sticker processed:", result);
            onProcess?.(result);
          }}
          onClose={() => {
            onHide();
          }}
        />
      </div>

      {/* Circular mask overlay - visual hint */}
      <style jsx global>{`
        /* Add circular crop mask styling */
        .pintura-editor [data-util="crop"] .pintura-image-selection {
          border-radius: 50% !important;
        }

        .pintura-editor [data-util="crop"] .pintura-image-selection::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
          pointer-events: none;
        }

        /* Pink theme for sticker editor */
        .pintura-editor {
          --color-primary: #ec4899;
          --color-primary-dark: #be185d;
        }
      `}</style>
    </div>
  );
}
