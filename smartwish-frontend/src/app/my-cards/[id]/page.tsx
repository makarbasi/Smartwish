"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import Image from "next/image";
import HTMLFlipBook from "react-pageflip";
import PinturaEditorModal from "@/components/PinturaEditorModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import useSWR from "swr";
import { saveSavedDesignWithImages } from "@/utils/savedDesignUtils";
import { useSession } from "next-auth/react";

type SavedDesign = {
  id: string;
  title: string;
  imageUrls?: string[];
  thumbnail?: string;
  createdAt: string | Date;
  categoryId?: string;
  categoryName?: string;
  category_id?: string;
  category_name?: string;
  // New individual image fields
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  designData?: {
    templateKey: string;
    pages: Array<{
      header: string;
      image: string;
      text: string;
      footer: string;
    }>;
    editedPages: Record<number, string>;
  };
};

type ApiResponse = {
  success: boolean;
  data: SavedDesign[];
  count?: number;
};

type CardData = {
  id: string;
  name: string;
  createdAt: string;
  pages: string[];
  categoryId?: string;
  categoryName?: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  slug: string;
};

type CategoriesResponse = {
  success: boolean;
  data: Category[];
  count: number;
};

const fetcher = (url: string) =>
  fetch(url, {
    credentials: "include", // Include cookies for authentication
  }).then((res) => res.json());

// Transform saved design to card data
const transformSavedDesignToCard = (savedDesign: SavedDesign): CardData => {
  // First priority: Use individual image columns (image1, image2, image3, image4)
  let pages: string[] = [];

  console.log("🔄 Transforming saved design:", savedDesign.id);
  console.log("📸 Individual image fields:", {
    image1: savedDesign.image1 ? "Present" : "Empty",
    image2: savedDesign.image2 ? "Present" : "Empty",
    image3: savedDesign.image3 ? "Present" : "Empty",
    image4: savedDesign.image4 ? "Present" : "Empty",
  });

  if (
    savedDesign.image1 ||
    savedDesign.image2 ||
    savedDesign.image3 ||
    savedDesign.image4
  ) {
    pages = [
      savedDesign.image1 || "",
      savedDesign.image2 || "",
      savedDesign.image3 || "",
      savedDesign.image4 || "",
    ];
    console.log(
      "✅ Using individual image columns, pages count:",
      pages.filter(Boolean).length
    );
  }

  // Second priority: Extract images from designData.pages (for backward compatibility)
  if (
    pages.filter(Boolean).length === 0 &&
    savedDesign.designData?.pages &&
    savedDesign.designData.pages.length > 0
  ) {
    // Extract image URLs from each page
    pages = savedDesign.designData.pages.map((page) => page.image || "");
    console.log(
      "⚡ Using designData.pages, pages count:",
      pages.filter(Boolean).length
    );
  }

  // Third priority: Use imageUrls array if no pages found
  if (
    pages.filter(Boolean).length === 0 &&
    savedDesign.imageUrls &&
    savedDesign.imageUrls.length > 0
  ) {
    pages = [...savedDesign.imageUrls];
    while (pages.length < 4) pages.push(""); // Ensure 4 pages
    console.log(
      "📋 Using imageUrls array, pages count:",
      pages.filter(Boolean).length
    );
  }

  // Fourth priority: Use thumbnail as fallback for all pages
  if (pages.filter(Boolean).length === 0 && savedDesign.thumbnail) {
    pages = [
      savedDesign.thumbnail,
      savedDesign.thumbnail,
      savedDesign.thumbnail,
      savedDesign.thumbnail,
    ];
    console.log("🖼️ Using thumbnail fallback");
  }

  // Ensure we have at least 4 pages for the card view
  while (pages.length < 4) {
    if (pages.length > 0) {
      pages.push(pages[0]); // Duplicate first page if we don't have enough
    } else {
      pages.push(""); // Add empty string as fallback
    }
  }

  return {
    id: savedDesign.id,
    name: savedDesign.title,
    createdAt:
      typeof savedDesign.createdAt === "string"
        ? savedDesign.createdAt
        : savedDesign.createdAt.toISOString(),
    pages: pages.slice(0, 4), // Limit to 4 pages
    // Extract category info from saved design if available
    categoryId:
      (savedDesign as any).category_id || (savedDesign as any).categoryId,
    categoryName:
      (savedDesign as any).category_name || (savedDesign as any).categoryName,
  };
};

