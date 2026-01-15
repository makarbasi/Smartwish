"use client";

import React, { useState, useEffect, Fragment, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SparklesIcon,
  TagIcon,
  CurrencyDollarIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition, Tab } from "@headlessui/react";

// Types
interface Category {
  id: string;
  name: string;
}

interface GreetingCard {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  category_name: string;
  author_id: string | null;
  description: string | null;
  price: number;
  cover_image: string;
  target_audience: string | null;
  occasion_type: string | null;
  style_type: string | null;
  image_1: string;
  image_2: string | null;
  image_3: string | null;
  image_4: string | null;
  message: string | null;
  search_keywords: string[];
  has_embedding: boolean;
  created_at: string;
  updated_at: string;
}

interface Sticker {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  image_url: string;
  tags: string[];
  search_keywords: string[];
  popularity: number;
  num_downloads: number;
  status: "active" | "inactive";
  has_embedding: boolean;
  created_at: string;
  updated_at: string;
}

// Default form states
const DEFAULT_CARD_FORM: Partial<GreetingCard> = {
  title: "",
  slug: "",
  category_id: "",
  description: "",
  price: 2.99,
  cover_image: "",
  target_audience: "",
  occasion_type: "",
  style_type: "",
  image_1: "",
  image_2: "",
  image_3: "",
  image_4: "",
  message: "",
  search_keywords: [],
};

const DEFAULT_STICKER_FORM: Partial<Sticker> = {
  title: "",
  slug: "",
  category: "",
  description: "",
  image_url: "",
  tags: [],
  search_keywords: [],
  status: "active",
};

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

