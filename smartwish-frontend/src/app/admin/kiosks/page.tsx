"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
} from "@heroicons/react/24/outline";
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

type KioskConfig = {
  theme?: string;
  featuredTemplateIds?: string[];
  micEnabled?: boolean;
  giftCardRibbonEnabled?: boolean; // Show gift card marketplace ribbon (default true)
  greetingCardsEnabled?: boolean; // Enable greeting cards tile on kiosk home (default true)
  stickersEnabled?: boolean; // Enable stickers tile on kiosk home (default true)
  ads?: {
    playlist?: Array<{ url: string; duration?: number; weight?: number }>;
  };
  printerProfile?: string;
  printerName?: string;
  printerIP?: string; // Printer IP address for IPP printing
  printerTrays?: PrinterTray[];
  revenueSharePercent?: number; // Store owner's share of net profit (default 30%)
  virtualKeyboard?: {
    enabled: boolean; // Master toggle - if false, no page shrinking, no keyboard
    showBuiltInKeyboard: boolean; // If enabled=true but this is false, shrink page but use Windows touch keyboard
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
  micEnabled: true,
  giftCardRibbonEnabled: true, // Show gift card marketplace ribbon by default
  greetingCardsEnabled: true, // Enable greeting cards tile by default
  stickersEnabled: true, // Enable stickers tile by default
  ads: { playlist: [] },
  printerProfile: "default",
  printerName: "HP OfficeJet Pro 9130e Series [HPIE4B65B]",
  printerIP: "192.168.1.239", // Default printer IP for IPP printing
  printerTrays: [
    { trayNumber: 1, trayName: "Tray 1", paperType: "greeting-card", paperSize: "letter" },
    { trayNumber: 2, trayName: "Tray 2", paperType: "sticker", paperSize: "letter" },
  ],
  revenueSharePercent: 30, // Default 30% of net profit goes to store owner
  virtualKeyboard: {
    enabled: true, // Enable virtual keyboard support by default
    showBuiltInKeyboard: true, // Show our built-in virtual keyboard by default
  },
};

export default function KiosksAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {kiosks.map((kiosk) => (
              <div
                key={kiosk.id}
                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <ComputerDesktopIcon className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {kiosk.name || kiosk.kioskId}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {kiosk.storeId || "No store assigned"}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      v{kiosk.version}
                    </span>
                  </div>

                  {/* Config summary */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <SwatchIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Theme: {kiosk.config?.theme || "default"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MicrophoneIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Mic: {kiosk.config?.micEnabled !== false ? "On" : "Off"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <GiftIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Gift Cards: {kiosk.config?.giftCardRibbonEnabled !== false ? "On" : "Off"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Cards: {kiosk.config?.greetingCardsEnabled !== false ? "On" : "Off"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <SparklesIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Stickers: {kiosk.config?.stickersEnabled !== false ? "On" : "Off"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <PrinterIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Printer: {kiosk.config?.printerName || "Not set"}
                        {kiosk.config?.printerIP && (
                          <span className="text-gray-500"> ({kiosk.config.printerIP})</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DocumentIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Trays: {kiosk.config?.printerTrays?.length || 0} configured
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FilmIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Ads: {kiosk.config?.ads?.playlist?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        API Key
                      </span>
                      <button
                        onClick={() => kiosk.apiKey && copyToClipboard(kiosk.apiKey, kiosk.kioskId)}
                        disabled={!kiosk.apiKey}
                        className="text-xs text-indigo-600 hover:text-indigo-500 font-medium inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {copiedKey === kiosk.kioskId ? (
                          <>
                            <CheckIcon className="h-3.5 w-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1 font-mono text-sm text-gray-700 break-all">
                      {kiosk.apiKey ? `${kiosk.apiKey.substring(0, 20)}...` : "No API key"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 space-y-2">
                    {/* Manager assignment button */}
                    <button
                      onClick={() => openManagersModal(kiosk)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100 transition-colors"
                    >
                      <UserGroupIcon className="h-4 w-4" />
                      Manage Managers
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(kiosk)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleRotateKey(kiosk)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        <KeyIcon className="h-4 w-4" />
                        Rotate Key
                      </button>
                      <button
                        onClick={() => {
                          setSelectedKiosk(kiosk);
                          setShowDeleteModal(true);
                        }}
                        className="inline-flex items-center justify-center rounded-lg bg-white p-2 text-red-600 ring-1 ring-inset ring-gray-300 hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <p className="mt-3 text-xs text-gray-400">
                    Updated: {new Date(kiosk.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
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
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.config.micEnabled
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.config.micEnabled
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
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.config.giftCardRibbonEnabled !== false
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.config.giftCardRibbonEnabled !== false
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
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.config.greetingCardsEnabled !== false
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.config.greetingCardsEnabled !== false
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
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.config.stickersEnabled !== false
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.config.stickersEnabled !== false
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Virtual Keyboard Settings */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h5 className="text-sm font-semibold text-gray-800 mb-3">
                        ⌨️ Virtual Keyboard
                      </h5>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Virtual Keyboard Support
                          </label>
                          <p className="text-xs text-gray-500">
                            Enable keyboard support and page shrinking for input fields
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              config: {
                                ...formData.config,
                                virtualKeyboard: {
                                  ...formData.config.virtualKeyboard,
                                  enabled: !(formData.config.virtualKeyboard?.enabled !== false),
                                  showBuiltInKeyboard: formData.config.virtualKeyboard?.showBuiltInKeyboard !== false,
                                },
                              },
                            })
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                            formData.config.virtualKeyboard?.enabled !== false
                              ? "bg-indigo-600"
                              : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formData.config.virtualKeyboard?.enabled !== false
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Sub-option: Show Built-in Keyboard (only visible when main toggle is ON) */}
                      {formData.config.virtualKeyboard?.enabled !== false && (
                        <div className="flex items-center justify-between ml-4 pl-4 border-l-2 border-gray-200">
                          <div>
                            <label className="text-sm font-medium text-gray-700">
                              Show Built-in Keyboard
                            </label>
                            <p className="text-xs text-gray-500">
                              Show SmartWish keyboard. If off, use Windows Touch Keyboard instead.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                config: {
                                  ...formData.config,
                                  virtualKeyboard: {
                                    ...formData.config.virtualKeyboard,
                                    enabled: true,
                                    showBuiltInKeyboard: !(formData.config.virtualKeyboard?.showBuiltInKeyboard !== false),
                                  },
                                },
                              })
                            }
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                              formData.config.virtualKeyboard?.showBuiltInKeyboard !== false
                                ? "bg-indigo-600"
                                : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                formData.config.virtualKeyboard?.showBuiltInKeyboard !== false
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Printer Name
                      </label>
                      <input
                        type="text"
                        list="printer-suggestions"
                        value={formData.config.printerName || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              printerName: e.target.value,
                            },
                          })
                        }
                        placeholder="Enter printer name or select from list"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <datalist id="printer-suggestions">
                        <option value="HP OfficeJet Pro 9130e Series [HPIE4B65B]" />
                        <option value="EPSON ET-15000 Series" />
                        <option value="HP Smart Tank 7600 series" />
                        <option value="Brother MFC-J4335DW" />
                        <option value="Canon PIXMA TR8620" />
                      </datalist>
                      <p className="mt-1 text-xs text-gray-500">
                        Type the exact printer name as it appears in your system, or select from suggestions
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Printer IP Address
                      </label>
                      <input
                        type="text"
                        value={formData.config.printerIP || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              printerIP: e.target.value,
                            },
                          })
                        }
                        placeholder="192.168.1.239"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        IP address of the printer for IPP (Internet Printing Protocol) printing. Used for sticker printing.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Featured Template IDs
                      </label>
                      <input
                        type="text"
                        value={formData.config.featuredTemplateIds?.join(", ") || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              featuredTemplateIds: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        placeholder="template-1, template-2"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Comma-separated list of template IDs to feature
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
