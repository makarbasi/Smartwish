"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { PixshopPluginIntegration } from "./pixshop/PixshopPluginIntegration";
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
const editorDefaults = {
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
};

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
}

export default function PinturaEditorModal({
  imageSrc,
  isVisible,
  onHide,
  onProcess,
}: PinturaEditorModalProps) {
  // Use state to manage the current image source so we can update it dynamically
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);

  // Update currentImageSrc when imageSrc prop changes
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
  }, [imageSrc]);

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

  const handleLoad = (res: unknown) => {
    console.log("📷 Load editor image:", res);

    // Initialize PixshopPlugin Integration
    const pixshopPlugin = new PixshopPluginIntegration({
      currentImageSrc,
      setCurrentImageSrc,
      onProcess: handleProcess,
      onHide: handleHide,
    });

    // Initialize the plugin
    pixshopPlugin.initialize(res);

  };

  if (!isVisible) {
    console.log("🎨 Editor not visible, returning null");
    return null;
  }

  console.log("🎨 Editor IS visible, rendering PinturaEditorModal");

  return (
    <PinturaEditorModalComponent
      {...editorDefaults}
      src={currentImageSrc}
      onLoad={handleLoad}
      onHide={handleHide}
      onProcess={handleProcess}
    />
  );
}