export default function CustomizeCardPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const pathname = usePathname();
  const cardId = params?.id as string;
  const [currentPage, setCurrentPage] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);

  // Editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Pintura Editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);

  // Save functionality state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  // Undo/Revert functionality state
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [originalName, setOriginalName] = useState<string>("");

  // Save As functionality state
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [isSavingAs, setIsSavingAs] = useState(false);

  // Swipe functionality state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Fetch all saved designs and find the specific one
  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR<ApiResponse>("/api/saved-designs", fetcher);

  // Fetch categories
  const categoriesResponse = useSWR<CategoriesResponse>(
    "/api/categories",
    fetcher
  );
  const categories = categoriesResponse?.data?.data || [];

  const cardData = useMemo(() => {
    if (!apiResponse?.data || !cardId) return null;
    const savedDesign = apiResponse.data.find((d) => d.id === cardId);
    return savedDesign ? transformSavedDesignToCard(savedDesign) : null;
  }, [apiResponse, cardId]);

  // Initialize page images when card data is available
  useEffect(() => {
    if (cardData) {
      setPageImages([...cardData.pages]);
      setOriginalImages([...cardData.pages]); // Save original for revert
      setOriginalName(cardData.name); // Save original name
      setEditedName(cardData.name);
    }
  }, [cardData]);

  // Define callback functions before early returns
  const handleFlipNext = useCallback(() => {
    // Check if we're on mobile/tablet (flipbook is hidden)
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      // Mobile/Tablet: directly update currentPage state
      if (currentPage < 3) {
        setCurrentPage(currentPage + 1);
      }
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage < 3) {
        flipBookRef.current.pageFlip().flipNext();
      }
    }
  }, [currentPage]);

  const handleFlipPrev = useCallback(() => {
    // Check if we're on mobile/tablet (flipbook is hidden)
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      // Mobile/Tablet: directly update currentPage state
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage > 0) {
        flipBookRef.current.pageFlip().flipPrev();
      }
    }
  }, [currentPage]);

  const goToPage = useCallback((pageIndex: number) => {
    // Check if we're on mobile/tablet (flipbook is hidden)
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      // Mobile/Tablet: directly update currentPage state
      setCurrentPage(pageIndex);
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current) {
        flipBookRef.current.pageFlip().flip(pageIndex);
      }
    }
  }, []);

  const handlePageFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data);
  }, []);

  // Listen for page navigation events from Sidebar
  useEffect(() => {
    const handlePageNavigation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { action, page } = customEvent.detail;

      switch (action) {
        case "prev":
          handleFlipPrev();
          break;
        case "next":
          handleFlipNext();
          break;
        case "goto":
          goToPage(page);
          break;
      }
    };

    window.addEventListener("pageNavigation", handlePageNavigation);
    return () =>
      window.removeEventListener("pageNavigation", handlePageNavigation);
  }, [currentPage, handleFlipNext, handleFlipPrev, goToPage]);

  // Notify Sidebar about current page changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pageChanged", { detail: { currentPage } })
    );
  }, [currentPage]);

  // Keyboard navigation for flipbook
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard events on desktop when flipbook is visible
      if (typeof window !== "undefined" && window.innerWidth >= 1280) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            handleFlipPrev();
            break;
          case "ArrowRight":
            event.preventDefault();
            handleFlipNext();
            break;
          case "Home":
            event.preventDefault();
            goToPage(0);
            break;
          case "End":
            event.preventDefault();
            goToPage(3);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlipNext, handleFlipPrev, goToPage]);

  // Initialize editing states when card loads
  useEffect(() => {
    if (cardData && categories.length > 0) {
      setEditedName(cardData.name);
      console.log("🔍 Card data:", cardData);
      console.log("🔍 Categories:", categories);

      // Find and set the initial category if it exists
      let foundCategory = null;

      if (cardData.categoryId) {
        foundCategory = categories.find(
          (cat) => cat.id === cardData.categoryId
        );
        console.log("🎯 Found category by ID:", foundCategory);
      }

      if (!foundCategory && cardData.categoryName) {
        // Fallback: try to match by name if ID doesn't work
        foundCategory = categories.find(
          (cat) => cat.name === cardData.categoryName
        );
        console.log("🎯 Found category by name:", foundCategory);
      }

      if (foundCategory) {
        setSelectedCategory(foundCategory);
      } else {
        // If no category is found, optionally set the first category as default
        // or leave it as null to show "Select category"
        console.log(
          "⚠️ No category found for card, available categories:",
          categories.map((c) => ({ id: c.id, name: c.name }))
        );
        console.log("💡 Leaving category selection empty for user to choose");
      }
    }
  }, [cardData, categories]);

  // Debug effect to track category changes
  useEffect(() => {
    console.log("🔄 Selected category changed:", selectedCategory);
  }, [selectedCategory]);

  // Swipe handling functions
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPage < 3) {
      handleFlipNext();
    }
    if (isRightSwipe && currentPage > 0) {
      handleFlipPrev();
    }
  };

  // Undo function - restore previous state
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      const newUndoStack = undoStack.slice(0, -1);

      setUndoStack(newUndoStack);
      setPageImages(previousState);
      setHasUnsavedChanges(true);

      console.log("⏪ Undo applied, restored previous state");
    }
  };

  // Revert function - restore to original state
  const handleRevert = () => {
    setShowRevertConfirm(true);
  };

  const confirmRevert = () => {
    setPageImages([...originalImages]);
    if (cardData && originalName) {
      setEditedName(originalName);
    }
    setUndoStack([]);
    setHasUnsavedChanges(false);
    setShowRevertConfirm(false);

    console.log("🔄 Reverted to original state");
  };

  // Save As function - save as new card
  const handleSaveAs = () => {
    if (!cardData) {
      alert("No card data available");
      return;
    }
    setSaveAsName(`${cardData.name} - Copy`);
    setShowSaveAsModal(true);
  };

  // Handle Save As modal submission
  const handleSaveAsSubmit = async () => {
    if (!cardData || !saveAsName.trim()) {
      return;
    }

    if (!session?.user?.id) {
      alert("Please sign in to save cards");
      return;
    }

    setIsSavingAs(true);

    try {
      const result = await saveSavedDesignWithImages(cardData.id, pageImages, {
        action: "duplicate",
        title: saveAsName.trim(),
        userId: session.user.id,
        categoryId: selectedCategory?.id || cardData.categoryId,
        categoryName: selectedCategory?.name || cardData.categoryName,
      });

      if (result.saveResult.success) {
        setSaveMessage(`✅ Saved as "${saveAsName.trim()}"`);
        setShowSaveAsModal(false);
        setSaveAsName("");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        throw new Error(result.saveResult.error || "Save failed");
      }
    } catch (error) {
      console.error("Error saving as new card:", error);
      setSaveMessage(`❌ Failed to save as new card`);
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setIsSavingAs(false);
    }
  };

  // Save functions
  const handleSave = async () => {
    if (!cardData) {
      alert("No card data available");
      return;
    }

    if (!session?.user?.id) {
      alert("Please sign in to save cards");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const finalName = editedName.trim() || cardData.name;
      console.log("💾 Saving card:", finalName);
      console.log("📂 Category:", selectedCategory?.name || "None");
      console.log("📸 Current page images:", pageImages);
      console.log("🖼️ Cover image (first):", pageImages[0]);
      const userId = session.user.id;
      console.log("🆔 Using user ID:", userId);

      const result = await saveSavedDesignWithImages(cardData.id, pageImages, {
        action: "update",
        title: finalName,
        userId,
        designId: `updated_${cardData.id}_${Date.now()}`,
        categoryId: selectedCategory?.id,
        categoryName: selectedCategory?.name,
      });

      console.log("✅ Save result:", result);
      setSaveMessage("Card saved successfully!");
      setHasUnsavedChanges(false); // Clear unsaved changes flag

      // Update local card data
      if (cardData) {
        cardData.name = finalName;
        cardData.categoryId = selectedCategory?.id;
        cardData.categoryName = selectedCategory?.name;
      }

      // Log the save result for verification
      if (result.saveResult) {
        console.log("💾 Save result:", result.saveResult);
      }

      // Show success message for a few seconds
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("❌ Save failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setSaveMessage(`Failed to save card: ${errorMessage}`);

      // Show error message for a few seconds
      setTimeout(() => setSaveMessage(""), 8000);
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-600 mb-6">
            Please sign in to view your cards.
          </p>
          <Link
            href={`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading card...</p>
        </div>
      </div>
    );
  }

  if (error || !cardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Card Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The card you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/my-cards"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>
    );
  }

  // Function to handle editing a specific page
  const handleEditPage = async (pageIndex: number) => {
    console.log("🎨 Opening Pintura editor for page:", pageIndex);

    if (!cardData || pageIndex >= cardData.pages.length) {
      console.error("❌ Invalid page index or no card data");
      return;
    }

    try {
      // Convert image to blob URL for Pintura compatibility if needed
      const imageUrl = pageImages[pageIndex] || cardData.pages[pageIndex];
      const blobImageUrl = await convertImageToBlob(imageUrl);

      // Update the page images with blob URL if needed
      if (imageUrl !== blobImageUrl) {
        const updatedImages = [...pageImages];
        updatedImages[pageIndex] = blobImageUrl;
        setPageImages(updatedImages);
      }

      setEditingPageIndex(pageIndex);
      setEditorVisible(true);
    } catch (error) {
      console.error("❌ Failed to open editor:", error);
      alert("Failed to load image for editing. Please try again.");
    }
  };

  // Convert external image URL to blob URL for Pintura
  const convertImageToBlob = async (imageUrl: string): Promise<string> => {
    try {
      console.log(
        "🔄 Converting image to blob URL for Pintura compatibility:",
        imageUrl
      );

      // Check if it's already a blob URL
      if (imageUrl.startsWith("blob:")) {
        console.log(
          "✅ Image is already a blob URL, returning as-is:",
          imageUrl
        );
        return imageUrl;
      }

      console.log("🌐 Fetching image...");
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
      }

      console.log("📦 Converting response to blob...");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      console.log("✅ Successfully created blob URL:", blobUrl);
      return blobUrl;
    } catch (error) {
      console.error("❌ Failed to convert image to blob:", error);
      console.log("🔄 Falling back to original URL:", imageUrl);
      return imageUrl;
    }
  };

  // Handle editor process result
  const handleEditorProcess = ({ dest }: { dest: File }) => {
    console.log("✅ Editor process complete:", dest);

    if (editingPageIndex !== null && dest) {
      // Save current state to undo stack before making changes
      setUndoStack((prev) => [...prev, [...pageImages]]);

      // Create blob URL from the edited image
      const blobUrl = URL.createObjectURL(dest);

      // Update the page images
      const updatedImages = [...pageImages];
      updatedImages[editingPageIndex] = blobUrl;
      setPageImages(updatedImages);
      setHasUnsavedChanges(true); // Mark as having unsaved changes when image is edited

      console.log(
        "📸 Updated page image at index:",
        editingPageIndex,
        "with:",
        blobUrl
      );
    }
  };

  // Handle name editing
  const handleStartEditingName = () => {
    setEditedName(cardData?.name || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (cardData && editedName.trim() && editedName.trim() !== cardData.name) {
      setHasUnsavedChanges(true);
    }
    setIsEditingName(false);
  };

  const handleCancelNameEdit = () => {
    setEditedName(cardData?.name || "");
    setIsEditingName(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelNameEdit();
    }
  };

  // Handle category selection
  const handleCategoryChange = (category: Category) => {
    setSelectedCategory(category);
    setHasUnsavedChanges(true);
  };

  // Handle editor close
  const handleEditorClose = () => {
    console.log("🚪 Closing editor");
    setEditorVisible(false);
    setEditingPageIndex(null);
  };

  // Chat / Style Assistant removed

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Header */}
          <div className="lg:hidden">
            {/* Top Row - Back and Save */}
            <div className="flex items-center justify-between py-4">
              <Link
                href="/my-cards"
                className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back</span>
              </Link>

              <div className="flex items-center gap-3">
                {/* Save Status Message - Mobile */}
                {saveMessage && (
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      saveMessage.includes("Failed")
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    ✓
                  </div>
                )}
              </div>
            </div>

            {/* Title Row - Mobile */}
            <div className="pb-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    onBlur={handleSaveName}
                    className="text-xl font-bold text-gray-900 bg-transparent border-2 border-indigo-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent flex-1"
                    autoFocus
                    placeholder="Enter card name..."
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-2 text-green-600 hover:text-green-700 bg-green-50 rounded-lg"
                    title="Save name"
                  >
                    <CheckIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleCancelNameEdit}
                    className="p-2 text-gray-500 hover:text-gray-700 bg-gray-50 rounded-lg"
                    title="Cancel"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-gray-900 leading-tight">
                      {editedName || cardData.name}
                    </h1>
                    <button
                      onClick={handleStartEditingName}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      title="Edit name"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {hasUnsavedChanges && (
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full">
                      <div className="w-2 h-2 bg-amber-400 rounded-full" />
                      <span className="text-xs text-amber-700 font-medium">
                        Unsaved
                      </span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Created on {new Date(cardData.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Category Row - Mobile */}
            <div className="pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <Listbox value={selectedCategory} onChange={handleCategoryChange}>
                <div className="relative">
                  <ListboxButton className="relative w-full cursor-pointer rounded-lg bg-gray-50 py-3 pl-3 pr-10 text-left text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 border border-gray-200 hover:bg-gray-100 transition-colors">
                    <span className="block truncate font-medium">
                      {selectedCategory?.name || "Select a category"}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </span>
                  </ListboxButton>

                  <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none">
                    {categories.map((category) => (
                      <ListboxOption
                        key={category.id}
                        className={({ focus }) =>
                          `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                            focus
                              ? "bg-indigo-100 text-indigo-900"
                              : "text-gray-900"
                          }`
                        }
                        value={category}
                      >
                        {({ selected }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? "font-semibold" : "font-normal"
                              }`}
                            >
                              {category.name}
                            </span>
                            {selected ? (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                <CheckIcon
                                  className="h-5 w-5"
                                  aria-hidden="true"
                                />
                              </span>
                            ) : null}
                          </>
                        )}
                      </ListboxOption>
                    ))}
                    {categories.length === 0 && (
                      <div className="relative cursor-default select-none py-3 px-4 text-gray-700">
                        Loading categories...
                      </div>
                    )}
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between h-20">
              {/* Left Section */}
              <div className="flex items-center gap-6 min-w-0 flex-1">
                <Link
                  href="/my-cards"
                  className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span>Back</span>
                </Link>

                <div className="h-6 w-px bg-gray-300 flex-shrink-0" />

                <div className="min-w-0 flex-1">
                  {/* Editable Title - Desktop */}
                  {isEditingName ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onBlur={handleSaveName}
                        className="text-xl font-bold text-gray-900 bg-transparent border-2 border-indigo-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-0 flex-1 max-w-md"
                        autoFocus
                        placeholder="Enter card name..."
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-2 text-green-600 hover:text-green-700 bg-green-50 rounded-lg flex-shrink-0"
                        title="Save name"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleCancelNameEdit}
                        className="p-2 text-gray-500 hover:text-gray-700 bg-gray-50 rounded-lg flex-shrink-0"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-bold text-gray-900">
                        {editedName || cardData.name}
                      </h1>
                      <button
                        onClick={handleStartEditingName}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit name"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      {hasUnsavedChanges && (
                        <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-full">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                          <span className="text-sm text-amber-700 font-medium">
                            Unsaved changes
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Created on{" "}
                    {new Date(cardData.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Center Section - Category */}
              <div className="flex items-center gap-3 px-6">
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Category:
                </span>
                <Listbox
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                >
                  <div className="relative">
                    <ListboxButton className="relative cursor-pointer rounded-lg bg-gray-50 py-2 pl-3 pr-10 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 border border-gray-200 hover:bg-gray-100 transition-colors min-w-[180px]">
                      <span className="block truncate font-medium">
                        {selectedCategory?.name || "Select category"}
                      </span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </span>
                    </ListboxButton>

                    <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full min-w-[220px] overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                      {categories.map((category) => (
                        <ListboxOption
                          key={category.id}
                          className={({ focus }) =>
                            `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                              focus
                                ? "bg-indigo-100 text-indigo-900"
                                : "text-gray-900"
                            }`
                          }
                          value={category}
                        >
                          {({ selected }) => (
                            <>
                              <span
                                className={`block truncate ${
                                  selected ? "font-semibold" : "font-normal"
                                }`}
                              >
                                {category.name}
                              </span>
                              {selected ? (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                  <CheckIcon
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                  />
                                </span>
                              ) : null}
                            </>
                          )}
                        </ListboxOption>
                      ))}
                      {categories.length === 0 && (
                        <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                          Loading categories...
                        </div>
                      )}
                    </ListboxOptions>
                  </div>
                </Listbox>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-4 flex-shrink-0">
                {/* Save Status Message - Desktop */}
                {saveMessage && (
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      saveMessage.includes("Failed")
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {saveMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex relative">
        {/* Floating Toolbar */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 flex items-center gap-1 sm:gap-2 bg-white rounded-full shadow-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 backdrop-blur-sm bg-white/95">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 ${
              hasUnsavedChanges
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Save Changes"
          >
            {isSaving ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-300 border-t-current rounded-full animate-spin" />
            ) : (
              <BookmarkSolidIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          {/* Save As Button */}
          <button
            onClick={handleSaveAs}
            className="p-1.5 sm:p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-all duration-200 touch-manipulation"
            title="Save As New Card"
          >
            <DocumentDuplicateIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 sm:p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
            title="Undo Last Change"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Revert Button */}
          <button
            onClick={handleRevert}
            disabled={!hasUnsavedChanges}
            className="p-1.5 sm:p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
            title="Revert to Original"
          >
            <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Center - Card Editor */}
        <div
          className={`flex-1 flex items-center justify-center min-h-[calc(100vh-200px)] py-4 lg:py-8 transition-all duration-300 px-4`}
        >
          {/* Previous Page Button */}
          <button
            onClick={handleFlipPrev}
            disabled={currentPage === 0}
            className="hidden xl:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mr-4 xl:mr-8 text-gray-700"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>

          {/* Desktop Flipbook Container */}
          <div className="hidden xl:block relative">
            <HTMLFlipBook
              ref={flipBookRef}
              width={500}
              height={772}
              size="fixed"
              startPage={0}
              minWidth={200}
              maxWidth={1000}
              minHeight={200}
              maxHeight={1000}
              style={{}}
              maxShadowOpacity={0.8}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={handlePageFlip}
              className="flipbook-shadow"
              flippingTime={600}
              usePortrait={false}
              startZIndex={10}
              autoSize={false}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={true}
              disableFlipByClick={false}
              drawShadow={true}
            >
              {/* Front Cover - Page 1 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[0] || cardData.pages[0]}
                    alt="Gift Card Cover"
                    width={500}
                    height={772}
                    className="w-full h-full object-cover rounded-lg"
                    priority
                  />
                  {/* Edit icon blocking zone */}
                  <div
                    className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    style={{ pointerEvents: "auto" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleEditPage(0);
                      }}
                      className="p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200"
                    >
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inner Left Page - Page 2 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[1] || cardData.pages[1]}
                    alt="Gift Card Page 2"
                    width={500}
                    height={772}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon blocking zone */}
                  <div
                    className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    style={{ pointerEvents: "auto" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleEditPage(1);
                      }}
                      className="p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200"
                    >
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inner Right Page - Page 3 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[2] || cardData.pages[2]}
                    alt="Gift Card Page 3"
                    width={500}
                    height={772}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon */}
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditPage(2);
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200 z-20"
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Back Cover - Page 4 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={pageImages[3] || cardData.pages[3]}
                    alt="Gift Card Page 4"
                    width={500}
                    height={772}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon */}
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditPage(3);
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200 z-20"
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </HTMLFlipBook>
          </div>

          {/* Desktop Page Indicator */}
          <div className="hidden xl:block absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg">
              Page {currentPage + 1} of 4
            </div>
          </div>

          {/* Mobile/Tablet Single Page View */}
          <div className="xl:hidden relative">
            <div
              className="w-80 mx-auto bg-white rounded-xl shadow-2xl overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-full aspect-[640/989] relative">
                <Image
                  src={pageImages[currentPage] || cardData.pages[currentPage]}
                  alt={`Card Page ${currentPage + 1}`}
                  width={320}
                  height={494}
                  className="w-full h-full object-cover"
                />
                {/* Edit icon - positioned but doesn't block swipes */}
                <div
                  className="absolute top-3 right-3 z-30"
                  style={{ pointerEvents: "auto" }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditPage(currentPage);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditPage(currentPage);
                    }}
                    className="p-2 bg-black/30 backdrop-blur-sm rounded-full shadow-lg hover:bg-black/40 transition-all duration-200"
                  >
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Mobile Page Indicator with Navigation */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="flex items-center gap-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm shadow-lg">
                    <button
                      onClick={handleFlipPrev}
                      disabled={currentPage === 0}
                      className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-3 w-3" />
                    </button>
                    <span>Page {currentPage + 1} of 4</span>
                    <button
                      onClick={handleFlipNext}
                      disabled={currentPage >= 3}
                      className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Next Page Button */}
          <button
            onClick={handleFlipNext}
            disabled={currentPage >= 3}
            className="hidden xl:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ml-4 xl:ml-8 text-gray-700"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Right Sidebar removed */}
      </div>

      {/* Mobile Overlay */}
      {/* Mobile Overlay placeholder (no assistant) */}

      {/* Pintura Editor Modal */}
      {editingPageIndex !== null && (
        <PinturaEditorModal
          imageSrc={
            pageImages[editingPageIndex] || cardData.pages[editingPageIndex]
          }
          isVisible={editorVisible}
          onHide={handleEditorClose}
          onProcess={handleEditorProcess}
        />
      )}

      {/* Revert Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRevertConfirm}
        onClose={() => setShowRevertConfirm(false)}
        onConfirm={confirmRevert}
        title="Revert All Changes?"
        message="Are you sure you want to revert all changes? This will restore the original card state and cannot be undone."
        confirmText="Revert Changes"
        confirmButtonType="warning"
      />

      <style jsx global>{`
        .flipbook-shadow {
          filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
          transition: transform 0.3s ease, filter 0.3s ease;
        }

        .flipbook-shadow:hover {
          transform: scale(1.02);
          filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.4));
        }

        /* Hide flipbook navigation dots */
        .stf__block .stf__wrapper .stf__navigation {
          display: none !important;
        }

        .stf__navigation,
        .stf__navigation .stf__navigation__item,
        .stf__navigation .stf__navigation__button {
          display: none !important;
        }

        .page-hard {
          width: 100%;
          height: 100%;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15),
            0 2px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          transition: box-shadow 0.3s ease;
          cursor: grab;
        }

        .page-hard:active {
          cursor: grabbing;
        }

        .page-content {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          position: relative;
        }

        /* Page corner hint animation */
        .page-hard::before {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 30px;
          height: 30px;
          background: linear-gradient(
            -45deg,
            transparent 0%,
            transparent 48%,
            rgba(0, 0, 0, 0.1) 49%,
            rgba(0, 0, 0, 0.1) 51%,
            transparent 52%,
            transparent 100%
          );
          z-index: 10;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .page-hard:hover::before {
          opacity: 1;
        }
      `}</style>

      {/* Save As Modal */}
      {showSaveAsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-30 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Save As New Card
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Name
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter card name..."
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveAsModal(false);
                    setSaveAsName("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isSavingAs}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsSubmit}
                  disabled={isSavingAs || !saveAsName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingAs ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save As New Card"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
