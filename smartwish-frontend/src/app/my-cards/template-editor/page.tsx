"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ArchiveBoxIcon } from "@heroicons/react/24/solid";
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
import { useSession } from "next-auth/react";
import {
  saveSavedDesignWithImages,
  ensureSupabaseUrls,
} from "@/utils/savedDesignUtils";
import useSWR from "swr";
import { sessionDataManager } from "@/utils/sessionDataManager";

type TemplateData = {
  id: string;
  name: string;
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

function TemplateEditorContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams?.get("templateId");
  const templateName = searchParams?.get("templateName");

  // Utility function to handle authentication redirects
  const handleAuthError = (fallbackPath: string = '/my-cards') => {
    console.log("🚪 Authentication error detected, redirecting to sign-in");
    window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(fallbackPath)}`;
  };

  const [currentPage, setCurrentPage] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);

  // Template data
  const [templateData, setTemplateData] = useState<TemplateData | null>(null);

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

  // Swipe functionality state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Fetch categories
  const fetcher = async (url: string) => {
    const res = await fetch(url);
    
    // Check for authentication errors
    if (res.status === 401 || res.status === 403) {
      handleAuthError('/my-cards');
      throw new Error('Authentication required');
    }
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    return res.json();
  };
  const { data: categoriesResponse } = useSWR<CategoriesResponse>(
    "/api/categories",
    fetcher
  );
  const categories = useMemo(() => {
    const cats = categoriesResponse?.data || [];
    console.log(
      "📋 Available categories:",
      cats.map((c) => ({ id: c.id, name: c.name }))
    );
    return cats;
  }, [categoriesResponse?.data]);

  // Load template data from session storage or fallback to URL params
  useEffect(() => {
    const loadTemplate = async () => {
      // First try to get from session storage (preferred method)
      const storedTemplate = sessionStorage.getItem("templateForEditor");
      if (storedTemplate) {
        try {
          const parsed = JSON.parse(storedTemplate);
          console.log("✅ Loaded template from session storage:", parsed.name);
          setTemplateData(parsed);
          setPageImages([...parsed.pages]);
          setOriginalImages([...parsed.pages]); // Save original for revert
          setOriginalName(parsed.name); // Save original name
          sessionStorage.removeItem("templateForEditor"); // Clean up
          return;
        } catch (error) {
          console.error("Failed to parse stored template:", error);
        }
      }

      // Fallback: fetch from API if we have templateId
      if (templateId) {
        console.log("⚠️ Fetching template data from API:", templateId);

        try {
          const response = await fetch(`/api/templates/${templateId}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const template: TemplateData = {
                id: templateId,
                name: templateName
                  ? decodeURIComponent(templateName)
                  : result.data.title || "Untitled Template",
                pages: [
                  result.data.image_1,
                  result.data.image_2,
                  result.data.image_3,
                  result.data.image_4,
                ].filter(Boolean),
              };

              console.log(
                "✅ Loaded template from API:",
                template.name,
                "with",
                template.pages.length,
                "pages"
              );
              setTemplateData(template);
              setPageImages([...template.pages]);
              setOriginalImages([...template.pages]); // Save original for revert
              setOriginalName(template.name); // Save original name
              return;
            } else {
              console.error("Invalid API response:", result);
              throw new Error("Invalid template data received");
            }
          } else {
            // Check if it's an authentication error
            if (response.status === 401 || response.status === 403) {
              handleAuthError('/templates');
              return;
            }
            
            console.error("Failed to fetch template, status:", response.status);
            throw new Error(`Failed to fetch template: ${response.status}`);
          }
        } catch (error) {
          console.error("Error fetching template:", error);
          
          // Check if it's an authentication error
          if (error instanceof Error && 
              (error.message.includes("Unauthorized") || 
               error.message.includes("401") || 
               error.message.includes("403"))) {
            handleAuthError('/templates');
            return;
          }
          
          alert(
            "Failed to load template data. Please try again or select a different template."
          );
          router.push("/templates");
          return;
        }
      }

      // No template data available at all
      console.warn("❌ No template data available, redirecting to templates");
      alert(
        "No template data found. Please select a template from the templates page."
      );
      router.push("/templates");
    };

    loadTemplate();
  }, [templateId, templateName, router]);

  // Consume Pixshop return payload (single page edit) if present
  useEffect(() => {
    if (!templateData) return;
    
    // Check if returning from pixshop to reopen Pintura
    const returnToPintura = searchParams?.get('returnToPintura') === '1';
    const pageIndexFromUrl = searchParams?.get('pageIndex');
    
    if (returnToPintura && pageIndexFromUrl !== null) {
      try {
        const pinturaPayload = sessionStorage.getItem('pixshopToPintura');
        if (pinturaPayload) {
          const payload = JSON.parse(pinturaPayload);
          console.log('📥 Received pixshop return payload for Pintura:', {
            hasEditedImage: !!payload.editedImage,
            dataSize: payload.editedImage?.length || 0,
            pageIndex: payload.pageIndex,
            templateId: payload.templateId,
            fileSize: payload.fileSize,
            fileType: payload.fileType,
            dataPrefix: payload.editedImage?.substring(0, 50) || 'none'
          });
          
          // Log binary data chunks for verification
          if (payload.editedImage) {
            const chunkSize = 100;
            console.log('🔢 Received binary data verification:');
            for (let i = 0; i < Math.min(300, payload.editedImage.length); i += chunkSize) {
              console.log(`   Chunk ${Math.floor(i/chunkSize)+1}:`, payload.editedImage.substring(i, i + chunkSize));
            }
          }
          
          if (payload && payload.editedImage && payload.templateId === templateData.id) {
            const idx = Number(payload.pageIndex) || 0;
            if (idx >= 0 && idx < pageImages.length) {
              console.log('🔄 Reopening Pintura with edited image from pixshop');
              console.log('🖼️ Original image URL (first 50 chars):', pageImages[idx]?.substring(0, 50));
              console.log('🖼️ Edited image URL (first 50 chars):', payload.editedImage?.substring(0, 50));
              console.log('🔢 Page index details:', {
                payloadPageIndex: payload.pageIndex,
                parsedIdx: idx,
                currentPageImages: pageImages.length
              });
              
              console.log('🚫 IMPORTANT: Pixshop blob will NOT update main card - only Pintura can do that');
              console.log('🎯 Blob will be passed to Pintura for user confirmation');
              
              // REMOVED: Direct pageImages update - this was the problem!
              // Pixshop should NEVER directly update the card
              // The blob will be handled by PinturaEditorModal's pending system
              
              // Just reopen Pintura - the PinturaEditorModal will handle the pending blob
              setTimeout(() => {
                console.log('⏰ Opening Pintura - blob will be handled by PinturaEditorModal');
                console.log('� Pintura will show blob as pending until user clicks Done');
                setEditingPageIndex(idx);
                setEditorVisible(true);
                
                // Debug: Check if sessionStorage still has the data after opening
                setTimeout(() => {
                  const checkData = sessionStorage.getItem('pixshopToPintura');
                  console.log('📦 Final sessionStorage check after opening Pintura:', {
                    hasData: !!checkData,
                    dataSize: checkData?.length || 0
                  });
                }, 50);
              }, 200);
              
              // DON'T clean up sessionStorage here - let PinturaEditorModal handle it
              // sessionStorage.removeItem('pixshopToPintura'); // REMOVED - PinturaEditorModal will clean up
              
              // Remove the returnToPintura param from URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('returnToPintura');
              newUrl.searchParams.delete('pageIndex');
              window.history.replaceState({}, '', newUrl.toString());
              
              return; // Don't process regular pixshop payload
            }
          }
        }
      } catch (e) {
        console.error('Failed to process Pintura return payload', e);
      }
    }
    
    // Regular pixshop return payload processing
    try {
      const payloadRaw = sessionStorage.getItem('pixshopTemplateEdit');
      if (!payloadRaw) return;
      const payload = JSON.parse(payloadRaw);
      if (!payload || payload.templateId !== templateData.id || !payload.image) return;
      const idx = Number(payload.pageIndex) || 0;
      if (idx < 0 || idx >= pageImages.length) return;
      // Push current state to undo stack
      setUndoStack((prev) => [...prev, [...pageImages]]);
      const updated = [...pageImages];
      updated[idx] = payload.image;
      setPageImages(updated);
      setHasUnsavedChanges(true);
      sessionStorage.removeItem('pixshopTemplateEdit');
      console.log('✅ Applied Pixshop returned edit to template page', idx);
    } catch (e) {
      console.error('Failed to consume pixshopTemplateEdit payload', e);
    }
  }, [templateData, pageImages.length, searchParams]);

  // Define callback functions before early returns
  const handleFlipNext = useCallback(() => {
    console.log(
      `Template Editor - handleFlipNext called - current page: ${currentPage}, screen width: ${
        typeof window !== "undefined" ? window.innerWidth : "unknown"
      }`
    );
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      if (currentPage < 3) {
        console.log(
          `Template Editor - Mobile: Moving from page ${currentPage} to ${
            currentPage + 1
          }`
        );
        setCurrentPage(currentPage + 1);
      }
    } else {
      if (flipBookRef.current && currentPage < 3) {
        flipBookRef.current.pageFlip().flipNext();
      }
    }
  }, [currentPage]);

  const handleFlipPrev = useCallback(() => {
    console.log(
      `Template Editor - handleFlipPrev called - current page: ${currentPage}, screen width: ${
        typeof window !== "undefined" ? window.innerWidth : "unknown"
      }`
    );
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      if (currentPage > 0) {
        console.log(
          `Template Editor - Mobile: Moving from page ${currentPage} to ${
            currentPage - 1
          }`
        );
        setCurrentPage(currentPage - 1);
      }
    } else {
      if (flipBookRef.current && currentPage > 0) {
        flipBookRef.current.pageFlip().flipPrev();
      }
    }
  }, [currentPage]);

  const goToPage = useCallback((pageIndex: number) => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setCurrentPage(pageIndex);
    } else {
      if (flipBookRef.current) {
        flipBookRef.current.pageFlip().flip(pageIndex);
      }
    }
  }, []);

  // Restore session data when component loads (for cross-route persistence)
  useEffect(() => {
    if (!templateId) return;

    console.log('🔄 Template editor checking for session data...', { templateId });

    // Check for unsaved changes from previous session
    const sessionSummary = sessionDataManager.getSessionSummary(templateId);
    if (sessionSummary && sessionSummary.pagesWithChanges > 0) {
      console.log(`📂 Found session data with changes:`, sessionSummary);

      // Restore all pages with changes
      const pagesWithChanges = sessionDataManager.getAllPagesWithChanges(templateId);
      
      // Update pageImages with restored data
      const updatedImages = [...pageImages];
      let hasAnyChanges = false;

      pagesWithChanges.forEach(pageData => {
        if (pageData.editedImageBlob && pageData.pageIndex < updatedImages.length) {
          // Convert blob to data URL for display
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            updatedImages[pageData.pageIndex] = dataUrl;
            
            console.log(`✅ Restored page ${pageData.pageIndex} from session`);
            
            // Update state after all restorations
            setPageImages([...updatedImages]);
            setHasUnsavedChanges(true);
            hasAnyChanges = true;
          };
          reader.readAsDataURL(pageData.editedImageBlob);
        }
      });

      if (pagesWithChanges.length > 0) {
        console.log(`🎉 Template editor restored ${pagesWithChanges.length} pages from session`);
      }
    } else {
      console.log('📂 No session data found or no changes to restore');
    }
  }, [templateId, templateData]); // Run when template loads

  const handlePageFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data);
  }, []);

  // Keyboard navigation for flipbook
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

  // Swipe handling functions
  const handleTouchStart = (e: React.TouchEvent) => {
    console.log("Template Editor - Touch start - mobile swipe");
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    console.log("Template Editor - Touch end - mobile swipe");
    if (!touchStart || !touchEnd) {
      console.log("Template Editor - Missing touch start or end coordinates");
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    console.log(
      `Template Editor - Touch distance: ${distance}, left swipe: ${isLeftSwipe}, right swipe: ${isRightSwipe}, current page: ${currentPage}`
    );

    if (isLeftSwipe && currentPage < 3) {
      console.log("Template Editor - Executing left swipe - next page");
      handleFlipNext();
    }
    if (isRightSwipe && currentPage > 0) {
      console.log("Template Editor - Executing right swipe - previous page");
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
    if (templateData && originalName) {
      setTemplateData({ ...templateData, name: originalName });
      setEditedName(originalName);
    }
    setUndoStack([]);
    setHasUnsavedChanges(false);
    setShowRevertConfirm(false);

    console.log("🔄 Reverted to original state");
  };

  // Save function - copies template to saved_designs
  const handleSave = async () => {
    if (!templateData) {
      alert("No template data available");
      return;
    }

    if (!session?.user?.id) {
      alert("Please sign in to save cards");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      console.log("💾 Saving template to saved designs:", templateData.name);
      console.log("📂 Category:", selectedCategory?.name || "None");
      console.log(
        "� Category ID:",
        selectedCategory?.id || templateData.categoryId || "None"
      );
      console.log("�📸 Current page images:", pageImages);
  const userId = String(session.user.id);

      // Copy the template to saved designs with updated metadata and images
      const selectedCategoryId =
        selectedCategory?.id || templateData.categoryId;
      const selectedCategoryName =
        selectedCategory?.name || templateData.categoryName;

      console.log("🔍 Category debugging:");
      console.log("  - selectedCategory:", selectedCategory);
      console.log("  - selectedCategory?.id:", selectedCategory?.id);
      console.log("  - selectedCategory?.name:", selectedCategory?.name);
      console.log("  - templateData.categoryId:", templateData.categoryId);
      console.log("  - templateData.categoryName:", templateData.categoryName);
      console.log("  - Final selectedCategoryId:", selectedCategoryId);
      console.log("  - Final selectedCategoryName:", selectedCategoryName);
      console.log(
        "  - Available categories:",
        categories.map((c) => ({ id: c.id, name: c.name }))
      );

      // If no category is selected, find "General" category as default
      let finalCategoryId = selectedCategoryId;
      let finalCategoryName = selectedCategoryName;

      if (!finalCategoryId && categories.length > 0) {
        console.log("🔍 No category selected, looking for default category...");
        const generalCategory = categories.find(
          (cat) => cat.name.toLowerCase() === "general"
        );
        if (generalCategory) {
          finalCategoryId = generalCategory.id;
          finalCategoryName = generalCategory.name;
          console.log("✅ Using General category as default:", {
            id: finalCategoryId,
            name: finalCategoryName,
          });
        } else {
          // Use first category as fallback
          finalCategoryId = categories[0].id;
          finalCategoryName = categories[0].name;
          console.log("✅ Using first category as fallback:", {
            id: finalCategoryId,
            name: finalCategoryName,
          });
        }
      }

      // Final validation - ensure we ALWAYS have a category ID
      if (!finalCategoryId) {
        console.error(
          "❌ CRITICAL: No category ID available! This will cause NULL in database."
        );
        console.log("   - Available categories:", categories);
        console.log("   - Selected category:", selectedCategory);
        alert(
          "Error: No category selected. Please select a category before saving."
        );
        return;
      }

      // CRITICAL: Ensure all blob URLs and data URLs are converted to Supabase URLs before copying
      console.log("🔄 Ensuring all images are uploaded to Supabase...");
      console.log("📊 Current pageImages types:", pageImages.map((img, i) => ({
        index: i,
        type: img?.startsWith('data:') ? 'data URL' : img?.startsWith('blob:') ? 'blob URL' : 'regular URL',
        prefix: img?.substring(0, 50) || 'undefined'
      })));
      
      const hasImageChanges = pageImages.some(
        (img, index) => img !== templateData.pages[index]
      );
      let finalImages = pageImages;

      if (hasImageChanges) {
        try {
          // Convert any blob URLs or data URLs to Supabase URLs
          finalImages = await ensureSupabaseUrls(
            pageImages,
            userId,
            templateData.id
          );
          console.log("✅ All images converted to Supabase URLs");
        } catch (error) {
          console.error("❌ Failed to upload images to Supabase:", error);
          alert("Failed to upload edited images. Please try again.");
          return;
        }
      }

      const copyData = {
        title: templateData.name,
        categoryId: finalCategoryId,
        categoryName: finalCategoryName,
        // Include edited images directly in the copy request - now guaranteed to be Supabase URLs
        editedImages: hasImageChanges ? finalImages : undefined,
      };

      console.log(
        "📤 Copy data being sent:",
        JSON.stringify(copyData, null, 2)
      );
      console.log("📂 Final category ID being sent:", finalCategoryId);
      console.log("📂 Final category name being sent:", finalCategoryName);
      if (copyData.editedImages) {
        console.log(
          "🖼️ Images being copied:",
          copyData.editedImages.length,
          "images (all converted from blob URLs to Supabase URLs)"
        );
        copyData.editedImages.forEach((img, index) => {
          if (img.startsWith("blob:")) {
            console.error("❌ CRITICAL: Blob URL detected in copy data:", img);
          } else {
            console.log(`✅ Image ${index + 1}: Supabase URL confirmed`);
          }
        });
      }

      const response = await fetch(`/api/templates/${templateData.id}/copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(copyData),
      });

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401 || response.status === 403) {
          handleAuthError('/my-cards');
          return;
        }
        
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || "Failed to copy template");
      }

      const result = await response.json();
      console.log("✅ Template copied to saved designs:", result.data);

      // Only update with images if we have changes and the copy didn't include them
      const hasRemainingImageChanges = finalImages.some(
        (img, index) => img !== templateData.pages[index]
      );

      if (hasRemainingImageChanges && !copyData.editedImages) {
        console.log("📝 Updating saved design with remaining edited images");
        try {
          await saveSavedDesignWithImages(result.data.id, finalImages, {
            action: "update",
            title: templateData.name,
            userId,
            designId: result.data.id,
            categoryId: finalCategoryId,
            categoryName: finalCategoryName,
          });
        } catch (updateError) {
          console.error(
            "Failed to update with edited images, but copy was successful:",
            updateError
          );
          
          // Check if it's an authentication error during image update
          if (updateError instanceof Error && 
              (updateError.message.includes("Unauthorized") || 
               updateError.message.includes("401") || 
               updateError.message.includes("403"))) {
            handleAuthError('/my-cards');
            return;
          }
          
          // Continue anyway since the basic copy worked
        }
      }

      setHasUnsavedChanges(false); // Clear unsaved changes flag
      setSaveMessage("Template saved to My Cards!");

      // Clear session data after successful save
      if (templateId) {
        sessionDataManager.clearSession(templateId);
        console.log(`🗑️ Cleared session data after successful save for template ${templateId}`);
      }

      // Redirect to the saved card in editor mode after a short delay
      setTimeout(() => {
        router.push(
          `/my-cards/${result.data.id}?message=${encodeURIComponent(
            "Template saved successfully!"
          )}`
        );
      }, 1500);
    } catch (error) {
      console.error("❌ Save failed:", error);
      
      // Check if it's an authentication error
      if (error instanceof Error && 
          (error.message.includes("Unauthorized") || 
           error.message.includes("401") || 
           error.message.includes("403"))) {
        handleAuthError('/my-cards');
        return;
      }
      
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setSaveMessage(`Failed to save template: ${errorMessage}`);

      setTimeout(() => setSaveMessage(""), 8000);
    } finally {
      setIsSaving(false);
    }
  };

  // Function to handle editing a specific page
  const handleEditPage = async (pageIndex: number) => {
    console.log("🎨 Opening Pintura editor for page:", pageIndex);

    if (!templateData || pageIndex >= templateData.pages.length) {
      console.error("❌ Invalid page index or no template data");
      return;
    }

    try {
      const imageUrl = pageImages[pageIndex] || templateData.pages[pageIndex];
      const blobImageUrl = await convertImageToBlob(imageUrl);

      if (imageUrl !== blobImageUrl) {
        const updatedImages = [...pageImages];
        updatedImages[pageIndex] = blobImageUrl;
        setPageImages(updatedImages);
      }

      console.log(`📍 Setting editing page index to: ${pageIndex}`);
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
      if (imageUrl.startsWith("blob:")) {
        return imageUrl;
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401 || response.status === 403) {
          handleAuthError('/my-cards');
          throw new Error('Authentication required');
        }
        
        throw new Error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      return blobUrl;
    } catch (error) {
      console.error("❌ Failed to convert image to blob:", error);
      return imageUrl;
    }
  };

  // Handle editor process result
  const handleEditorProcess = ({ dest }: { dest: File }) => {
    console.log("✅ Editor process complete:", dest);

    if (editingPageIndex !== null && dest) {
      // Save current state to undo stack before making changes
      setUndoStack((prev) => [...prev, [...pageImages]]);

      const blobUrl = URL.createObjectURL(dest);

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

  // Handle editor close
  const handleEditorClose = () => {
    setEditorVisible(false);
    setEditingPageIndex(null);
  };

  // Handle name editing
  const handleStartEditingName = () => {
    setEditedName(templateData?.name || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (
      templateData &&
      editedName.trim() &&
      editedName.trim() !== templateData.name
    ) {
      setTemplateData({ ...templateData, name: editedName.trim() });
      setHasUnsavedChanges(true);
    }
    setIsEditingName(false);
  };

  const handleCancelNameEdit = () => {
    setEditedName(templateData?.name || "");
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
    console.log("🏷️ Category changed to:", category);
    console.log("🏷️ Category ID:", category.id);
    console.log("🏷️ Category Name:", category.name);
    setSelectedCategory(category);
    if (templateData) {
      setTemplateData({
        ...templateData,
        categoryId: category.id,
        categoryName: category.name,
      });
      setHasUnsavedChanges(true);
    }
  };

  // Initialize editing states when template loads
  useEffect(() => {
    if (templateData) {
      setEditedName(templateData.name);
      // Find and set the initial category if it exists
      if (templateData.categoryId && categories.length > 0) {
        const category = categories.find(
          (cat) => cat.id === templateData.categoryId
        );
        if (category) {
          console.log("🔄 Found and setting initial category:", category);
          setSelectedCategory(category);
        } else {
          console.log(
            "⚠️ Template category ID not found in categories list:",
            templateData.categoryId
          );
        }
      } else {
        console.log("🔄 No template category ID or categories not loaded yet");
        // Set default category to first available category if none selected
        if (categories.length > 0 && !selectedCategory) {
          const defaultCategory =
            categories.find((cat) => cat.name.toLowerCase() === "general") ||
            categories[0];
          console.log("🎯 Setting default category:", defaultCategory);
          setSelectedCategory(defaultCategory);
          setTemplateData({
            ...templateData,
            categoryId: defaultCategory.id,
            categoryName: defaultCategory.name,
          });
        }
      }
    }
  }, [templateData, categories, selectedCategory]);

  if (status === "loading" || !templateData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading template editor...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Redirect to /my-cards instead of staying on template editor page
    router.push("/my-cards");
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

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
                href="/templates"
                className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back</span>
              </Link>

              <div className="flex items-center gap-3">
                {/* Removed Save functionality */}
              </div>
            </div>

            {/* Title Row - Mobile */}
            <div className="pb-4">
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
                    placeholder="Enter template name..."
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
                      {templateData.name}
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
            </div>

            {/* Category Row - Mobile */}
            <div className="pb-4 hidden">
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
                  href="/templates"
                  className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span>Back to Templates</span>
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
                        placeholder="Enter template name..."
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
                        {templateData.name}
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
                {/* Removed Save functionality */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex relative">
        {/* Floating Toolbar */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex items-center gap-1 sm:gap-2 bg-white rounded-full shadow-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 backdrop-blur-sm bg-white/95">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 ${
              hasUnsavedChanges
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Save to My Cards"
          >
            {isSaving ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-300 border-t-current rounded-full animate-spin" />
            ) : (
              <ArchiveBoxIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          {/* Save As Button - Always Disabled */}
          <button
            disabled={true}
            className="p-1.5 sm:p-2 rounded-full text-gray-400 bg-gray-50 cursor-not-allowed opacity-50 touch-manipulation"
            title="Save As (not available in template editor)"
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

        {/* Center - Template Editor */}
        <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)] py-4 lg:py-8 transition-all duration-300 px-4">
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
              {/* Render each page */}
              {pageImages.map((pageImage, index) => (
                <div key={index} className="page-hard">
                  <div className="page-content w-full h-full relative">
                    <Image
                      src={pageImage}
                      alt={`Template Page ${index + 1}`}
                      width={500}
                      height={772}
                      className="w-full h-full object-cover rounded-lg"
                      priority={index === 0}
                    />
                    {/* Edit icon */}
                    <div
                      className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      style={{ pointerEvents: "auto" }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleEditPage(index);
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
              ))}
            </HTMLFlipBook>
          </div>

          {/* Desktop Page Indicator */}
          <div className="hidden xl:block absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg">
              Page {currentPage + 1} of {pageImages.length}
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
                  src={pageImages[currentPage]}
                  alt={`Template Page ${currentPage + 1}`}
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
                    <span>
                      Page {currentPage + 1} of {pageImages.length}
                    </span>
                    <button
                      onClick={handleFlipNext}
                      disabled={currentPage >= pageImages.length - 1}
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
            disabled={currentPage >= pageImages.length - 1}
            className="hidden xl:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ml-4 xl:ml-8 text-gray-700"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Pintura Editor Modal */}
      {editingPageIndex !== null && (
        <PinturaEditorModal
          key={`pintura-${editingPageIndex}-${Date.now()}-${pageImages[editingPageIndex]?.substring(0, 20)}`}
          imageSrc={(() => {
            const imgSrc = pageImages[editingPageIndex];
            console.log('🎨 Passing current pageImage to Pintura:', {
              pageIndex: editingPageIndex,
              isDataUrl: imgSrc?.startsWith('data:'),
              imageSize: imgSrc?.length || 0,
              imagePrefix: imgSrc?.substring(0, 50) || 'undefined',
              note: 'Pixshop blobs will stay in Pintura until Done is clicked'
            });
            return imgSrc;
          })()}
          isVisible={editorVisible}
          onHide={handleEditorClose}
          onProcess={handleEditorProcess}
          editingPageIndex={editingPageIndex}
        />
      )}

      {/* Revert Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRevertConfirm}
        onClose={() => setShowRevertConfirm(false)}
        onConfirm={confirmRevert}
        title="Revert All Changes?"
        message="Are you sure you want to revert all changes? This will restore the original template state and cannot be undone."
        confirmText="Revert Changes"
        confirmButtonType="warning"
      />

      <style jsx>{`
        .flipbook-shadow {
          filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
          transition: transform 0.3s ease, filter 0.3s ease;
        }

        .flipbook-shadow:hover {
          transform: scale(1.02);
          filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.4));
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
    </div>
  );
}

export default function TemplateEditorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TemplateEditorContent />
    </Suspense>
  );
}
