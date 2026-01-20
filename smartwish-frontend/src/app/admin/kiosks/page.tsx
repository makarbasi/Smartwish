"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  KeyIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  ComputerDesktopIcon,
  MicrophoneIcon,
  PrinterIcon,
  SwatchIcon,
  FilmIcon,
  UserGroupIcon,
  UserPlusIcon,
  DocumentIcon,
  GiftIcon,
  EnvelopeIcon,
  SparklesIcon,
  ChartBarIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { Dialog, Transition } from "@headlessui/react";

type AssignedManager = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  assignedAt: string;
};

type AvailableManager = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  assignedKiosksCount: number;
};

type PrinterTray = {
  trayNumber: number;
  trayName: string;
  paperType: string; // 'greeting-card' | 'sticker' | 'photo' | 'envelope' | 'label' | 'plain'
  paperSize: string; // 'letter' | 'a4' | '4x6' | '5x7' | etc.
};

// Bundle discount gift card configuration
type BundleGiftCardConfig = {
  id: string; // Unique ID for this config entry
  source: 'smartwish' | 'tillo';
  brandId?: string; // For SmartWish (UUID)
  brandSlug?: string; // For Tillo (slug)
  brandName: string; // Display name
  brandLogo?: string; // Logo URL
  // Discount when this gift card is added to a greeting card/sticker purchase
  giftCardDiscountPercent: number; // 0-100, discount on gift card value (customer pays less, gets full value)
  printDiscountPercent: number; // 0-100, discount on print cost (greeting card/sticker)
  // Optional: min/max amounts
  minAmount?: number;
  maxAmount?: number;
  // Optional: which products this applies to
  appliesTo?: ('greeting-card' | 'sticker')[]; // Default: both
};

// Featured category configuration for homepage carousels
type FeaturedCategoryConfig = {
  categoryId: string;
  categoryName: string;
  displayOrder: number;
};

type KioskConfig = {
  theme?: string;
  featuredTemplateIds?: string[];
  featuredCategories?: FeaturedCategoryConfig[]; // Categories to show as carousels on templates page
  promotedGiftCardIds?: string[]; // Gift card brand IDs/slugs to feature in Gift Hub
  micEnabled?: boolean;
  giftCardRibbonEnabled?: boolean; // Show gift card marketplace ribbon (default true)
  greetingCardsEnabled?: boolean; // Enable greeting cards tile on kiosk home (default true)
  stickersEnabled?: boolean; // Enable stickers tile on kiosk home (default true)
  ads?: {
    playlist?: Array<{ url: string; duration?: number; weight?: number }>;
  };
  printerProfile?: string;
  // NOTE: printerName and printerIP have been moved to kiosk_printers table
  // Use the Printers section in admin portal to configure printers per kiosk
  printerTrays?: PrinterTray[];
  revenueSharePercent?: number; // Store owner's share of net profit (default 30%)
  surveillance?: {
    enabled: boolean; // Enable surveillance/people counting
    webcamIndex: number; // Webcam device index (default 0)
    dwellThresholdSeconds: number; // Seconds before counting (default 8)
    frameThreshold: number; // Frames before saving image (default 10)
    httpPort: number; // Port for local image server (default 8765)
  };
  giftCardTile?: {
    enabled: boolean; // Master toggle - show/hide the tile
    visibility: 'visible' | 'hidden' | 'disabled'; // visible=show, hidden=don't show, disabled=show but grayed out
    source: 'smartwish' | 'tillo'; // Where to source the gift card from
    brandId: string | null; // UUID of the SmartWish gift card brand (when source='smartwish')
    tilloBrandSlug: string | null; // Tillo brand slug (when source='tillo')
    tilloBrandName?: string; // Cached Tillo brand name for display
    tilloBrandLogo?: string; // Cached Tillo brand logo URL
    tilloMinAmount?: number; // Tillo brand minimum amount
    tilloMaxAmount?: number; // Tillo brand maximum amount
    discountPercent: number; // Discount percentage (0-100) for this kiosk
    displayName?: string; // Optional custom display name
    description?: string; // Optional custom description
    presetAmounts?: number[]; // Quick-select amounts
    minAmount?: number; // Minimum amount users can purchase (overrides brand default)
    maxAmount?: number; // Maximum amount users can purchase (overrides brand default)
    allowCustomAmount?: boolean; // Allow users to enter custom amounts (default true)
  };
  // Bundle discounts: gift cards that give discounts when purchased with greeting cards/stickers
  // This is SEPARATE from giftCardTile (standalone gift card purchases)
  bundleDiscounts?: {
    enabled: boolean; // Master toggle for bundle discounts
    eligibleGiftCards: BundleGiftCardConfig[]; // List of gift cards with bundle discounts
  };
};

type Kiosk = {
  id: string;
  kioskId: string;
  storeId?: string;
  name?: string;
  apiKey?: string;
  config: KioskConfig;
  version: string;
  isActive?: boolean;
  isOnline?: boolean; // Device online (based on heartbeat)
  hasActiveSession?: boolean; // Active user session
  lastHeartbeat?: string | null;
  createdAt: string;
  updatedAt: string;
};

const PAPER_TYPES = [
  { value: 'greeting-card', label: 'Greeting Card' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'photo', label: 'Photo Paper' },
  { value: 'envelope', label: 'Envelope' },
  { value: 'label', label: 'Label' },
  { value: 'plain', label: 'Plain Paper' },
];

const PAPER_SIZES = [
  { value: 'letter', label: 'Letter (8.5" × 11")' },
  { value: 'legal', label: 'Legal (8.5" × 14")' },
  { value: 'a4', label: 'A4 (210mm × 297mm)' },
  { value: 'a5', label: 'A5 (148mm × 210mm)' },
  { value: '4x6', label: '4" × 6" (Photo)' },
  { value: '5x7', label: '5" × 7" (Photo)' },
  { value: '8x10', label: '8" × 10" (Photo)' },
  { value: 'half-letter', label: 'Half Letter (5.5" × 8.5")' },
];

const DEFAULT_CONFIG: KioskConfig = {
  theme: "default",
  featuredTemplateIds: [],
  featuredCategories: [], // No featured categories by default - shows regular grid view
  promotedGiftCardIds: [], // No promoted gift cards by default
  micEnabled: true,
  giftCardRibbonEnabled: true, // Show gift card marketplace ribbon by default
  greetingCardsEnabled: true, // Enable greeting cards tile by default
  stickersEnabled: true, // Enable stickers tile by default
  ads: { playlist: [] },
  printerProfile: "default",
  // NOTE: Printers are now configured via kiosk_printers table (Printers section)
  printerTrays: [
    { trayNumber: 1, trayName: "Tray 1", paperType: "greeting-card", paperSize: "letter" },
    { trayNumber: 2, trayName: "Tray 2", paperType: "sticker", paperSize: "letter" },
  ],
  revenueSharePercent: 30, // Default 30% of net profit goes to store owner
  surveillance: {
    enabled: false, // Disabled by default
    webcamIndex: 0,
    dwellThresholdSeconds: 8,
    frameThreshold: 10,
    httpPort: 8765,
  },
  giftCardTile: {
    enabled: false, // Disabled by default
    visibility: 'hidden',
    source: 'smartwish', // Default to SmartWish internal brands
    brandId: null,
    tilloBrandSlug: null,
    tilloBrandName: undefined,
    tilloBrandLogo: undefined,
    tilloMinAmount: undefined,
    tilloMaxAmount: undefined,
    discountPercent: 0,
    displayName: 'Gift Card',
    description: 'Purchase a gift card',
    presetAmounts: [25, 50, 100, 200],
    minAmount: undefined, // Use brand default if not set
    maxAmount: undefined, // Use brand default if not set
    allowCustomAmount: true, // Allow custom amounts by default
  },
  bundleDiscounts: {
    enabled: false, // Disabled by default
    eligibleGiftCards: [], // No bundle gift cards configured by default
  },
};

