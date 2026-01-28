"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ArrowsUpDownIcon,
  CloudArrowUpIcon,
  PlayIcon,
  CodeBracketIcon,
  PhotoIcon,
  NoSymbolIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import {
  ScreenSaverItem,
  ScreenSaverSettings,
  ScreenSaverType,
  DEFAULT_SCREEN_SAVER_SETTINGS,
} from "@/utils/kioskConfig";
import {
  generateScreenSaverId,
  getScreenSaverTypeName,
  validateScreenSaver,
} from "@/utils/screenSaverUtils";

// Types
type Kiosk = {
  id: string;
  kioskId: string;
  name?: string;
  config: {
    screenSavers?: ScreenSaverItem[];
    screenSaverSettings?: ScreenSaverSettings;
    [key: string]: unknown;
  };
};

// Screen Saver Type Icons
function ScreenSaverTypeIcon({ type }: { type: ScreenSaverType }) {
  switch (type) {
    case "video":
      return <PlayIcon className="h-5 w-5" />;
    case "html":
      return <CodeBracketIcon className="h-5 w-5" />;
    case "default":
      return <PhotoIcon className="h-5 w-5" />;
    case "none":
      return <NoSymbolIcon className="h-5 w-5" />;
    default:
      return <PhotoIcon className="h-5 w-5" />;
  }
}