// Image Upload Field Component
function ImageUploadField({
  label,
  value,
  onChange,
  type,
  category,
  imageType,
  required = false,
  placeholder = "https://...",
  previewClassName = "h-24 w-auto",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  type: "card" | "sticker";
  category: string;
  imageType?: "cover" | "inside" | "image3" | "image4";
  required?: boolean;
  placeholder?: string;
  previewClassName?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 10MB.");
      return;
    }

    // Upload file
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      formData.append("category", category || "general");
      if (imageType) {
        formData.append("imageType", imageType);
      }

      const response = await fetch("/api/admin/templates/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      onChange(result.url);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {/* URL Input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
        
        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !category}
          className={classNames(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            uploading
              ? "bg-gray-100 text-gray-400 cursor-wait"
              : !category
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          )}
          title={!category ? "Select a category first" : "Upload image"}
        >
          {uploading ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <CloudArrowUpIcon className="h-4 w-4" />
              Upload
            </>
          )}
        </button>
      </div>

      {/* Error message */}
      {uploadError && (
        <p className="mt-1 text-xs text-red-600">{uploadError}</p>
      )}

      {/* Hint when no category */}
      {!category && (
        <p className="mt-1 text-xs text-amber-600">
          Select a category first to enable image upload
        </p>
      )}

      {/* Image Preview */}
      {value && (
        <div className="mt-2">
          <img
            src={value}
            alt="Preview"
            className={classNames(previewClassName, "rounded-lg object-cover")}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data states
  const [cards, setCards] = useState<GreetingCard[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [cardCategories, setCardCategories] = useState<Category[]>([]);
  const [stickerCategories, setStickerCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab and filter states
  const [activeTab, setActiveTab] = useState(0); // 0 = cards, 1 = stickers
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 18;

  // Modal states
  const [showCardModal, setShowCardModal] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<GreetingCard | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Form states
  const [cardFormData, setCardFormData] = useState(DEFAULT_CARD_FORM);
  const [stickerFormData, setStickerFormData] = useState(DEFAULT_STICKER_FORM);
  const [saving, setSaving] = useState(false);

  // Text inputs for array fields
  const [cardKeywordsText, setCardKeywordsText] = useState("");
  const [stickerKeywordsText, setStickerKeywordsText] = useState("");
  const [stickerTagsText, setStickerTagsText] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/templates");
    }
  }, [status, router]);

  // Fetch categories on mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchCategories();
    }
  }, [status]);

  // Fetch items when tab, filters, or page changes
  useEffect(() => {
    if (status === "authenticated") {
      if (activeTab === 0) {
        fetchCards();
      } else {
        fetchStickers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activeTab, selectedCategory, searchQuery, statusFilter, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedCategory, searchQuery, statusFilter]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/admin/templates/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCardCategories(data.cardCategories || []);
      setStickerCategories(data.stickerCategories || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        type: "card",
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/admin/templates?${params}`);
      if (!response.ok) throw new Error("Failed to fetch cards");
      const data = await response.json();
      setCards(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error("Error fetching cards:", err);
      setError(err instanceof Error ? err.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const fetchStickers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        type: "sticker",
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/admin/templates?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stickers");
      const data = await response.json();
      setStickers(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error("Error fetching stickers:", err);
      setError(err instanceof Error ? err.message : "Failed to load stickers");
    } finally {
      setLoading(false);
    }
  };

  // Card CRUD operations
  const handleCreateCard = async () => {
    if (!cardFormData.title?.trim() || !cardFormData.cover_image?.trim() || !cardFormData.category_id) {
      alert("Title, Category, and Cover Image are required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "card",
          ...cardFormData,
          search_keywords: parseCommaSeparated(cardKeywordsText),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create card");
      }

      const result = await response.json();
      setCards([result.data, ...cards]);
      setShowCardModal(false);
      resetCardForm();
    } catch (err) {
      console.error("Error creating card:", err);
      alert(err instanceof Error ? err.message : "Failed to create card");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCard = async () => {
    if (!selectedCard) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/templates/${selectedCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "card",
          ...cardFormData,
          search_keywords: parseCommaSeparated(cardKeywordsText),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update card");
      }

      const result = await response.json();
      setCards(cards.map((c) => (c.id === selectedCard.id ? result.data : c)));
      setShowCardModal(false);
      setSelectedCard(null);
      resetCardForm();
    } catch (err) {
      console.error("Error updating card:", err);
      alert(err instanceof Error ? err.message : "Failed to update card");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/templates/${selectedCard.id}?type=card`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete card");
      }

      setCards(cards.filter((c) => c.id !== selectedCard.id));
      setShowDeleteModal(false);
      setSelectedCard(null);
    } catch (err) {
      console.error("Error deleting card:", err);
      alert(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setSaving(false);
    }
  };

  // Sticker CRUD operations
  const handleCreateSticker = async () => {
    if (!stickerFormData.title?.trim() || !stickerFormData.image_url?.trim()) {
      alert("Title and Image URL are required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sticker",
          ...stickerFormData,
          tags: parseCommaSeparated(stickerTagsText),
          search_keywords: parseCommaSeparated(stickerKeywordsText),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sticker");
      }

      const result = await response.json();
      setStickers([result.data, ...stickers]);
      setShowStickerModal(false);
      resetStickerForm();
    } catch (err) {
      console.error("Error creating sticker:", err);
      alert(err instanceof Error ? err.message : "Failed to create sticker");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSticker = async () => {
    if (!selectedSticker) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/templates/${selectedSticker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sticker",
          ...stickerFormData,
          tags: parseCommaSeparated(stickerTagsText),
          search_keywords: parseCommaSeparated(stickerKeywordsText),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sticker");
      }

      const result = await response.json();
      setStickers(stickers.map((s) => (s.id === selectedSticker.id ? result.data : s)));
      setShowStickerModal(false);
      setSelectedSticker(null);
      resetStickerForm();
    } catch (err) {
      console.error("Error updating sticker:", err);
      alert(err instanceof Error ? err.message : "Failed to update sticker");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSticker = async () => {
    if (!selectedSticker) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/templates/${selectedSticker.id}?type=sticker`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sticker");
      }

      // Update local state - soft delete makes it inactive
      setStickers(stickers.map((s) => 
        s.id === selectedSticker.id ? { ...s, status: "inactive" as const } : s
      ));
      setShowDeleteModal(false);
      setSelectedSticker(null);
    } catch (err) {
      console.error("Error deleting sticker:", err);
      alert(err instanceof Error ? err.message : "Failed to delete sticker");
    } finally {
      setSaving(false);
    }
  };

  // Helper functions
  const parseCommaSeparated = (text: string): string[] => {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const resetCardForm = () => {
    setCardFormData(DEFAULT_CARD_FORM);
    setCardKeywordsText("");
    setIsCreateMode(false);
  };

  const resetStickerForm = () => {
    setStickerFormData(DEFAULT_STICKER_FORM);
    setStickerKeywordsText("");
    setStickerTagsText("");
    setIsCreateMode(false);
  };

  const openCreateCardModal = () => {
    resetCardForm();
    setIsCreateMode(true);
    setShowCardModal(true);
  };

  const openEditCardModal = (card: GreetingCard) => {
    setSelectedCard(card);
    setCardFormData({
      title: card.title,
      slug: card.slug,
      category_id: card.category_id,
      description: card.description || "",
      price: card.price,
      cover_image: card.cover_image,
      target_audience: card.target_audience || "",
      occasion_type: card.occasion_type || "",
      style_type: card.style_type || "",
      image_1: card.image_1,
      image_2: card.image_2 || "",
      image_3: card.image_3 || "",
      image_4: card.image_4 || "",
      message: card.message || "",
    });
    setCardKeywordsText(card.search_keywords?.join(", ") || "");
    setIsCreateMode(false);
    setShowCardModal(true);
  };

  const openCreateStickerModal = () => {
    resetStickerForm();
    setIsCreateMode(true);
    setShowStickerModal(true);
  };

  const openEditStickerModal = (sticker: Sticker) => {
    setSelectedSticker(sticker);
    setStickerFormData({
      title: sticker.title,
      slug: sticker.slug,
      category: sticker.category,
      description: sticker.description || "",
      image_url: sticker.image_url,
      status: sticker.status,
    });
    setStickerTagsText(sticker.tags?.join(", ") || "");
    setStickerKeywordsText(sticker.search_keywords?.join(", ") || "");
    setIsCreateMode(false);
    setShowStickerModal(true);
  };

  if (status === "loading" || (loading && cards.length === 0 && stickers.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage greeting cards and stickers for your kiosks
              </p>
            </div>
            <button
              onClick={activeTab === 0 ? openCreateCardModal : openCreateStickerModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              {activeTab === 0 ? "Add Card" : "Add Sticker"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <Tab.Group selectedIndex={activeTab} onChange={(index) => {
          setActiveTab(index);
          setSelectedCategory("");
          setSearchQuery("");
          setStatusFilter("");
        }}>
          <Tab.List className="flex space-x-1 rounded-xl bg-indigo-100 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                classNames(
                  "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all",
                  "ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2",
                  selected
                    ? "bg-white text-indigo-700 shadow"
                    : "text-indigo-600 hover:bg-white/[0.12] hover:text-indigo-800"
                )
              }
            >
              <span className="flex items-center justify-center gap-2">
                <PhotoIcon className="h-5 w-5" />
                Greeting Cards ({activeTab === 0 ? totalCount : "..."})
              </span>
            </Tab>
            <Tab
              className={({ selected }) =>
                classNames(
                  "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all",
                  "ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2",
                  selected
                    ? "bg-white text-indigo-700 shadow"
                    : "text-indigo-600 hover:bg-white/[0.12] hover:text-indigo-800"
                )
              }
            >
              <span className="flex items-center justify-center gap-2">
                <SparklesIcon className="h-5 w-5" />
                Stickers ({activeTab === 1 ? totalCount : "..."})
              </span>
            </Tab>
          </Tab.List>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or description..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                {activeTab === 0
                  ? cardCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  : stickerCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
              </select>
            </div>

            {/* Status Filter (stickers only) */}
            {activeTab === 1 && (
              <div className="w-36">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>

          <Tab.Panels>
            {/* Cards Panel */}
            <Tab.Panel>
              {error ? (
                <div className="rounded-lg bg-red-50 p-4 text-red-700">
                  <p className="font-medium">Error loading cards</p>
                  <p className="text-sm mt-1">{error}</p>
                  <button
                    onClick={fetchCards}
                    className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-12">
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">No greeting cards</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery || selectedCategory
                      ? "No cards match your filters."
                      : "Get started by adding your first card."}
                  </p>
                  {!searchQuery && !selectedCategory && (
                    <div className="mt-6">
                      <button
                        onClick={openCreateCardModal}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                      >
                        <PlusIcon className="h-5 w-5" />
                        Add Card
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Image */}
                        <div className="aspect-[4/3] bg-gray-100 relative">
                          {card.cover_image ? (
                            <img
                              src={card.cover_image}
                              alt={card.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PhotoIcon className="h-16 w-16 text-gray-300" />
                            </div>
                          )}
                          {/* Embedding badge */}
                          <div className="absolute top-2 right-2">
                            {card.has_embedding ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                <CheckCircleIcon className="w-3 h-3 mr-1" />
                                Indexed
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                <XCircleIcon className="w-3 h-3 mr-1" />
                                No Index
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                                {card.title}
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5">{card.slug}</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                              {card.category_name}
                            </span>
                          </div>

                          {card.description && (
                            <p className="mt-2 text-xs text-gray-600 line-clamp-2">
                              {card.description}
                            </p>
                          )}

                          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <CurrencyDollarIcon className="h-4 w-4" />
                              ${card.price?.toFixed(2)}
                            </span>
                            {card.occasion_type && (
                              <span className="flex items-center gap-1">
                                <TagIcon className="h-4 w-4" />
                                {card.occasion_type}
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="mt-4 flex items-center gap-2">
                            <button
                              onClick={() => openEditCardModal(card)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCard(card);
                                setSelectedSticker(null);
                                setShowDeleteModal(true);
                              }}
                              className="inline-flex items-center justify-center rounded-lg bg-white p-2 text-red-600 ring-1 ring-inset ring-gray-300 hover:bg-red-50 transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
                        {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} cards
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage(page - 1)}
                          disabled={page === 1}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(page + 1)}
                          disabled={page === totalPages}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Tab.Panel>

            {/* Stickers Panel */}
            <Tab.Panel>
              {error ? (
                <div className="rounded-lg bg-red-50 p-4 text-red-700">
                  <p className="font-medium">Error loading stickers</p>
                  <p className="text-sm mt-1">{error}</p>
                  <button
                    onClick={fetchStickers}
                    className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              ) : stickers.length === 0 ? (
                <div className="text-center py-12">
                  <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">No stickers</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery || selectedCategory || statusFilter
                      ? "No stickers match your filters."
                      : "Get started by adding your first sticker."}
                  </p>
                  {!searchQuery && !selectedCategory && !statusFilter && (
                    <div className="mt-6">
                      <button
                        onClick={openCreateStickerModal}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                      >
                        <PlusIcon className="h-5 w-5" />
                        Add Sticker
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {stickers.map((sticker) => (
                      <div
                        key={sticker.id}
                        className={classNames(
                          "bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-md transition-shadow",
                          sticker.status === "inactive" ? "opacity-60" : ""
                        )}
                      >
                        {/* Image */}
                        <div className="aspect-square bg-gray-100 relative">
                          {sticker.image_url ? (
                            <img
                              src={sticker.image_url}
                              alt={sticker.title}
                              className="w-full h-full object-contain p-4"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <SparklesIcon className="h-16 w-16 text-gray-300" />
                            </div>
                          )}
                          {/* Status badge */}
                          <div className="absolute top-2 left-2">
                            {sticker.status === "active" ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                Inactive
                              </span>
                            )}
                          </div>
                          {/* Embedding badge */}
                          <div className="absolute top-2 right-2">
                            {sticker.has_embedding ? (
                              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                                <CheckCircleIcon className="w-3 h-3 mr-1" />
                                Indexed
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {sticker.title}
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{sticker.slug}</p>
                            </div>
                            <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                              {sticker.category}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <EyeIcon className="h-4 w-4" />
                              {sticker.popularity}
                            </span>
                            <span className="flex items-center gap-1">
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              {sticker.num_downloads}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="mt-4 flex items-center gap-2">
                            <button
                              onClick={() => openEditStickerModal(sticker)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                            {sticker.status === "active" && (
                              <button
                                onClick={() => {
                                  setSelectedSticker(sticker);
                                  setSelectedCard(null);
                                  setShowDeleteModal(true);
                                }}
                                className="inline-flex items-center justify-center rounded-lg bg-white p-2 text-red-600 ring-1 ring-inset ring-gray-300 hover:bg-red-50 transition-colors"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
                        {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} stickers
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage(page - 1)}
                          disabled={page === 1}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(page + 1)}
                          disabled={page === totalPages}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>

      {/* Card Form Modal */}
      <CardFormModal
        open={showCardModal}
        onClose={() => {
          setShowCardModal(false);
          setSelectedCard(null);
          resetCardForm();
        }}
        title={isCreateMode ? "Add Greeting Card" : `Edit: ${selectedCard?.title}`}
        formData={cardFormData}
        setFormData={setCardFormData}
        keywordsText={cardKeywordsText}
        setKeywordsText={setCardKeywordsText}
        categories={cardCategories}
        onSubmit={isCreateMode ? handleCreateCard : handleUpdateCard}
        saving={saving}
        isCreate={isCreateMode}
      />

      {/* Sticker Form Modal */}
      <StickerFormModal
        open={showStickerModal}
        onClose={() => {
          setShowStickerModal(false);
          setSelectedSticker(null);
          resetStickerForm();
        }}
        title={isCreateMode ? "Add Sticker" : `Edit: ${selectedSticker?.title}`}
        formData={stickerFormData}
        setFormData={setStickerFormData}
        tagsText={stickerTagsText}
        setTagsText={setStickerTagsText}
        keywordsText={stickerKeywordsText}
        setKeywordsText={setStickerKeywordsText}
        categories={stickerCategories}
        onSubmit={isCreateMode ? handleCreateSticker : handleUpdateSticker}
        saving={saving}
        isCreate={isCreateMode}
        selectedSticker={selectedSticker}
      />

      {/* Delete Confirmation Modal */}
      <Transition appear show={showDeleteModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowDeleteModal(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {selectedCard ? "Delete Greeting Card" : "Deactivate Sticker"}
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    {selectedCard
                      ? `Are you sure you want to permanently delete "${selectedCard.title}"? This action cannot be undone.`
                      : `Are you sure you want to deactivate "${selectedSticker?.title}"? It will be hidden from kiosks but can be reactivated later.`}
                  </p>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={selectedCard ? handleDeleteCard : handleDeleteSticker}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {saving
                        ? selectedCard
                          ? "Deleting..."
                          : "Deactivating..."
                        : selectedCard
                        ? "Delete"
                        : "Deactivate"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

// Card Form Modal Component
function CardFormModal({
  open,
  onClose,
  title,
  formData,
  setFormData,
  keywordsText,
  setKeywordsText,
  categories,
  onSubmit,
  saving,
  isCreate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  formData: Partial<GreetingCard>;
  setFormData: (data: Partial<GreetingCard>) => void;
  keywordsText: string;
  setKeywordsText: (text: string) => void;
  categories: Category[];
  onSubmit: () => void;
  saving: boolean;
  isCreate: boolean;
}) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Basic Information
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.title || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                          }
                          placeholder="e.g., Happy Birthday Floral"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Slug
                        </label>
                        <input
                          type="text"
                          value={formData.slug || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, slug: e.target.value })
                          }
                          placeholder="auto-generated-from-title"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Leave empty to auto-generate
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.category_id || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, category_id: e.target.value })
                          }
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                          <option value="">Select a category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.price || 2.99}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                price: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={2}
                        placeholder="Optional description"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Targeting */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Targeting
                    </h4>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Audience
                        </label>
                        <input
                          type="text"
                          value={formData.target_audience || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, target_audience: e.target.value })
                          }
                          placeholder="e.g., Friend, Mom"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Occasion Type
                        </label>
                        <input
                          type="text"
                          value={formData.occasion_type || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, occasion_type: e.target.value })
                          }
                          placeholder="e.g., Birthday"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Style Type
                        </label>
                        <input
                          type="text"
                          value={formData.style_type || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, style_type: e.target.value })
                          }
                          placeholder="e.g., Floral, Funny"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Images */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Images
                    </h4>

                    <ImageUploadField
                      label="Cover Image"
                      value={formData.cover_image || ""}
                      onChange={(url) => setFormData({ ...formData, cover_image: url, image_1: url })}
                      type="card"
                      category={categories.find(c => c.id === formData.category_id)?.name || ""}
                      imageType="cover"
                      required
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <ImageUploadField
                        label="Inside Page Image"
                        value={formData.image_2 || ""}
                        onChange={(url) => setFormData({ ...formData, image_2: url })}
                        type="card"
                        category={categories.find(c => c.id === formData.category_id)?.name || ""}
                        imageType="inside"
                      />

                      <ImageUploadField
                        label="Image 3"
                        value={formData.image_3 || ""}
                        onChange={(url) => setFormData({ ...formData, image_3: url })}
                        type="card"
                        category={categories.find(c => c.id === formData.category_id)?.name || ""}
                        imageType="image3"
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Content
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inside Message
                      </label>
                      <textarea
                        value={formData.message || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        rows={3}
                        placeholder="Default message for inside of card"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Search Keywords
                      </label>
                      <input
                        type="text"
                        value={keywordsText}
                        onChange={(e) => setKeywordsText(e.target.value)}
                        placeholder="birthday, floral, happy, celebration (comma-separated)"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Separate multiple keywords with commas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    {saving
                      ? isCreate
                        ? "Creating..."
                        : "Saving..."
                      : isCreate
                      ? "Create Card"
                      : "Save Changes"}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Sticker Form Modal Component
function StickerFormModal({
  open,
  onClose,
  title,
  formData,
  setFormData,
  tagsText,
  setTagsText,
  keywordsText,
  setKeywordsText,
  categories,
  onSubmit,
  saving,
  isCreate,
  selectedSticker,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  formData: Partial<Sticker>;
  setFormData: (data: Partial<Sticker>) => void;
  tagsText: string;
  setTagsText: (text: string) => void;
  keywordsText: string;
  setKeywordsText: (text: string) => void;
  categories: string[];
  onSubmit: () => void;
  saving: boolean;
  isCreate: boolean;
  selectedSticker: Sticker | null;
}) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Basic Information
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder="e.g., Cute Ginger Cat"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slug
                      </label>
                      <input
                        type="text"
                        value={formData.slug || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, slug: e.target.value })
                        }
                        placeholder="auto-generated-from-title"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave empty to auto-generate
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <input
                          type="text"
                          value={formData.category || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, category: e.target.value })
                          }
                          list="sticker-categories"
                          placeholder="e.g., cats, dogs"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <datalist id="sticker-categories">
                          {categories.map((cat) => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={formData.status || "active"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              status: e.target.value as "active" | "inactive",
                            })
                          }
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={2}
                        placeholder="Optional description"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Image */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Image
                    </h4>

                    <ImageUploadField
                      label="Sticker Image"
                      value={formData.image_url || ""}
                      onChange={(url) => setFormData({ ...formData, image_url: url })}
                      type="sticker"
                      category={formData.category || "general"}
                      required
                      previewClassName="h-32 w-32 object-contain bg-gray-100 p-2 mx-auto"
                    />
                  </div>

                  {/* Metadata */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Metadata
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tags
                      </label>
                      <input
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder="cute, cat, orange, kawaii (comma-separated)"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Search Keywords
                      </label>
                      <input
                        type="text"
                        value={keywordsText}
                        onChange={(e) => setKeywordsText(e.target.value)}
                        placeholder="cat sticker, ginger cat, cute animal (comma-separated)"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Stats (read-only for edit mode) */}
                  {!isCreate && selectedSticker && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                        Statistics
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Popularity</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedSticker.popularity}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Downloads</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedSticker.num_downloads}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    {saving
                      ? isCreate
                        ? "Creating..."
                        : "Saving..."
                      : isCreate
                      ? "Create Sticker"
                      : "Save Changes"}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
