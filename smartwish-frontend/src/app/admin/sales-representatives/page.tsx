"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  ComputerDesktopIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface SalesRepresentative {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  assignedKiosksCount?: number;
}

interface SalesRepWithDetails extends SalesRepresentative {
  assignedKiosks?: Array<{
    id: string;
    kioskId: string;
    name: string | null;
    storeId: string | null;
  }>;
}

interface Kiosk {
  id: string;
  kioskId: string;
  name: string | null;
  storeId: string | null;
  salesRepresentativeId: string | null;
}

export default function SalesRepresentativesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [salesReps, setSalesReps] = useState<SalesRepresentative[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRep, setSelectedRep] = useState<SalesRepWithDetails | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    commissionPercent: 10,
  });
  const [submitting, setSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Assign kiosk state
  const [selectedKioskId, setSelectedKioskId] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/sales-representatives");
    }
  }, [status, router]);

  // Fetch data
  useEffect(() => {
    if (status === "authenticated") {
      fetchSalesReps();
      fetchKiosks();
    }
  }, [status]);

  const fetchSalesReps = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/sales-representatives");
      if (!response.ok) throw new Error("Failed to fetch sales representatives");
      const data = await response.json();
      setSalesReps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching sales representatives:", err);
      setError(err instanceof Error ? err.message : "Failed to load sales representatives");
    } finally {
      setLoading(false);
    }
  };

  const fetchKiosks = async () => {
    try {
      const response = await fetch("/api/admin/kiosks");
      if (!response.ok) throw new Error("Failed to fetch kiosks");
      const data = await response.json();
      setKiosks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching kiosks:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      alert("First name, last name, and email are required");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/sales-representatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sales representative");
      }

      const newRep = await response.json();
      
      if (newRep.inviteToken) {
        setInviteResult({
          token: newRep.inviteToken,
          email: newRep.email,
        });
      } else {
        resetForm();
        fetchSalesReps();
      }
    } catch (err) {
      console.error("Error creating sales representative:", err);
      alert(err instanceof Error ? err.message : "Failed to create sales representative");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRep) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/sales-representatives/${selectedRep.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sales representative");
      }

      setSalesReps(salesReps.filter((r) => r.id !== selectedRep.id));
      setShowDeleteModal(false);
      setSelectedRep(null);
    } catch (err) {
      console.error("Error deleting sales representative:", err);
      alert(err instanceof Error ? err.message : "Failed to delete sales representative");
    } finally {
      setDeleting(false);
    }
  };

  const handleAssignKiosk = async () => {
    if (!selectedRep || !selectedKioskId) return;

    try {
      const response = await fetch(
        `/api/admin/sales-representatives/${selectedRep.id}/assign-kiosk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kioskId: selectedKioskId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign kiosk");
      }

      setShowAssignModal(false);
      setSelectedKioskId("");
      fetchSalesReps();
      fetchKiosks();
      
      // Refresh details if viewing
      if (showDetailsModal && selectedRep) {
        viewRepDetails(selectedRep);
      }
    } catch (err) {
      console.error("Error assigning kiosk:", err);
      alert(err instanceof Error ? err.message : "Failed to assign kiosk");
    }
  };

  const viewRepDetails = async (rep: SalesRepresentative) => {
    try {
      const response = await fetch(`/api/admin/sales-representatives/${rep.id}`);
      if (!response.ok) throw new Error("Failed to fetch details");
      const data = await response.json();
      setSelectedRep(data);
      setShowDetailsModal(true);
    } catch (err) {
      console.error("Error fetching details:", err);
      alert(err instanceof Error ? err.message : "Failed to load details");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      commissionPercent: 10,
    });
    setInviteResult(null);
    setShowCreateModal(false);
  };

  // Get unassigned kiosks
  const unassignedKiosks = kiosks.filter((k) => !k.salesRepresentativeId);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
              <h1 className="text-2xl font-bold text-gray-900">Sales Representatives</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage sales representatives who earn commissions on kiosk sales
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Sales Rep
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error loading sales representatives</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchSalesReps}
              className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : salesReps.length === 0 ? (
          <div className="text-center py-12">
            <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No sales representatives</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add your first sales representative to start tracking commissions.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                <PlusIcon className="h-5 w-5" />
                Add Sales Rep
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Sales Rep
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Assigned Kiosks
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salesReps.map((rep) => (
                  <tr key={rep.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CurrencyDollarIcon className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {rep.firstName} {rep.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{rep.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700">
                        {rep.commissionPercent}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          rep.isActive
                            ? "bg-green-50 text-green-700 ring-green-600/20"
                            : "bg-gray-50 text-gray-600 ring-gray-500/10"
                        }`}
                      >
                        {rep.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <ComputerDesktopIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{rep.assignedKiosksCount || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => viewRepDetails(rep)}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-500"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRep(rep);
                            setShowAssignModal(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Assign Kiosk"
                        >
                          <ComputerDesktopIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRep(rep);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Transition appear show={showCreateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !submitting && resetForm()}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  {inviteResult ? (
                    <div className="p-6">
                      <div className="text-center mb-6">
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                          <CheckIcon className="w-6 h-6 text-green-600" />
                        </div>
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Sales Rep Created
                        </Dialog.Title>
                        <p className="mt-2 text-sm text-gray-600">
                          An invitation has been created for <strong>{inviteResult.email}</strong>
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Invite Token
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-white p-2 rounded border border-gray-200 break-all">
                            {inviteResult.token}
                          </code>
                          <button
                            onClick={() => copyToClipboard(inviteResult.token)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            {copiedToken ? (
                              <CheckIcon className="w-5 h-5" />
                            ) : (
                              <ClipboardDocumentIcon className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          resetForm();
                          fetchSalesReps();
                        }}
                        className="w-full py-2.5 px-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Add Sales Representative
                        </Dialog.Title>
                        <button
                          onClick={resetForm}
                          className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>

                      <form onSubmit={handleCreate} className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              First Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.firstName}
                              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                              required
                              placeholder="John"
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Last Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.lastName}
                              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                              required
                              placeholder="Doe"
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                              placeholder="sales@example.com"
                              className="w-full pl-10 rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="(555) 123-4567"
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Commission Rate (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={formData.commissionPercent}
                            onChange={(e) => setFormData({ ...formData, commissionPercent: parseFloat(e.target.value) || 0 })}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Percentage of net revenue this sales rep earns
                          </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={resetForm}
                            className="flex-1 py-2.5 px-4 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-2.5 px-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                          >
                            {submitting ? "Creating..." : "Create"}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
      <Transition appear show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteModal(false)}>
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
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Deactivate Sales Rep
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500">
                        Are you sure you want to deactivate{" "}
                        <strong>{selectedRep?.firstName} {selectedRep?.lastName}</strong>? 
                        They will be unassigned from all kiosks.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "Deactivating..." : "Deactivate"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Assign Kiosk Modal */}
      <Transition appear show={showAssignModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAssignModal(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Assign Kiosk to {selectedRep?.firstName}
                    </Dialog.Title>
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6">
                    {unassignedKiosks.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        All kiosks are already assigned to sales representatives.
                      </p>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select a Kiosk
                        </label>
                        <select
                          value={selectedKioskId}
                          onChange={(e) => setSelectedKioskId(e.target.value)}
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                        >
                          <option value="">Choose a kiosk...</option>
                          {unassignedKiosks.map((kiosk) => (
                            <option key={kiosk.id} value={kiosk.kioskId}>
                              {kiosk.name || kiosk.kioskId} {kiosk.storeId && `(${kiosk.storeId})`}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setShowAssignModal(false)}
                        className="flex-1 py-2.5 px-4 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAssignKiosk}
                        disabled={!selectedKioskId}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Details Modal */}
      <Transition appear show={showDetailsModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRep(null);
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
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Sales Rep Details
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedRep(null);
                      }}
                      className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {selectedRep && (
                    <div className="p-6 space-y-6">
                      {/* Rep Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CurrencyDollarIcon className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {selectedRep.firstName} {selectedRep.lastName}
                          </h3>
                          <p className="text-gray-500">{selectedRep.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                selectedRep.isActive
                                  ? "bg-green-50 text-green-700 ring-green-600/20"
                                  : "bg-gray-50 text-gray-600 ring-gray-500/10"
                              }`}
                            >
                              {selectedRep.isActive ? "Active" : "Inactive"}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              {selectedRep.commissionPercent}% Commission
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Assigned Kiosks */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-900">
                            Assigned Kiosks ({selectedRep.assignedKiosks?.length || 0})
                          </h4>
                          <button
                            onClick={() => setShowAssignModal(true)}
                            className="text-sm text-emerald-600 hover:text-emerald-500 font-medium"
                          >
                            + Assign Kiosk
                          </button>
                        </div>
                        {selectedRep.assignedKiosks && selectedRep.assignedKiosks.length > 0 ? (
                          <div className="space-y-2">
                            {selectedRep.assignedKiosks.map((kiosk) => (
                              <div
                                key={kiosk.id}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                              >
                                <ComputerDesktopIcon className="w-5 h-5 text-gray-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">
                                    {kiosk.name || kiosk.kioskId}
                                  </p>
                                  {kiosk.storeId && (
                                    <p className="text-xs text-gray-500">{kiosk.storeId}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No kiosks assigned yet</p>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Contact Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Phone</p>
                            <p className="font-medium text-gray-900">{selectedRep.phone || "Not provided"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Created</p>
                            <p className="font-medium text-gray-900">
                              {new Date(selectedRep.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
