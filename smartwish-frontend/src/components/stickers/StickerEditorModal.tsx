"use client";

import React, { useState, useEffect } from "react";
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
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);

  // Update image source when prop changes
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
  }, [imageSrc]);

  // Don't render if not visible
  if (!isVisible) return null;

  const editorDefaults = createStickerEditorDefaults(isKiosk);

  console.log("🎨 StickerEditorModal rendering with:", {
    imageSrc: imageSrc?.substring(0, 50),
    isVisible,
    isKiosk,
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
        onHide();
      }}
    />
  );
}
