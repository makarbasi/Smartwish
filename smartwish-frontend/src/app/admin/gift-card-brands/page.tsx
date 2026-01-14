"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  GiftIcon,
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  ClockIcon,
  StarIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface GiftCardBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string;
  min_amount: number;
  max_amount: number;
  min_redemption_amount: number;
  expiry_months: number;
  is_smartwish_brand: boolean;
  is_promoted: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_FORM: Omit<GiftCardBrand, 'id' | 'slug' | 'created_at' | 'updated_at'> = {
  name: "",
  description: "",
  logo_url: "",
  min_amount: 10,
  max_amount: 500,
  min_redemption_amount: 0.01,
  expiry_months: 12,
  is_smartwish_brand: false,
  is_promoted: false,
  is_active: true,
};

export default function GiftCardBrandsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [brands, setBrands] = useState<GiftCardBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<GiftCardBrand | null>(null);

  // Form state
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/gift-card-brands");
    }
  }, [status, router]);

  // Fetch brands
  useEffect(() => {
    if (status === "authenticated") {
      fetchBrands();
    }
  }, [status]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/gift-card-brands?includeInactive=true");
      if (!response.ok) {
        throw new Error("Failed to fetch gift card brands");
      }
      const data = await response.json();
      setBrands(data.data || []);
    } catch (err) {
      console.error("Error fetching brands:", err);
      setError(err instanceof Error ? err.message : "Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  // Transform snake_case form data to camelCase for backend
  const transformToCamelCase = (data: typeof formData) => ({
    name: data.name,
    description: data.description,
    logoUrl: data.logo_url,
    minAmount: data.min_amount,
    maxAmount: data.max_amount,
    expiryMonths: data.expiry_months,
    isSmartWishBrand: data.is_smartwish_brand,
    isPromoted: data.is_promoted,
    isActive: data.is_active,
  });

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.logo_url.trim()) {
      alert("Name and Logo URL are required");
      return;
    }

    if (formData.min_amount > formData.max_amount) {
      alert("Min amount cannot be greater than max amount");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/gift-card-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transformToCamelCase(formData)),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create brand");
      }

      const result = await response.json();
      setBrands([result.data, ...brands]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error("Error creating brand:", err);
      alert(err instanceof Error ? err.message : "Failed to create brand");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedBrand) return;

    if (!formData.name.trim() || !formData.logo_url.trim()) {
      alert("Name and Logo URL are required");
      return;
    }

    if (formData.min_amount > formData.max_amount) {
      alert("Min amount cannot be greater than max amount");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/gift-card-brands/${selectedBrand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transformToCamelCase(formData)),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update brand");
      }

      const result = await response.json();
      setBrands(brands.map((b) => (b.id === selectedBrand.id ? result.data : b)));
      setShowEditModal(false);
      setSelectedBrand(null);
      resetForm();
    } catch (err) {
      console.error("Error updating brand:", err);
      alert(err instanceof Error ? err.message : "Failed to update brand");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBrand) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/gift-card-brands/${selectedBrand.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to deactivate brand");
      }

      // Update local state to show brand as inactive
      setBrands(brands.map((b) => 
        b.id === selectedBrand.id ? { ...b, is_active: false } : b
      ));
      setShowDeleteModal(false);
      setSelectedBrand(null);
    } catch (err) {
      console.error("Error deactivating brand:", err);
      alert(err instanceof Error ? err.message : "Failed to deactivate brand");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
  };

  const openEditModal = (brand: GiftCardBrand) => {
    setSelectedBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || "",
      logo_url: brand.logo_url,
      min_amount: brand.min_amount,
      max_amount: brand.max_amount,
      min_redemption_amount: brand.min_redemption_amount,
      expiry_months: brand.expiry_months,
      is_smartwish_brand: brand.is_smartwish_brand,
      is_promoted: brand.is_promoted,
      is_active: brand.is_active,
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
              <h1 className="text-2xl font-bold text-gray-900">Gift Card Brands</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and manage gift card brands that customers can purchase
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
              Add Brand
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error loading brands</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchBrands}
              className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-12">
            <GiftIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No gift card brands</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first gift card brand.
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
                Add Brand
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
                  !brand.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="p-6">
                  {/* Header with logo */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = '<span class="text-2xl">🎁</span>';
                            }}
                          />
                        ) : (
                          <GiftIcon className="h-8 w-8 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {brand.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {brand.slug}
                        </p>
                      </div>
                    </div>
                    {/* Status badges */}
                    <div className="flex flex-col gap-1">
                      {!brand.is_active && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                      {brand.is_promoted && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          <StarIcon className="w-3 h-3 mr-1" />
                          Promoted
                        </span>
                      )}
                      {brand.is_smartwish_brand && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                          <SparklesIcon className="w-3 h-3 mr-1" />
                          SmartWish
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {brand.description && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                      {brand.description}
                    </p>
                  )}

                  {/* Details */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        ${brand.min_amount} - ${brand.max_amount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        {brand.expiry_months} months
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(brand)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      Edit
                    </button>
                    {brand.is_active && (
                      <button
                        onClick={() => {
                          setSelectedBrand(brand);
                          setShowDeleteModal(true);
                        }}
                        className="inline-flex items-center justify-center rounded-lg bg-white p-2 text-red-600 ring-1 ring-inset ring-gray-300 hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Timestamp */}
                  <p className="mt-3 text-xs text-gray-400">
                    Created: {new Date(brand.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <BrandFormModal
        open={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedBrand(null);
          resetForm();
        }}
        title={showCreateModal ? "Create Gift Card Brand" : `Edit: ${selectedBrand?.name}`}
        formData={formData}
        setFormData={setFormData}
        onSubmit={showCreateModal ? handleCreate : handleUpdate}
        saving={saving}
        isCreate={showCreateModal}
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
                    Deactivate Brand
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    Are you sure you want to deactivate &quot;{selectedBrand?.name}&quot;?
                    This will hide it from the marketplace but existing cards will still work.
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
                      {saving ? "Deactivating..." : "Deactivate"}
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

// Brand Form Modal Component
function BrandFormModal({
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
  formData: typeof DEFAULT_FORM;
  setFormData: (data: typeof DEFAULT_FORM) => void;
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

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Basic Information
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Brand Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., SmartWish Gift Card"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Logo URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={formData.logo_url}
                        onChange={(e) =>
                          setFormData({ ...formData, logo_url: e.target.value })
                        }
                        placeholder="https://example.com/logo.png"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      {formData.logo_url && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                            <img
                              src={formData.logo_url}
                              alt="Preview"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">Logo preview</span>
                        </div>
                      )}
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
                        placeholder="Optional description for this gift card brand"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Amount Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Amount Settings
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Minimum Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={formData.min_amount}
                            onChange={(e) =>
                              setFormData({ ...formData, min_amount: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Maximum Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={formData.max_amount}
                            onChange={(e) =>
                              setFormData({ ...formData, max_amount: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Redemption Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={formData.min_redemption_amount}
                          onChange={(e) =>
                            setFormData({ ...formData, min_redemption_amount: parseFloat(e.target.value) || 0.01 })
                          }
                          className="w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum amount that can be redeemed per transaction
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expiry (Months)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={formData.expiry_months}
                        onChange={(e) =>
                          setFormData({ ...formData, expiry_months: parseInt(e.target.value) || 12 })
                        }
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Number of months until cards expire after purchase
                      </p>
                    </div>
                  </div>

                  {/* Flags */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Settings
                    </h4>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          SmartWish Brand
                        </label>
                        <p className="text-xs text-gray-500">
                          Can be used to pay for greeting cards &amp; stickers
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            is_smartwish_brand: !formData.is_smartwish_brand,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.is_smartwish_brand
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.is_smartwish_brand
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Promoted
                        </label>
                        <p className="text-xs text-gray-500">
                          Show in featured section of Gift Hub
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            is_promoted: !formData.is_promoted,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.is_promoted
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.is_promoted
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Active
                        </label>
                        <p className="text-xs text-gray-500">
                          Available for purchase in marketplace
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            is_active: !formData.is_active,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          formData.is_active
                            ? "bg-indigo-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.is_active
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
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
                        ? "Create Brand"
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