// Screen Saver Form Modal
function ScreenSaverFormModal({
  isOpen,
  onClose,
  onSave,
  screenSaver,
  kioskId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (screenSaver: ScreenSaverItem) => void;
  screenSaver?: ScreenSaverItem;
  kioskId: string;
}) {
  const [formData, setFormData] = useState<Partial<ScreenSaverItem>>({
    type: "default",
    name: "",
    url: "",
    videoUrl: "",
    text: "",
    color: "orange",
    weight: 50,
    duration: 30,
    enabled: true,
    interactive: false,
    interactiveIdleTimeout: 30,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screenSaver) {
      setFormData({
        type: screenSaver.type,
        name: screenSaver.name || "",
        url: screenSaver.url || "",
        videoUrl: screenSaver.videoUrl || "",
        text: screenSaver.text || "",
        color: screenSaver.color || "orange",
        weight: screenSaver.weight,
        duration: screenSaver.duration || 30,
        enabled: screenSaver.enabled !== false,
        interactive: screenSaver.interactive || false,
        interactiveIdleTimeout: screenSaver.interactiveIdleTimeout || 30,
      });
    } else {
      setFormData({
        type: "default",
        name: "",
        url: "",
        videoUrl: "",
        text: "",
        color: "orange",
        weight: 50,
        duration: 30,
        enabled: true,
        interactive: false,
        interactiveIdleTimeout: 30,
      });
    }
    setErrors([]);
  }, [screenSaver, isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress("Uploading...");
    setErrors([]);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("kioskId", kioskId);

      const response = await fetch("/api/admin/screensavers/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setFormData((prev) => ({
        ...prev,
        url: result.url,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
      }));
      setUploadProgress("Upload complete!");
    } catch (error) {
      console.error("Upload error:", error);
      setErrors([(error as Error).message]);
      setUploadProgress("");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = () => {
    const validationErrors = validateScreenSaver(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const newScreenSaver: ScreenSaverItem = {
      id: screenSaver?.id || generateScreenSaverId(),
      type: formData.type as ScreenSaverType,
      name: formData.name || undefined,
      url: formData.url || undefined,
      videoUrl: formData.videoUrl || undefined,
      text: formData.text || undefined,
      color: formData.color || undefined,
      weight: formData.weight || 50,
      duration: formData.duration || 30,
      enabled: formData.enabled !== false,
      interactive: formData.interactive || false,
      interactiveIdleTimeout: formData.interactiveIdleTimeout || 30,
    };

    onSave(newScreenSaver);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <h2 className="text-xl font-semibold mb-4">
            {screenSaver ? "Edit Screen Saver" : "Add Screen Saver"}
          </h2>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Screen saver name"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["video", "html", "default", "none"] as ScreenSaverType[]).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, type, url: type === "default" || type === "none" ? "" : prev.url }))
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${formData.type === type
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                        : "bg-white border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <ScreenSaverTypeIcon type={type} />
                      <span className="text-sm font-medium">
                        {getScreenSaverTypeName(type)}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* URL (for video/html types) */}
            {(formData.type === "video" || formData.type === "html") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.type === "video" ? "Video URL" : "HTML Page URL"}
                </label>
                <div className="space-y-2">
                  <input
                    type="url"
                    value={formData.url || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, url: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={
                      formData.type === "video"
                        ? "https://example.com/video.mp4"
                        : "https://example.com/screensaver.html or /kiosk/advertisement/videoAd"
                    }
                  />
                  {formData.type === "html" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">or</span>
                      <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
                        <CloudArrowUpIcon className="h-5 w-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {isUploading ? uploadProgress : "Upload HTML file"}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".html,text/html"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Video Advertisement Fields (for HTML type) */}
            {formData.type === "html" && (
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    💡 Video Advertisement Support
                  </p>
                  <p className="text-xs text-blue-700">
                    If using <code className="bg-blue-100 px-1 rounded">/kiosk/advertisement/videoAd</code>,
                    you can specify the video URL and promotional text below. These will be passed as query parameters.
                  </p>
                </div>

                {/* Video URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://example.com/promo-video.mp4"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Video to display full-screen (for video advertisement pages)
                  </p>
                </div>

                {/* Promotional Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Promotional Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.text || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, text: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Buy your Ice cream with a gift card and save 5%"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Text to display in the promotional banner overlay
                  </p>
                </div>

                {/* Ribbon Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ribbon Color
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: 'orange', label: 'Orange', gradient: 'from-amber-400 via-amber-500 to-orange-500' },
                      { name: 'blue', label: 'Blue', gradient: 'from-blue-400 via-blue-500 to-blue-600' },
                      { name: 'green', label: 'Green', gradient: 'from-green-400 via-green-500 to-green-600' },
                      { name: 'red', label: 'Red', gradient: 'from-red-400 via-red-500 to-red-600' },
                      { name: 'purple', label: 'Purple', gradient: 'from-purple-400 via-purple-500 to-purple-600' },
                      { name: 'pink', label: 'Pink', gradient: 'from-pink-400 via-pink-500 to-pink-600' },
                    ].map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, color: color.name }))
                        }
                        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${formData.color === color.name
                            ? "border-indigo-500 ring-2 ring-indigo-200"
                            : "border-gray-300 hover:border-gray-400"
                          }`}
                      >
                        <div className={`w-6 h-6 rounded bg-gradient-to-r ${color.gradient}`} />
                        <span className="text-sm font-medium">{color.label}</span>
                        {formData.color === color.name && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Choose the color theme for the promotional banner
                  </p>
                </div>
              </div>
            )}

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight (1-100)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={formData.weight || 50}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      weight: parseInt(e.target.value),
                    }))
                  }
                  className="flex-1"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.weight || 50}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      weight: parseInt(e.target.value) || 50,
                    }))
                  }
                  className="w-16 border rounded-lg px-2 py-1 text-center"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Higher weight = shown more frequently
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={formData.duration || 30}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    duration: parseInt(e.target.value) || 30,
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                How long to show before rotating to next screen saver
              </p>
            </div>

            {/* Enabled */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled !== false}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                Enabled
              </label>
            </div>

            {/* Interactive Mode (only for HTML type) */}
            {formData.type === "html" && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="interactive"
                    checked={formData.interactive === true}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, interactive: e.target.checked }))
                    }
                    className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <label htmlFor="interactive" className="text-sm font-medium text-gray-700">
                      Interactive Mode
                    </label>
                    <p className="text-xs text-gray-500">
                      Allows users to interact with the content (clicking won&apos;t dismiss)
                    </p>
                  </div>
                </div>

                {/* Idle Timeout (only shown when interactive is enabled) */}
                {formData.interactive && (
                  <div className="ml-7">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Idle Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={formData.interactiveIdleTimeout || 30}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          interactiveIdleTimeout: parseInt(e.target.value) || 30,
                        }))
                      }
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How long after user stops interacting before rotating to next screen saver
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {screenSaver ? "Save Changes" : "Add Screen Saver"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview Modal
function PreviewModal({
  isOpen,
  onClose,
  screenSaver,
}: {
  isOpen: boolean;
  onClose: () => void;
  screenSaver: ScreenSaverItem | null;
}) {
  if (!isOpen || !screenSaver) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
      >
        <span className="sr-only">Close</span>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="absolute bottom-4 left-4 z-10 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg text-white text-sm">
        {screenSaver.name || getScreenSaverTypeName(screenSaver.type)} - Tap anywhere or press ESC to close
      </div>

      {screenSaver.type === "video" && screenSaver.url && (
        <video
          src={screenSaver.url}
          className="w-full h-full object-contain"
          autoPlay
          loop
          muted
          playsInline
        />
      )}

      {screenSaver.type === "html" && screenSaver.url && (
        <iframe
          src={screenSaver.url}
          className="w-full h-full"
          style={{ border: "none" }}
        />
      )}

      {screenSaver.type === "default" && (
        <div className="w-full h-full flex items-center justify-center text-white">
          <div className="text-center">
            <PhotoIcon className="h-24 w-24 mx-auto mb-4 opacity-50" />
            <p className="text-xl">Default Card Showcase</p>
            <p className="text-sm opacity-70 mt-2">
              This is the built-in screen saver showing card templates
            </p>
          </div>
        </div>
      )}

      {screenSaver.type === "none" && (
        <div className="w-full h-full flex items-center justify-center text-white">
          <div className="text-center">
            <NoSymbolIcon className="h-24 w-24 mx-auto mb-4 opacity-50" />
            <p className="text-xl">No Screen Saver</p>
            <p className="text-sm opacity-70 mt-2">
              The home page will be shown instead
            </p>
          </div>
        </div>
      )}

      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        tabIndex={0}
      />
    </div>
  );
}

// Main Page Component
export default function ScreenSaversPage() {
  const params = useParams();
  const router = useRouter();
  const kioskId = params.kioskId as string;

  const [kiosk, setKiosk] = useState<Kiosk | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [screenSavers, setScreenSavers] = useState<ScreenSaverItem[]>([]);
  const [settings, setSettings] = useState<ScreenSaverSettings>(
    DEFAULT_SCREEN_SAVER_SETTINGS
  );

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingScreenSaver, setEditingScreenSaver] = useState<ScreenSaverItem | undefined>();
  const [previewScreenSaver, setPreviewScreenSaver] = useState<ScreenSaverItem | null>(null);

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch kiosk data
  const fetchKiosk = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/kiosks/${kioskId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch kiosk");
      }
      const data = await response.json();
      setKiosk(data);
      setScreenSavers(data.config?.screenSavers || []);
      setSettings({
        ...DEFAULT_SCREEN_SAVER_SETTINGS,
        ...data.config?.screenSaverSettings,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [kioskId]);

  useEffect(() => {
    fetchKiosk();
  }, [fetchKiosk]);

  // Save changes
  const saveChanges = async () => {
    if (!kiosk) return;

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/kiosks/${kioskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...kiosk.config,
            screenSavers,
            screenSaverSettings: settings,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save changes");
      }

      setSuccessMessage("Changes saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchKiosk();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle add/edit screen saver
  const handleSaveScreenSaver = (screenSaver: ScreenSaverItem) => {
    setScreenSavers((prev) => {
      const existingIndex = prev.findIndex((ss) => ss.id === screenSaver.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = screenSaver;
        return updated;
      }
      return [...prev, screenSaver];
    });
    setEditingScreenSaver(undefined);
  };

  // Handle delete screen saver
  const handleDeleteScreenSaver = (id: string) => {
    if (!confirm("Are you sure you want to delete this screen saver?")) {
      return;
    }
    setScreenSavers((prev) => prev.filter((ss) => ss.id !== id));
  };

  // Handle drag and drop
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setScreenSavers((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, removed);
      return updated;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Toggle enabled
  const toggleEnabled = (id: string) => {
    setScreenSavers((prev) =>
      prev.map((ss) =>
        ss.id === id ? { ...ss, enabled: !ss.enabled } : ss
      )
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error && !kiosk) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/kiosks/${kioskId}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Screen Savers
              </h1>
              <p className="text-sm text-gray-500">
                {kiosk?.name || kiosk?.kioskId}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Settings Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cog6ToothIcon className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inactivity Timeout (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="600"
                value={settings.inactivityTimeout || 60}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    inactivityTimeout: parseInt(e.target.value) || 60,
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Time before screen saver activates
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rotation Interval (seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={settings.rotationInterval || 30}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rotationInterval: parseInt(e.target.value) || 30,
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default time between rotations
              </p>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableRotation !== false}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableRotation: e.target.checked,
                    }))
                  }
                  className="h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Enable Rotation
                  </span>
                  <p className="text-xs text-gray-500">
                    Cycle through screen savers
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Overlay Text Setting */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overlay Text (Optional)
            </label>
            <input
              type="text"
              value={settings.overlayText || ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  overlayText: e.target.value || undefined,
                }))
              }
              placeholder="Enter text to display over screen savers"
              maxLength={200}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Text will appear as an overlay on top of all screen savers
            </p>
          </div>
        </div>

        {/* Screen Savers List */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Screen Savers ({screenSavers.length})
            </h2>
            <button
              onClick={() => {
                setEditingScreenSaver(undefined);
                setIsFormModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Screen Saver
            </button>
          </div>

          {screenSavers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <PhotoIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No screen savers configured</p>
              <p className="text-sm">
                Add a screen saver to attract customers when the kiosk is idle
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {screenSavers.map((ss, index) => (
                <li
                  key={ss.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${draggedIndex === index ? "opacity-50 bg-indigo-50" : ""
                    } ${ss.enabled === false ? "opacity-60" : ""}`}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing">
                    <ArrowsUpDownIcon className="h-5 w-5 text-gray-400" />
                  </div>

                  {/* Order number */}
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>

                  {/* Type icon */}
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-lg ${ss.type === "video"
                      ? "bg-purple-100 text-purple-600"
                      : ss.type === "html"
                        ? "bg-blue-100 text-blue-600"
                        : ss.type === "none"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-green-100 text-green-600"
                      }`}
                  >
                    <ScreenSaverTypeIcon type={ss.type} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {ss.name || getScreenSaverTypeName(ss.type)}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {ss.url || getScreenSaverTypeName(ss.type)}
                    </p>
                  </div>

                  {/* Weight badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Weight:</span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                      {ss.weight}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Duration:</span>
                    <span className="text-sm">{ss.duration || 30}s</span>
                  </div>

                  {/* Interactive badge */}
                  {ss.interactive && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Interactive
                    </span>
                  )}

                  {/* Enabled toggle */}
                  <button
                    onClick={() => toggleEnabled(ss.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${ss.enabled !== false
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                      }`}
                  >
                    {ss.enabled !== false ? "Enabled" : "Disabled"}
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewScreenSaver(ss)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <EyeIcon className="h-5 w-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingScreenSaver(ss);
                        setIsFormModalOpen(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <PencilSquareIcon className="h-5 w-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteScreenSaver(ss.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5 text-red-500" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveChanges}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Modals */}
      <ScreenSaverFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingScreenSaver(undefined);
        }}
        onSave={handleSaveScreenSaver}
        screenSaver={editingScreenSaver}
        kioskId={kioskId}
      />

      <PreviewModal
        isOpen={!!previewScreenSaver}
        onClose={() => setPreviewScreenSaver(null)}
        screenSaver={previewScreenSaver}
      />
    </div>
  );
}