export default function KiosksAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showManagersModal, setShowManagersModal] = useState(false);
  const [selectedKiosk, setSelectedKiosk] = useState<Kiosk | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manager assignment states
  const [assignedManagers, setAssignedManagers] = useState<AssignedManager[]>([]);
  const [availableManagers, setAvailableManagers] = useState<AvailableManager[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [assigningManager, setAssigningManager] = useState<string | null>(null);
  const [unassigningManager, setUnassigningManager] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    kioskId: "",
    storeId: "",
    name: "",
    config: { ...DEFAULT_CONFIG },
  });
  const [saving, setSaving] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/kiosks");
    }
  }, [status, router]);

  // Fetch kiosks
  useEffect(() => {
    if (status === "authenticated") {
      fetchKiosks();
    }
  }, [status]);

  // Handle ?edit=kioskId query parameter to open edit modal
  useEffect(() => {
    const editKioskId = searchParams.get("edit");
    if (editKioskId && kiosks.length > 0 && !loading) {
      const kioskToEdit = kiosks.find((k) => k.kioskId === editKioskId);
      if (kioskToEdit) {
        openEditModal(kioskToEdit);
        // Clear the query param after opening modal
        router.replace("/admin/kiosks", { scroll: false });
      }
    }
  }, [searchParams, kiosks, loading]);

  const fetchKiosks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/kiosks");
      if (!response.ok) {
        throw new Error("Failed to fetch kiosks");
      }
      const data = await response.json();
      setKiosks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching kiosks:", err);
      setError(err instanceof Error ? err.message : "Failed to load kiosks");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.kioskId.trim()) {
      alert("Kiosk ID is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create kiosk");
      }

      const newKiosk = await response.json();
      setKiosks([...kiosks, newKiosk]);
      setShowCreateModal(false);
      resetForm();

      // Show the new API key
      alert(`Kiosk created successfully!\n\nAPI Key: ${newKiosk.apiKey}\n\nPlease save this key securely.`);
    } catch (err) {
      console.error("Error creating kiosk:", err);
      alert(err instanceof Error ? err.message : "Failed to create kiosk");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedKiosk) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/kiosks/${selectedKiosk.kioskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: formData.storeId,
          name: formData.name,
          config: formData.config,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update kiosk");
      }

      const updated = await response.json();
      setKiosks(kiosks.map((k) => (k.kioskId === selectedKiosk.kioskId ? updated : k)));
      setShowEditModal(false);
      setSelectedKiosk(null);
      resetForm();
    } catch (err) {
      console.error("Error updating kiosk:", err);
      alert(err instanceof Error ? err.message : "Failed to update kiosk");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKiosk) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/kiosks/${selectedKiosk.kioskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete kiosk");
      }

      setKiosks(kiosks.filter((k) => k.kioskId !== selectedKiosk.kioskId));
      setShowDeleteModal(false);
      setSelectedKiosk(null);
    } catch (err) {
      console.error("Error deleting kiosk:", err);
      alert(err instanceof Error ? err.message : "Failed to delete kiosk");
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async (kiosk: Kiosk) => {
    if (!confirm(`Are you sure you want to rotate the API key for "${kiosk.name || kiosk.kioskId}"? The old key will stop working immediately.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/kiosks/${kiosk.kioskId}/rotate-key`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to rotate API key");
      }

      const updated = await response.json();
      setKiosks(kiosks.map((k) => (k.kioskId === kiosk.kioskId ? updated : k)));

      alert(`API key rotated successfully!\n\nNew API Key: ${updated.apiKey}\n\nPlease update your kiosk configuration.`);
    } catch (err) {
      console.error("Error rotating API key:", err);
      alert(err instanceof Error ? err.message : "Failed to rotate API key");
    }
  };

  const copyToClipboard = async (text: string, kioskId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(kioskId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Manager assignment functions
  const openManagersModal = async (kiosk: Kiosk) => {
    setSelectedKiosk(kiosk);
    setShowManagersModal(true);
    setLoadingManagers(true);

    try {
      // Fetch assigned managers for this kiosk
      const assignedRes = await fetch(`/api/admin/kiosks/${kiosk.kioskId}/managers`);
      if (assignedRes.ok) {
        const assigned = await assignedRes.json();
        setAssignedManagers(Array.isArray(assigned) ? assigned : []);
      }

      // Fetch all available managers
      const allManagersRes = await fetch("/api/admin/managers");
      if (allManagersRes.ok) {
        const allManagers = await allManagersRes.json();
        setAvailableManagers(Array.isArray(allManagers) ? allManagers : []);
      }
    } catch (err) {
      console.error("Error fetching managers:", err);
    } finally {
      setLoadingManagers(false);
    }
  };

  const handleAssignManager = async (userId: string) => {
    if (!selectedKiosk) return;

    setAssigningManager(userId);
    try {
      const response = await fetch(`/api/admin/kiosks/${selectedKiosk.kioskId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign manager");
      }

      // Refresh the assigned managers list
      const assignedRes = await fetch(`/api/admin/kiosks/${selectedKiosk.kioskId}/managers`);
      if (assignedRes.ok) {
        const assigned = await assignedRes.json();
        setAssignedManagers(Array.isArray(assigned) ? assigned : []);
      }
    } catch (err) {
      console.error("Error assigning manager:", err);
      alert(err instanceof Error ? err.message : "Failed to assign manager");
    } finally {
      setAssigningManager(null);
    }
  };

  const handleUnassignManager = async (userId: string) => {
    if (!selectedKiosk) return;

    setUnassigningManager(userId);
    try {
      const response = await fetch(
        `/api/admin/kiosks/${selectedKiosk.kioskId}/managers/${userId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to unassign manager");
      }

      // Remove from local state
      setAssignedManagers(assignedManagers.filter((m) => m.id !== userId));
    } catch (err) {
      console.error("Error unassigning manager:", err);
      alert(err instanceof Error ? err.message : "Failed to unassign manager");
    } finally {
      setUnassigningManager(null);
    }
  };

  const resetForm = () => {
    setFormData({
      kioskId: "",
      storeId: "",
      name: "",
      config: { ...DEFAULT_CONFIG },
    });
  };

  const openEditModal = (kiosk: Kiosk) => {
    setSelectedKiosk(kiosk);
    setFormData({
      kioskId: kiosk.kioskId,
      storeId: kiosk.storeId || "",
      name: kiosk.name || "",
      config: { ...DEFAULT_CONFIG, ...kiosk.config },
    });
    setShowEditModal(true);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Kiosk Management</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure and manage kiosks deployed across your locations
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Kiosk
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error loading kiosks</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchKiosks}
              className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : kiosks.length === 0 ? (
          <div className="text-center py-12">
            <ComputerDesktopIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No kiosks</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first kiosk configuration.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <PlusIcon className="h-5 w-5" />
                Add Kiosk
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kiosks.map((kiosk) => {
              // Determine printer status summary
              const printerStatus = kiosk.printerStatus || kiosk.config?.printerStatus;
              const hasErrors = printerStatus?.errors?.length > 0;
              const hasWarnings = printerStatus?.warnings?.length > 0;
              const printerStatusSummary = !printerStatus
                ? "No Status"
                : hasErrors
                ? "Error"
                : hasWarnings
                ? "Warning"
                : printerStatus.online
                ? "OK"
                : "Offline";
              const printerStatusColor = !printerStatus
                ? "bg-gray-100 text-gray-600"
                : hasErrors
                ? "bg-red-100 text-red-700"
                : hasWarnings
                ? "bg-yellow-100 text-yellow-700"
                : printerStatus.online
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700";

              return (
                <div
                  key={kiosk.id}
                  className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-lg hover:ring-indigo-300 transition-all cursor-pointer group"
                  onClick={() => window.location.href = `/admin/kiosks/${kiosk.kioskId}`}
                >
                  <div className="p-5">
                    {/* Header with icon and status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                          <ComputerDesktopIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {kiosk.name || kiosk.kioskId}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">
                            {kiosk.storeId || "No store"}
                          </p>
                        </div>
                      </div>
                      {/* Online/Offline dot */}
                      <span
                        className={`flex-shrink-0 w-3 h-3 rounded-full ${
                          kiosk.isOnline ? "bg-green-500" : "bg-red-500"
                        }`}
                        title={kiosk.isOnline ? "Online" : "Offline"}
                      />
                    </div>

                    {/* Kiosk ID */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-400">ID</p>
                      <p className="text-sm font-mono text-gray-700 truncate">{kiosk.kioskId}</p>
                    </div>

                    {/* Printer Status Summary */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-400 mb-1">Printer</p>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${printerStatusColor}`}>
                        <PrinterIcon className="h-3.5 w-3.5" />
                        {printerStatusSummary}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(kiosk);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Edit Configuration"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openManagersModal(kiosk);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Manage Managers"
                      >
                        <UserGroupIcon className="h-3.5 w-3.5" />
                        Managers
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedKiosk(kiosk);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Kiosk"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Details Button */}
                    <Link
                      href={`/admin/kiosks/${kiosk.kioskId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <KioskFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Kiosk"
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreate}
        saving={saving}
        isCreate
      />

      {/* Edit Modal */}
      <KioskFormModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedKiosk(null);
        }}
        title={`Edit Kiosk: ${selectedKiosk?.name || selectedKiosk?.kioskId}`}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleUpdate}
        saving={saving}
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
                    Delete Kiosk
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    Are you sure you want to delete &quot;{selectedKiosk?.name || selectedKiosk?.kioskId}&quot;?
                    This action cannot be undone and the kiosk will immediately lose access.
                  </p>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Manager Assignment Modal */}
      <Transition appear show={showManagersModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setShowManagersModal(false);
            setSelectedKiosk(null);
            setAssignedManagers([]);
          }}
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Manage Managers
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        {selectedKiosk?.name || selectedKiosk?.kioskId}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowManagersModal(false);
                        setSelectedKiosk(null);
                        setAssignedManagers([]);
                      }}
                      className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {loadingManagers ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Loading managers...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Assigned Managers */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Assigned Managers ({assignedManagers.length})
                          </h4>
                          {assignedManagers.length === 0 ? (
                            <p className="text-sm text-gray-500 italic py-3 text-center bg-gray-50 rounded-lg">
                              No managers assigned yet
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {assignedManagers.map((manager) => (
                                <div
                                  key={manager.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                      <UserGroupIcon className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {manager.name || "Unnamed"}
                                      </p>
                                      <p className="text-xs text-gray-500">{manager.email}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleUnassignManager(manager.id)}
                                    disabled={unassigningManager === manager.id}
                                    className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                                  >
                                    {unassigningManager === manager.id ? "Removing..." : "Remove"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Available Managers to Assign */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Add Managers
                          </h4>
                          {(() => {
                            const assignedIds = new Set(assignedManagers.map((m) => m.id));
                            const unassigned = availableManagers.filter(
                              (m) => !assignedIds.has(m.id)
                            );

                            if (unassigned.length === 0) {
                              return (
                                <p className="text-sm text-gray-500 italic py-3 text-center bg-gray-50 rounded-lg">
                                  {availableManagers.length === 0
                                    ? "No managers available. Invite managers first."
                                    : "All managers are already assigned"}
                                </p>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                {unassigned.map((manager) => (
                                  <div
                                    key={manager.id}
                                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                        <UserPlusIcon className="w-4 h-4 text-gray-600" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {manager.name || "Unnamed"}
                                        </p>
                                        <p className="text-xs text-gray-500">{manager.email}</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleAssignManager(manager.id)}
                                      disabled={assigningManager === manager.id}
                                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                                    >
                                      {assigningManager === manager.id ? (
                                        "Adding..."
                                      ) : (
                                        <>
                                          <UserPlusIcon className="w-4 h-4" />
                                          Assign
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => {
                        setShowManagersModal(false);
                        setSelectedKiosk(null);
                        setAssignedManagers([]);
                      }}
                      className="w-full py-2.5 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                    >
                      Done
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

// Gift card brand type for dropdown
type GiftCardBrandOption = {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
};

// Tillo brand type for dropdown
type TilloBrandOption = {
  id: string; // Same as slug for Tillo
  name: string;
  slug: string;
  logo: string;
  minAmount: number;
  maxAmount: number;
  currency: string;
};

// Kiosk Form Modal Component
function KioskFormModal({
  open,
  onClose,
  title,
  formData,
  setFormData,
  onSubmit,
  saving,
  isCreate = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  formData: {
    kioskId: string;
    storeId: string;
    name: string;
    config: KioskConfig;
  };
  setFormData: (data: typeof formData) => void;
  onSubmit: () => void;
  saving: boolean;
  isCreate?: boolean;
}) {
  // Local state for comma-separated text fields to allow typing commas/spaces
  const [featuredTemplatesText, setFeaturedTemplatesText] = useState(
    formData.config.featuredTemplateIds?.join(", ") || ""
  );
  const [promotedGiftCardsText, setPromotedGiftCardsText] = useState(
    formData.config.promotedGiftCardIds?.join(", ") || ""
  );
  
  // Gift card brands for dropdown (SmartWish internal)
  const [giftCardBrands, setGiftCardBrands] = useState<GiftCardBrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  
  // Tillo brands for dropdown
  const [tilloBrands, setTilloBrands] = useState<TilloBrandOption[]>([]);
  const [loadingTilloBrands, setLoadingTilloBrands] = useState(false);
  const [tilloSearchQuery, setTilloSearchQuery] = useState("");
  
  // Get current source (default to 'smartwish' for backward compatibility)
  const currentSource = formData.config.giftCardTile?.source || 'smartwish';
  
  // Fetch SmartWish gift card brands when modal opens
  useEffect(() => {
    if (open && giftCardBrands.length === 0 && !loadingBrands) {
      setLoadingBrands(true);
      fetch("/api/admin/gift-card-brands?includeInactive=false")
        .then((res) => res.json())
        .then((data) => {
          setGiftCardBrands(data.data || []);
        })
        .catch((err) => {
          console.error("Failed to fetch gift card brands:", err);
        })
        .finally(() => {
          setLoadingBrands(false);
        });
    }
  }, [open, giftCardBrands.length]);
  
  // Fetch Tillo brands when modal opens and source is tillo
  useEffect(() => {
    if (open && tilloBrands.length === 0 && !loadingTilloBrands) {
      setLoadingTilloBrands(true);
      fetch("/api/tillo/brands")
        .then((res) => res.json())
        .then((data) => {
          const brands = data.brands || [];
          setTilloBrands(brands.map((b: any) => ({
            id: b.slug || b.id,
            name: b.name,
            slug: b.slug || b.id,
            logo: b.logo || b.image || '',
            minAmount: b.minAmount || 5,
            maxAmount: b.maxAmount || 500,
            currency: b.currency || 'USD',
          })));
        })
        .catch((err) => {
          console.error("Failed to fetch Tillo brands:", err);
        })
        .finally(() => {
          setLoadingTilloBrands(false);
        });
    }
  }, [open, tilloBrands.length]);
  
  // Filter Tillo brands by search query
  const filteredTilloBrands = tilloSearchQuery.trim()
    ? tilloBrands.filter(b => 
        b.name.toLowerCase().includes(tilloSearchQuery.toLowerCase()) ||
        b.slug.toLowerCase().includes(tilloSearchQuery.toLowerCase())
      )
    : tilloBrands.slice(0, 50); // Show first 50 if no search

  // Categories for featured categories dropdown
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Fetch categories when modal opens
  useEffect(() => {
    if (open && categories.length === 0 && !loadingCategories) {
      setLoadingCategories(true);
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
          setCategories(data.data || []);
        })
        .catch((err) => {
          console.error("Failed to fetch categories:", err);
        })
        .finally(() => {
          setLoadingCategories(false);
        });
    }
  }, [open, categories.length]);

  // Bundle Discounts state
  const [showBundleAddModal, setShowBundleAddModal] = useState(false);
  const [editingBundleGiftCard, setEditingBundleGiftCard] = useState<BundleGiftCardConfig | null>(null);
  const [bundleSearchQuery, setBundleSearchQuery] = useState("");
  const [bundleFormData, setBundleFormData] = useState<Partial<BundleGiftCardConfig>>({
    source: 'smartwish',
    giftCardDiscountPercent: 10,
    printDiscountPercent: 10,
    appliesTo: ['greeting-card', 'sticker'],
  });

  // Filter brands for bundle selection (same data sources as gift card tile)
  // We keep them separate to maintain proper typing
  const filteredBundleTilloBrands = bundleSearchQuery.trim()
    ? tilloBrands.filter(b => 
        b.name.toLowerCase().includes(bundleSearchQuery.toLowerCase()) ||
        b.slug.toLowerCase().includes(bundleSearchQuery.toLowerCase())
      )
    : tilloBrands.slice(0, 50);
  
  const filteredBundleSmartWishBrands = giftCardBrands;

  // Add a new bundle gift card
  const handleAddBundleGiftCard = () => {
    if (!bundleFormData.brandName) return;
    
    const newCard: BundleGiftCardConfig = {
      id: crypto.randomUUID(),
      source: bundleFormData.source || 'smartwish',
      brandId: bundleFormData.source === 'smartwish' ? bundleFormData.brandId : undefined,
      brandSlug: bundleFormData.source === 'tillo' ? bundleFormData.brandSlug : undefined,
      brandName: bundleFormData.brandName,
      brandLogo: bundleFormData.brandLogo,
      giftCardDiscountPercent: bundleFormData.giftCardDiscountPercent || 10,
      printDiscountPercent: bundleFormData.printDiscountPercent || 10,
      minAmount: bundleFormData.minAmount,
      maxAmount: bundleFormData.maxAmount,
      appliesTo: bundleFormData.appliesTo || ['greeting-card', 'sticker'],
    };

    const currentCards = formData.config.bundleDiscounts?.eligibleGiftCards || [];
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        bundleDiscounts: {
          ...formData.config.bundleDiscounts,
          enabled: formData.config.bundleDiscounts?.enabled ?? true,
          eligibleGiftCards: [...currentCards, newCard],
        },
      },
    });

    // Reset form and close modal
    setBundleFormData({
      source: 'smartwish',
      giftCardDiscountPercent: 10,
      printDiscountPercent: 10,
      appliesTo: ['greeting-card', 'sticker'],
    });
    setBundleSearchQuery("");
    setShowBundleAddModal(false);
  };

  // Update an existing bundle gift card
  const handleUpdateBundleGiftCard = () => {
    if (!editingBundleGiftCard || !bundleFormData.brandName) return;

    const currentCards = formData.config.bundleDiscounts?.eligibleGiftCards || [];
    const updatedCards = currentCards.map(card => {
      if (card.id === editingBundleGiftCard.id) {
        return {
          ...card,
          source: bundleFormData.source || card.source,
          brandId: bundleFormData.source === 'smartwish' ? bundleFormData.brandId : undefined,
          brandSlug: bundleFormData.source === 'tillo' ? bundleFormData.brandSlug : undefined,
          brandName: bundleFormData.brandName || card.brandName,
          brandLogo: bundleFormData.brandLogo,
          giftCardDiscountPercent: bundleFormData.giftCardDiscountPercent ?? card.giftCardDiscountPercent,
          printDiscountPercent: bundleFormData.printDiscountPercent ?? card.printDiscountPercent,
          minAmount: bundleFormData.minAmount,
          maxAmount: bundleFormData.maxAmount,
          appliesTo: bundleFormData.appliesTo || card.appliesTo,
        };
      }
      return card;
    });

    setFormData({
      ...formData,
      config: {
        ...formData.config,
        bundleDiscounts: {
          ...formData.config.bundleDiscounts,
          enabled: formData.config.bundleDiscounts?.enabled ?? true,
          eligibleGiftCards: updatedCards,
        },
      },
    });

    // Reset form and close modal
    setEditingBundleGiftCard(null);
    setBundleFormData({
      source: 'smartwish',
      giftCardDiscountPercent: 10,
      printDiscountPercent: 10,
      appliesTo: ['greeting-card', 'sticker'],
    });
    setBundleSearchQuery("");
    setShowBundleAddModal(false);
  };

  // Delete a bundle gift card
  const handleDeleteBundleGiftCard = (cardId: string) => {
    const currentCards = formData.config.bundleDiscounts?.eligibleGiftCards || [];
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        bundleDiscounts: {
          ...formData.config.bundleDiscounts,
          enabled: formData.config.bundleDiscounts?.enabled ?? false,
          eligibleGiftCards: currentCards.filter(card => card.id !== cardId),
        },
      },
    });
  };

  // Open edit modal for a bundle gift card
  const openEditBundleModal = (card: BundleGiftCardConfig) => {
    setEditingBundleGiftCard(card);
    setBundleFormData({
      source: card.source,
      brandId: card.brandId,
      brandSlug: card.brandSlug,
      brandName: card.brandName,
      brandLogo: card.brandLogo,
      giftCardDiscountPercent: card.giftCardDiscountPercent,
      printDiscountPercent: card.printDiscountPercent,
      minAmount: card.minAmount,
      maxAmount: card.maxAmount,
      appliesTo: card.appliesTo,
    });
    setShowBundleAddModal(true);
  };

  // Sync local state when modal opens with new data
  useEffect(() => {
    if (open) {
      setFeaturedTemplatesText(formData.config.featuredTemplateIds?.join(", ") || "");
      setPromotedGiftCardsText(formData.config.promotedGiftCardIds?.join(", ") || "");
    }
  }, [open, formData.config.featuredTemplateIds, formData.config.promotedGiftCardIds]);

  // Parse comma-separated text into array (on blur)
  const parseCommaSeparated = (text: string): string[] => {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Sync featured templates to formData on blur
  const handleFeaturedTemplatesBlur = () => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        featuredTemplateIds: parseCommaSeparated(featuredTemplatesText),
      },
    });
  };

  // Sync promoted gift cards to formData on blur
  const handlePromotedGiftCardsBlur = () => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        promotedGiftCardIds: parseCommaSeparated(promotedGiftCardsText),
      },
    });
  };

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

                <div className="p-6 space-y-5">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Basic Information
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kiosk ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.kioskId}
                        onChange={(e) =>
                          setFormData({ ...formData, kioskId: e.target.value })
                        }
                        disabled={!isCreate}
                        placeholder="e.g., kiosk-nyc-01"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Unique identifier for this kiosk
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., NYC Times Square Kiosk"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Store ID
                      </label>
                      <input
                        type="text"
                        value={formData.storeId}
                        onChange={(e) =>
                          setFormData({ ...formData, storeId: e.target.value })
                        }
                        placeholder="e.g., store-nyc"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Configuration
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Theme
                      </label>
                      <select
                        value={formData.config.theme || "default"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            config: { ...formData.config, theme: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="default">Default</option>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="festive">Festive</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Microphone Enabled
                        </label>
                        <p className="text-xs text-gray-500">
                          Allow voice search on this kiosk
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              micEnabled: !formData.config.micEnabled,
                            },
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${formData.config.micEnabled
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.config.micEnabled
                              ? "translate-x-5"
                              : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Gift Card Ribbon
                        </label>
                        <p className="text-xs text-gray-500">
                          Show gift card marketplace ribbon on cards
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              giftCardRibbonEnabled: !formData.config.giftCardRibbonEnabled,
                            },
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${formData.config.giftCardRibbonEnabled !== false
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.config.giftCardRibbonEnabled !== false
                              ? "translate-x-5"
                              : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Greeting Cards
                        </label>
                        <p className="text-xs text-gray-500">
                          Enable greeting cards tile on kiosk home
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              greetingCardsEnabled: !formData.config.greetingCardsEnabled,
                            },
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${formData.config.greetingCardsEnabled !== false
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.config.greetingCardsEnabled !== false
                              ? "translate-x-5"
                              : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Stickers
                        </label>
                        <p className="text-xs text-gray-500">
                          Enable stickers tile on kiosk home
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              stickersEnabled: !formData.config.stickersEnabled,
                            },
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${formData.config.stickersEnabled !== false
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.config.stickersEnabled !== false
                              ? "translate-x-5"
                              : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>

                    {/* NOTE: Printer Name and IP fields have been removed.
                        Printers are now configured via the Printers section in the admin portal.
                        Each kiosk can have multiple printers with different printable types (greeting-card, sticker). */}

                    {/* Featured Categories for Homepage Carousels */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Featured Categories
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Select categories to show as horizontal carousels on the greeting cards page. 
                        Each category will display cards sorted by popularity.
                      </p>
                      
                      {loadingCategories ? (
                        <div className="text-sm text-gray-500">Loading categories...</div>
                      ) : categories.length === 0 ? (
                        <div className="text-sm text-gray-500">No categories available</div>
                      ) : (
                        <div className="space-y-2">
                          {/* Selected Categories */}
                          {(formData.config.featuredCategories || []).length > 0 && (
                            <div className="mb-3">
                              <span className="text-xs font-medium text-gray-600 mb-1 block">
                                Selected ({(formData.config.featuredCategories || []).length}):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {(formData.config.featuredCategories || [])
                                  .sort((a, b) => a.displayOrder - b.displayOrder)
                                  .map((fc, index) => (
                                    <div
                                      key={fc.categoryId}
                                      className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-sm"
                                    >
                                      <span className="text-xs text-indigo-500 mr-0.5">{index + 1}.</span>
                                      <span>{fc.categoryName}</span>
                                      {/* Move up */}
                                      {index > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const current = [...(formData.config.featuredCategories || [])];
                                            const sorted = current.sort((a, b) => a.displayOrder - b.displayOrder);
                                            // Swap display orders
                                            const temp = sorted[index].displayOrder;
                                            sorted[index].displayOrder = sorted[index - 1].displayOrder;
                                            sorted[index - 1].displayOrder = temp;
                                            setFormData({
                                              ...formData,
                                              config: { ...formData.config, featuredCategories: current },
                                            });
                                          }}
                                          className="text-indigo-600 hover:text-indigo-800 p-0.5"
                                          title="Move up"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                          </svg>
                                        </button>
                                      )}
                                      {/* Move down */}
                                      {index < (formData.config.featuredCategories || []).length - 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const current = [...(formData.config.featuredCategories || [])];
                                            const sorted = current.sort((a, b) => a.displayOrder - b.displayOrder);
                                            // Swap display orders
                                            const temp = sorted[index].displayOrder;
                                            sorted[index].displayOrder = sorted[index + 1].displayOrder;
                                            sorted[index + 1].displayOrder = temp;
                                            setFormData({
                                              ...formData,
                                              config: { ...formData.config, featuredCategories: current },
                                            });
                                          }}
                                          className="text-indigo-600 hover:text-indigo-800 p-0.5"
                                          title="Move down"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      )}
                                      {/* Remove */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = (formData.config.featuredCategories || [])
                                            .filter((c) => c.categoryId !== fc.categoryId);
                                          setFormData({
                                            ...formData,
                                            config: { ...formData.config, featuredCategories: updated },
                                          });
                                        }}
                                        className="text-indigo-600 hover:text-red-600 p-0.5"
                                        title="Remove"
                                      >
                                        <XMarkIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Add Category Dropdown */}
                          <div className="flex gap-2">
                            <select
                              id="add-featured-category"
                              className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                              value=""
                              onChange={(e) => {
                                const categoryId = e.target.value;
                                if (!categoryId) return;
                                const category = categories.find((c) => c.id === categoryId);
                                if (!category) return;
                                
                                const existing = formData.config.featuredCategories || [];
                                if (existing.some((fc) => fc.categoryId === categoryId)) return;
                                
                                const maxOrder = existing.length > 0 
                                  ? Math.max(...existing.map((fc) => fc.displayOrder)) 
                                  : 0;
                                
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    featuredCategories: [
                                      ...existing,
                                      {
                                        categoryId: category.id,
                                        categoryName: category.name,
                                        displayOrder: maxOrder + 1,
                                      },
                                    ],
                                  },
                                });
                                
                                // Reset dropdown
                                e.target.value = "";
                              }}
                            >
                              <option value="">Add a category...</option>
                              {categories
                                .filter((c) => !(formData.config.featuredCategories || []).some((fc) => fc.categoryId === c.id))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          
                          {(formData.config.featuredCategories || []).length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                              No categories selected. The default 3-column grid view will be shown.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Featured Template IDs
                      </label>
                      <input
                        type="text"
                        value={featuredTemplatesText}
                        onChange={(e) => setFeaturedTemplatesText(e.target.value)}
                        onBlur={handleFeaturedTemplatesBlur}
                        placeholder="template-1, template-2"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Comma-separated list of template IDs to feature
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        🎁 Promoted Gift Cards
                      </label>
                      <input
                        type="text"
                        value={promotedGiftCardsText}
                        onChange={(e) => setPromotedGiftCardsText(e.target.value)}
                        onBlur={handlePromotedGiftCardsBlur}
                        placeholder="amazon-com-usa, starbucks-usa, target-usa"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Comma-separated list of gift card brand slugs to promote in the Gift Hub.
                        These appear in a featured section above the main list.
                      </p>
                    </div>

                    {/* Printer Trays Configuration */}
                    <div className="col-span-2 border-t pt-4 mt-2">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Printer Trays
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const trays = formData.config.printerTrays || [];
                            const nextTrayNumber = trays.length > 0
                              ? Math.max(...trays.map(t => t.trayNumber)) + 1
                              : 1;
                            setFormData({
                              ...formData,
                              config: {
                                ...formData.config,
                                printerTrays: [
                                  ...trays,
                                  {
                                    trayNumber: nextTrayNumber,
                                    trayName: `Tray ${nextTrayNumber}`,
                                    paperType: "plain",
                                    paperSize: "letter"
                                  },
                                ],
                              },
                            });
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                        >
                          + Add Tray
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Configure paper trays for different print jobs. The system will automatically select the correct tray based on paper type.
                      </p>

                      {(!formData.config.printerTrays || formData.config.printerTrays.length === 0) ? (
                        <div className="text-center py-4 text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg">
                          No trays configured. Click &quot;+ Add Tray&quot; to add one.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {formData.config.printerTrays.map((tray, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Tray {tray.trayNumber}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const trays = [...(formData.config.printerTrays || [])];
                                    trays.splice(index, 1);
                                    setFormData({
                                      ...formData,
                                      config: {
                                        ...formData.config,
                                        printerTrays: trays,
                                      },
                                    });
                                  }}
                                  className="text-red-600 hover:text-red-500 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Tray Name</label>
                                  <input
                                    type="text"
                                    value={tray.trayName}
                                    onChange={(e) => {
                                      const trays = [...(formData.config.printerTrays || [])];
                                      trays[index] = { ...trays[index], trayName: e.target.value };
                                      setFormData({
                                        ...formData,
                                        config: { ...formData.config, printerTrays: trays },
                                      });
                                    }}
                                    className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="e.g., Main Tray"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Paper Type</label>
                                  <select
                                    value={tray.paperType}
                                    onChange={(e) => {
                                      const trays = [...(formData.config.printerTrays || [])];
                                      trays[index] = { ...trays[index], paperType: e.target.value };
                                      setFormData({
                                        ...formData,
                                        config: { ...formData.config, printerTrays: trays },
                                      });
                                    }}
                                    className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                  >
                                    {PAPER_TYPES.map((pt) => (
                                      <option key={pt.value} value={pt.value}>
                                        {pt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Paper Size</label>
                                  <select
                                    value={tray.paperSize}
                                    onChange={(e) => {
                                      const trays = [...(formData.config.printerTrays || [])];
                                      trays[index] = { ...trays[index], paperSize: e.target.value };
                                      setFormData({
                                        ...formData,
                                        config: { ...formData.config, printerTrays: trays },
                                      });
                                    }}
                                    className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                  >
                                    {PAPER_SIZES.map((ps) => (
                                      <option key={ps.value} value={ps.value}>
                                        {ps.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Revenue Share Configuration */}
                    <div className="col-span-2 border-t pt-4 mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Revenue Share %
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Percentage of net profit (after transaction fees) to share with the store owner.
                        Transaction fee = $0.50 + 3% of sale price.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={formData.config.revenueSharePercent ?? 30}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              config: {
                                ...formData.config,
                                revenueSharePercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                              },
                            })
                          }
                          className="w-24 rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    </div>

                    {/* Surveillance Configuration */}
                    <div className="col-span-2 border-t pt-4 mt-2">
                      <h5 className="text-sm font-semibold text-gray-800 mb-3">
                        📹 Surveillance / People Counting
                      </h5>
                      <p className="text-xs text-gray-500 mb-3">
                        Track foot traffic using webcam-based person detection. Requires Python and YOLO model on the kiosk computer.
                      </p>

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Enable Surveillance
                          </label>
                          <p className="text-xs text-gray-500">
                            Start people counting when print agent runs
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              config: {
                                ...formData.config,
                                surveillance: {
                                  ...formData.config.surveillance,
                                  enabled: !(formData.config.surveillance?.enabled ?? false),
                                  webcamIndex: formData.config.surveillance?.webcamIndex ?? 0,
                                  dwellThresholdSeconds: formData.config.surveillance?.dwellThresholdSeconds ?? 8,
                                  frameThreshold: formData.config.surveillance?.frameThreshold ?? 10,
                                  httpPort: formData.config.surveillance?.httpPort ?? 8765,
                                },
                              },
                            })
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 ${
                            formData.config.surveillance?.enabled
                              ? "bg-amber-500"
                              : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formData.config.surveillance?.enabled
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {formData.config.surveillance?.enabled && (
                        <div className="grid grid-cols-2 gap-4 ml-4 pl-4 border-l-2 border-amber-200">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Webcam Index</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={formData.config.surveillance?.webcamIndex ?? 0}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    surveillance: {
                                      ...formData.config.surveillance!,
                                      webcamIndex: parseInt(e.target.value) || 0,
                                    },
                                  },
                                })
                              }
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">0 = default camera</p>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Dwell Threshold (seconds)</label>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={formData.config.surveillance?.dwellThresholdSeconds ?? 8}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    surveillance: {
                                      ...formData.config.surveillance!,
                                      dwellThresholdSeconds: parseInt(e.target.value) || 8,
                                    },
                                  },
                                })
                              }
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">Count after staying this long</p>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Frame Threshold</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.config.surveillance?.frameThreshold ?? 10}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    surveillance: {
                                      ...formData.config.surveillance!,
                                      frameThreshold: parseInt(e.target.value) || 10,
                                    },
                                  },
                                })
                              }
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">Save image after this many frames</p>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Image Server Port</label>
                            <input
                              type="number"
                              min="1024"
                              max="65535"
                              value={formData.config.surveillance?.httpPort ?? 8765}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    surveillance: {
                                      ...formData.config.surveillance!,
                                      httpPort: parseInt(e.target.value) || 8765,
                                    },
                                  },
                                })
                              }
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">Local HTTP port for images</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Gift Card Tile Configuration */}
                    <div className="col-span-2 border-t pt-4 mt-2">
                      <h5 className="text-sm font-semibold text-gray-800 mb-3">
                        🎁 Gift Card Tile
                      </h5>
                      <p className="text-xs text-gray-500 mb-3">
                        Add a dedicated gift card purchase tile to the kiosk home screen. Users can buy a specific gift card brand with an optional discount.
                      </p>

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Enable Gift Card Tile
                          </label>
                          <p className="text-xs text-gray-500">
                            Show gift card purchase option on kiosk home
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              config: {
                                ...formData.config,
                                giftCardTile: {
                                  ...formData.config.giftCardTile,
                                  enabled: !(formData.config.giftCardTile?.enabled ?? false),
                                  visibility: formData.config.giftCardTile?.visibility ?? 'visible',
                                  source: formData.config.giftCardTile?.source ?? 'smartwish',
                                  brandId: formData.config.giftCardTile?.brandId ?? null,
                                  tilloBrandSlug: formData.config.giftCardTile?.tilloBrandSlug ?? null,
                                  discountPercent: formData.config.giftCardTile?.discountPercent ?? 0,
                                  displayName: formData.config.giftCardTile?.displayName ?? 'Gift Card',
                                  description: formData.config.giftCardTile?.description ?? 'Purchase a gift card',
                                  presetAmounts: formData.config.giftCardTile?.presetAmounts ?? [25, 50, 100, 200],
                                },
                              },
                            })
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                            formData.config.giftCardTile?.enabled
                              ? "bg-emerald-500"
                              : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formData.config.giftCardTile?.enabled
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {formData.config.giftCardTile?.enabled && (
                        <div className="space-y-4 ml-4 pl-4 border-l-2 border-emerald-200">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Visibility</label>
                            <select
                              value={formData.config.giftCardTile?.visibility ?? 'visible'}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    giftCardTile: {
                                      ...formData.config.giftCardTile!,
                                      visibility: e.target.value as 'visible' | 'hidden' | 'disabled',
                                    },
                                  },
                                })
                              }
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            >
                              <option value="visible">Visible - Show tile</option>
                              <option value="hidden">Hidden - Don&apos;t show tile</option>
                              <option value="disabled">Disabled - Show grayed out</option>
                            </select>
                          </div>

                          {/* Gift Card Source Selection */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Gift Card Source</label>
                            <div className="flex gap-2 mb-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData({
                                    ...formData,
                                    config: {
                                      ...formData.config,
                                      giftCardTile: {
                                        ...formData.config.giftCardTile!,
                                        source: 'smartwish',
                                        // Clear Tillo fields when switching
                                        tilloBrandSlug: null,
                                        tilloBrandName: undefined,
                                        tilloBrandLogo: undefined,
                                        tilloMinAmount: undefined,
                                        tilloMaxAmount: undefined,
                                      },
                                    },
                                  })
                                }
                                className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                                  currentSource === 'smartwish'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                🏪 SmartWish Internal
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData({
                                    ...formData,
                                    config: {
                                      ...formData.config,
                                      giftCardTile: {
                                        ...formData.config.giftCardTile!,
                                        source: 'tillo',
                                        // Clear SmartWish fields when switching
                                        brandId: null,
                                      },
                                    },
                                  })
                                }
                                className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                                  currentSource === 'tillo'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                🌐 Tillo Marketplace
                              </button>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">
                              {currentSource === 'smartwish' 
                                ? 'Select from your internally managed gift card brands'
                                : 'Select from Tillo\'s global gift card marketplace (Amazon, Starbucks, etc.)'}
                            </p>
                          </div>

                          {/* SmartWish Brand Selection */}
                          {currentSource === 'smartwish' && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">SmartWish Gift Card Brand</label>
                              {loadingBrands ? (
                                <div className="text-sm text-gray-400 py-2">Loading brands...</div>
                              ) : giftCardBrands.length === 0 ? (
                                <div className="text-sm text-amber-600 py-2">
                                  No gift card brands found. <a href="/admin/gift-card-brands" className="underline">Create one first</a>
                                </div>
                              ) : (
                                <select
                                  value={formData.config.giftCardTile?.brandId ?? ''}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      config: {
                                        ...formData.config,
                                        giftCardTile: {
                                          ...formData.config.giftCardTile!,
                                          brandId: e.target.value || null,
                                        },
                                      },
                                    })
                                  }
                                  className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                >
                                  <option value="">Select a gift card brand...</option>
                                  {giftCardBrands.map((brand) => (
                                    <option key={brand.id} value={brand.id}>
                                      {brand.name} ({brand.slug})
                                    </option>
                                  ))}
                                </select>
                              )}
                              {/* Show selected SmartWish brand logo and info */}
                              {formData.config.giftCardTile?.brandId && (() => {
                                const selectedBrand = giftCardBrands.find(b => b.id === formData.config.giftCardTile?.brandId);
                                if (!selectedBrand) return null;
                                return (
                                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-3">
                                    {selectedBrand.logo_url ? (
                                      <img
                                        src={selectedBrand.logo_url}
                                        alt={selectedBrand.name}
                                        className="w-12 h-12 rounded-lg object-contain bg-white border border-gray-200"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <GiftIcon className="w-6 h-6 text-emerald-600" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-emerald-800">{selectedBrand.name}</p>
                                      <p className="text-xs text-emerald-600 font-mono">{selectedBrand.slug}</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Tillo Brand Selection */}
                          {currentSource === 'tillo' && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Tillo Gift Card Brand</label>
                              {loadingTilloBrands ? (
                                <div className="text-sm text-gray-400 py-2">Loading Tillo brands...</div>
                              ) : tilloBrands.length === 0 ? (
                                <div className="text-sm text-amber-600 py-2">
                                  No Tillo brands available. Check your Tillo API configuration.
                                </div>
                              ) : (
                                <>
                                  {/* Search input for Tillo brands */}
                                  <input
                                    type="text"
                                    placeholder="Search Tillo brands (e.g., Amazon, Starbucks)..."
                                    value={tilloSearchQuery}
                                    onChange={(e) => setTilloSearchQuery(e.target.value)}
                                    className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-2"
                                  />
                                  <select
                                    value={formData.config.giftCardTile?.tilloBrandSlug ?? ''}
                                    onChange={(e) => {
                                      const selectedSlug = e.target.value;
                                      const selectedBrand = tilloBrands.find(b => b.slug === selectedSlug);
                                      setFormData({
                                        ...formData,
                                        config: {
                                          ...formData.config,
                                          giftCardTile: {
                                            ...formData.config.giftCardTile!,
                                            tilloBrandSlug: selectedSlug || null,
                                            tilloBrandName: selectedBrand?.name,
                                            tilloBrandLogo: selectedBrand?.logo,
                                            tilloMinAmount: selectedBrand?.minAmount,
                                            tilloMaxAmount: selectedBrand?.maxAmount,
                                          },
                                        },
                                      });
                                    }}
                                    className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    size={8}
                                  >
                                    <option value="">Select a Tillo brand...</option>
                                    {filteredTilloBrands.map((brand) => (
                                      <option key={brand.slug} value={brand.slug}>
                                        {brand.name} (${brand.minAmount}-${brand.maxAmount})
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {tilloBrands.length} brands available • Showing {filteredTilloBrands.length}
                                  </p>
                                </>
                              )}
                              {/* Show selected Tillo brand logo and info */}
                              {formData.config.giftCardTile?.tilloBrandSlug && (() => {
                                const tilloConfig = formData.config.giftCardTile;
                                return (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-3">
                                    {tilloConfig.tilloBrandLogo ? (
                                      <img
                                        src={tilloConfig.tilloBrandLogo}
                                        alt={tilloConfig.tilloBrandName || 'Tillo Brand'}
                                        className="w-12 h-12 rounded-lg object-contain bg-white border border-gray-200"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <GiftIcon className="w-6 h-6 text-blue-600" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-blue-800">{tilloConfig.tilloBrandName || tilloConfig.tilloBrandSlug}</p>
                                      <p className="text-xs text-blue-600 font-mono">{tilloConfig.tilloBrandSlug}</p>
                                      <p className="text-xs text-blue-500">
                                        ${tilloConfig.tilloMinAmount} - ${tilloConfig.tilloMaxAmount}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Discount %</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={formData.config.giftCardTile?.discountPercent ?? 0}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      config: {
                                        ...formData.config,
                                        giftCardTile: {
                                          ...formData.config.giftCardTile!,
                                          discountPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                                        },
                                      },
                                    })
                                  }
                                  className="w-20 text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-sm text-gray-600">%</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">0 = no discount</p>
                            </div>

                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                              <input
                                type="text"
                                value={formData.config.giftCardTile?.displayName ?? 'Gift Card'}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    config: {
                                      ...formData.config,
                                      giftCardTile: {
                                        ...formData.config.giftCardTile!,
                                        displayName: e.target.value,
                                      },
                                    },
                                  })
                                }
                                placeholder="Gift Card"
                                className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Description</label>
                            <input
                              type="text"
                              value={formData.config.giftCardTile?.description ?? ''}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    giftCardTile: {
                                      ...formData.config.giftCardTile!,
                                      description: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="Purchase a gift card"
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Preset Amounts</label>
                            <input
                              type="text"
                              value={(formData.config.giftCardTile?.presetAmounts ?? [25, 50, 100, 200]).join(', ')}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    giftCardTile: {
                                      ...formData.config.giftCardTile!,
                                      presetAmounts: e.target.value
                                        .split(',')
                                        .map(s => parseInt(s.trim()))
                                        .filter(n => !isNaN(n) && n > 0),
                                    },
                                  },
                                })
                              }
                              placeholder="25, 50, 100, 200"
                              className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">Comma-separated dollar amounts</p>
                          </div>

                          {/* Amount Limits */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Min Amount ($)</label>
                              <input
                                type="number"
                                min="1"
                                value={formData.config.giftCardTile?.minAmount ?? ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    config: {
                                      ...formData.config,
                                      giftCardTile: {
                                        ...formData.config.giftCardTile!,
                                        minAmount: e.target.value ? parseInt(e.target.value) : undefined,
                                      },
                                    },
                                  })
                                }
                                placeholder="5"
                                className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                              />
                              <p className="text-xs text-gray-400 mt-1">Leave empty for brand default</p>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Max Amount ($)</label>
                              <input
                                type="number"
                                min="1"
                                value={formData.config.giftCardTile?.maxAmount ?? ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    config: {
                                      ...formData.config,
                                      giftCardTile: {
                                        ...formData.config.giftCardTile!,
                                        maxAmount: e.target.value ? parseInt(e.target.value) : undefined,
                                      },
                                    },
                                  })
                                }
                                placeholder="500"
                                className="w-full text-sm rounded border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                              />
                              <p className="text-xs text-gray-400 mt-1">Leave empty for brand default</p>
                            </div>
                          </div>

                          {/* Allow Custom Amount Toggle */}
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                Allow Custom Amount
                              </label>
                              <p className="text-xs text-gray-500">
                                Let users enter any amount (within min/max)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    giftCardTile: {
                                      ...formData.config.giftCardTile!,
                                      allowCustomAmount: !(formData.config.giftCardTile?.allowCustomAmount ?? true),
                                    },
                                  },
                                })
                              }
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                                (formData.config.giftCardTile?.allowCustomAmount ?? true)
                                  ? "bg-emerald-500"
                                  : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  (formData.config.giftCardTile?.allowCustomAmount ?? true)
                                    ? "translate-x-5"
                                    : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bundle Discounts Configuration */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-purple-500" />
                        Bundle Discounts (Gift Card + Print)
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {formData.config.bundleDiscounts?.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              config: {
                                ...formData.config,
                                bundleDiscounts: {
                                  ...formData.config.bundleDiscounts,
                                  enabled: !(formData.config.bundleDiscounts?.enabled ?? false),
                                  eligibleGiftCards: formData.config.bundleDiscounts?.eligibleGiftCards || [],
                                },
                              },
                            })
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 ${
                            formData.config.bundleDiscounts?.enabled
                              ? "bg-purple-500"
                              : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formData.config.bundleDiscounts?.enabled
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">
                      Configure gift cards that give discounts when purchased with greeting cards or stickers. 
                      This is separate from the Gift Card Tile (standalone purchases).
                    </p>

                    {formData.config.bundleDiscounts?.enabled && (
                      <div className="space-y-4">
                        {/* List of configured bundle gift cards */}
                        {(formData.config.bundleDiscounts?.eligibleGiftCards || []).length > 0 ? (
                          <div className="space-y-3">
                            {formData.config.bundleDiscounts?.eligibleGiftCards.map((card) => (
                              <div 
                                key={card.id} 
                                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200"
                              >
                                {/* Logo */}
                                {card.brandLogo ? (
                                  <img 
                                    src={card.brandLogo} 
                                    alt={card.brandName} 
                                    className="w-12 h-12 rounded-lg object-contain bg-white shadow-sm"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                                    <GiftIcon className="h-6 w-6 text-white" />
                                  </div>
                                )}
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 truncate">{card.brandName}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      card.source === 'tillo' 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {card.source === 'tillo' ? 'Tillo' : 'SmartWish'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                    <span className="flex items-center gap-1">
                                      <GiftIcon className="h-3.5 w-3.5" />
                                      {card.giftCardDiscountPercent}% off gift card
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <PrinterIcon className="h-3.5 w-3.5" />
                                      {card.printDiscountPercent}% off print
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                    {card.appliesTo?.includes('greeting-card') && (
                                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">Cards</span>
                                    )}
                                    {card.appliesTo?.includes('sticker') && (
                                      <span className="px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded">Stickers</span>
                                    )}
                                    {card.minAmount && <span>Min: ${card.minAmount}</span>}
                                    {card.maxAmount && <span>Max: ${card.maxAmount}</span>}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditBundleModal(card)}
                                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBundleGiftCard(card.id)}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <GiftIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No bundle gift cards configured</p>
                            <p className="text-gray-400 text-xs mt-1">Add gift cards to offer bundle discounts</p>
                          </div>
                        )}

                        {/* Add Gift Card Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBundleGiftCard(null);
                            setBundleFormData({
                              source: 'smartwish',
                              giftCardDiscountPercent: 10,
                              printDiscountPercent: 10,
                              appliesTo: ['greeting-card', 'sticker'],
                            });
                            setBundleSearchQuery("");
                            setShowBundleAddModal(true);
                          }}
                          className="w-full py-3 px-4 border-2 border-dashed border-purple-300 rounded-xl text-purple-600 hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <PlusIcon className="h-5 w-5" />
                          Add Bundle Gift Card
                        </button>

                        {/* Add/Edit Bundle Gift Card Modal */}
                        <Transition show={showBundleAddModal} as={Fragment}>
                          <Dialog 
                            as="div" 
                            className="relative z-[60]" 
                            onClose={() => {
                              setShowBundleAddModal(false);
                              setEditingBundleGiftCard(null);
                            }}
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
                              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                                      <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <SparklesIcon className="h-5 w-5 text-purple-500" />
                                        {editingBundleGiftCard ? 'Edit Bundle Gift Card' : 'Add Bundle Gift Card'}
                                      </Dialog.Title>
                                      <p className="text-sm text-gray-600 mt-1">
                                        Configure discounts for this gift card when bundled with prints
                                      </p>
                                    </div>

                                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                      {/* Source Selection */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Gift Card Source</label>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setBundleFormData({ ...bundleFormData, source: 'smartwish', brandId: undefined, brandSlug: undefined, brandName: undefined, brandLogo: undefined })}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                              bundleFormData.source === 'smartwish'
                                                ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                                                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                                            }`}
                                          >
                                            SmartWish Internal
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setBundleFormData({ ...bundleFormData, source: 'tillo', brandId: undefined, brandSlug: undefined, brandName: undefined, brandLogo: undefined })}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                              bundleFormData.source === 'tillo'
                                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                                                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                                            }`}
                                          >
                                            Tillo Marketplace
                                          </button>
                                        </div>
                                      </div>

                                      {/* Brand Selection */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          {bundleFormData.source === 'tillo' ? 'Search Tillo Brand' : 'Select SmartWish Brand'}
                                        </label>
                                        
                                        {bundleFormData.source === 'tillo' ? (
                                          <>
                                            <input
                                              type="text"
                                              value={bundleSearchQuery}
                                              onChange={(e) => setBundleSearchQuery(e.target.value)}
                                              placeholder="Search brands (e.g., Amazon, Starbucks)..."
                                              className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 mb-2"
                                            />
                                            {loadingTilloBrands ? (
                                              <div className="text-center py-4 text-gray-500 text-sm">Loading Tillo brands...</div>
                                            ) : (
                                              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                                                {filteredBundleTilloBrands.map((brand) => (
                                                  <button
                                                    key={brand.slug}
                                                    type="button"
                                                    onClick={() => {
                                                      setBundleFormData({
                                                        ...bundleFormData,
                                                        brandSlug: brand.slug,
                                                        brandName: brand.name,
                                                        brandLogo: brand.logo,
                                                        minAmount: brand.minAmount,
                                                        maxAmount: brand.maxAmount,
                                                      });
                                                    }}
                                                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                                      bundleFormData.brandSlug === brand.slug ? 'bg-purple-50' : ''
                                                    }`}
                                                  >
                                                    {brand.logo ? (
                                                      <img src={brand.logo} alt={brand.name} className="w-8 h-8 rounded object-contain" />
                                                    ) : (
                                                      <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                                                        <GiftIcon className="h-4 w-4 text-gray-400" />
                                                      </div>
                                                    )}
                                                    <div className="flex-1 text-left">
                                                      <div className="font-medium text-gray-900 text-sm">{brand.name}</div>
                                                      <div className="text-xs text-gray-500">{brand.slug}</div>
                                                    </div>
                                                    {bundleFormData.brandSlug === brand.slug && (
                                                      <CheckIcon className="h-5 w-5 text-purple-600" />
                                                    )}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <select
                                            value={bundleFormData.brandId || ''}
                                            onChange={(e) => {
                                              const selectedBrand = giftCardBrands.find(b => b.id === e.target.value);
                                              if (selectedBrand) {
                                                setBundleFormData({
                                                  ...bundleFormData,
                                                  brandId: selectedBrand.id,
                                                  brandName: selectedBrand.name,
                                                  brandLogo: selectedBrand.logo_url,
                                                });
                                              }
                                            }}
                                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                                          >
                                            <option value="">Select a brand...</option>
                                            {loadingBrands ? (
                                              <option disabled>Loading...</option>
                                            ) : (
                                              giftCardBrands.map((brand) => (
                                                <option key={brand.id} value={brand.id}>
                                                  {brand.name}
                                                </option>
                                              ))
                                            )}
                                          </select>
                                        )}

                                        {/* Selected brand preview */}
                                        {bundleFormData.brandName && (
                                          <div className="mt-3 p-3 bg-purple-50 rounded-lg flex items-center gap-3">
                                            {bundleFormData.brandLogo ? (
                                              <img src={bundleFormData.brandLogo} alt={bundleFormData.brandName} className="w-10 h-10 rounded-lg object-contain bg-white shadow-sm" />
                                            ) : (
                                              <div className="w-10 h-10 rounded-lg bg-purple-200 flex items-center justify-center">
                                                <GiftIcon className="h-5 w-5 text-purple-600" />
                                              </div>
                                            )}
                                            <div>
                                              <div className="font-medium text-gray-900">{bundleFormData.brandName}</div>
                                              <div className="text-xs text-gray-500">
                                                {bundleFormData.source === 'tillo' ? bundleFormData.brandSlug : bundleFormData.brandId}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Discount Settings */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Gift Card Discount %
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={bundleFormData.giftCardDiscountPercent || 0}
                                            onChange={(e) => setBundleFormData({ ...bundleFormData, giftCardDiscountPercent: parseInt(e.target.value) || 0 })}
                                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                                          />
                                          <p className="text-xs text-gray-500 mt-1">Discount on gift card price</p>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Print Discount %
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={bundleFormData.printDiscountPercent || 0}
                                            onChange={(e) => setBundleFormData({ ...bundleFormData, printDiscountPercent: parseInt(e.target.value) || 0 })}
                                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                                          />
                                          <p className="text-xs text-gray-500 mt-1">Discount on print cost</p>
                                        </div>
                                      </div>

                                      {/* Amount Limits */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Min Amount ($)
                                          </label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={bundleFormData.minAmount || ''}
                                            onChange={(e) => setBundleFormData({ ...bundleFormData, minAmount: e.target.value ? parseInt(e.target.value) : undefined })}
                                            placeholder="5"
                                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Max Amount ($)
                                          </label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={bundleFormData.maxAmount || ''}
                                            onChange={(e) => setBundleFormData({ ...bundleFormData, maxAmount: e.target.value ? parseInt(e.target.value) : undefined })}
                                            placeholder="500"
                                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                                          />
                                        </div>
                                      </div>

                                      {/* Applies To */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Applies To</label>
                                        <div className="flex gap-4">
                                          <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={bundleFormData.appliesTo?.includes('greeting-card') ?? true}
                                              onChange={(e) => {
                                                const current = bundleFormData.appliesTo || ['greeting-card', 'sticker'];
                                                const updated = e.target.checked
                                                  ? [...new Set([...current, 'greeting-card' as const])]
                                                  : current.filter(t => t !== 'greeting-card');
                                                setBundleFormData({ ...bundleFormData, appliesTo: updated });
                                              }}
                                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700">Greeting Cards</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={bundleFormData.appliesTo?.includes('sticker') ?? true}
                                              onChange={(e) => {
                                                const current = bundleFormData.appliesTo || ['greeting-card', 'sticker'];
                                                const updated = e.target.checked
                                                  ? [...new Set([...current, 'sticker' as const])]
                                                  : current.filter(t => t !== 'sticker');
                                                setBundleFormData({ ...bundleFormData, appliesTo: updated });
                                              }}
                                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700">Stickers</span>
                                          </label>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowBundleAddModal(false);
                                          setEditingBundleGiftCard(null);
                                        }}
                                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={editingBundleGiftCard ? handleUpdateBundleGiftCard : handleAddBundleGiftCard}
                                        disabled={!bundleFormData.brandName}
                                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {editingBundleGiftCard ? 'Update' : 'Add Gift Card'}
                                      </button>
                                    </div>
                                  </Dialog.Panel>
                                </Transition.Child>
                              </div>
                            </div>
                          </Dialog>
                        </Transition>
                      </div>
                    )}
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
                        ? "Create Kiosk"
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
