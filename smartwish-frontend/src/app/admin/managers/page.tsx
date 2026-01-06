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
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface Manager {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  assignedKiosksCount: number;
}

interface ManagerWithKiosks extends Manager {
  assignedKiosks?: Array<{
    id: string;
    kioskId: string;
    name: string | null;
    storeId: string | null;
    assignedAt: string;
  }>;
}

export default function ManagersAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ManagerWithKiosks | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const [deleting, setDeleting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/managers");
    }
  }, [status, router]);

  // Fetch managers
  useEffect(() => {
    if (status === "authenticated") {
      fetchManagers();
    }
  }, [status]);

  const fetchManagers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/managers");
      if (!response.ok) {
        throw new Error("Failed to fetch managers");
      }
      const data = await response.json();
      setManagers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching managers:", err);
      setError(err instanceof Error ? err.message : "Failed to load managers");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      alert("Email and name are required");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, name: inviteName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to invite manager");
      }

      const newManager = await response.json();
      
      // Show the invite token
      setInviteResult({
        token: newManager.inviteToken,
        email: newManager.email,
      });
      
      // Refresh the list
      fetchManagers();
    } catch (err) {
      console.error("Error inviting manager:", err);
      alert(err instanceof Error ? err.message : "Failed to invite manager");
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedManager) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/managers/${selectedManager.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete manager");
      }

      setManagers(managers.filter((m) => m.id !== selectedManager.id));
      setShowDeleteModal(false);
      setSelectedManager(null);
    } catch (err) {
      console.error("Error deleting manager:", err);
      alert(err instanceof Error ? err.message : "Failed to delete manager");
    } finally {
      setDeleting(false);
    }
  };

  const viewManagerDetails = async (manager: Manager) => {
    try {
      const response = await fetch(`/api/admin/managers/${manager.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch manager details");
      }
      const data = await response.json();
      setSelectedManager(data);
      setShowDetailsModal(true);
    } catch (err) {
      console.error("Error fetching manager details:", err);
      alert(err instanceof Error ? err.message : "Failed to load manager details");
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

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteResult(null);
    setShowInviteModal(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 ring-green-600/20";
      case "pending_verification":
        return "bg-yellow-50 text-yellow-700 ring-yellow-600/20";
      case "inactive":
        return "bg-gray-50 text-gray-600 ring-gray-500/10";
      default:
        return "bg-gray-50 text-gray-600 ring-gray-500/10";
    }
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
              <h1 className="text-2xl font-bold text-gray-900">Manager Management</h1>
              <p className="mt-1 text-sm text-gray-500">
                Invite and manage store managers who can activate kiosks
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Invite Manager
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error loading managers</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchManagers}
              className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : managers.length === 0 ? (
          <div className="text-center py-12">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No managers</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by inviting your first store manager.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <PlusIcon className="h-5 w-5" />
                Invite Manager
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Manager
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Assigned Kiosks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {managers.map((manager) => (
                  <tr key={manager.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{manager.name || "Unnamed"}</p>
                          <p className="text-sm text-gray-500">{manager.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBadge(
                          manager.status
                        )}`}
                      >
                        {manager.status === "pending_verification" ? "Pending" : manager.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <ComputerDesktopIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{manager.assignedKiosksCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {manager.lastLoginAt
                        ? new Date(manager.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => viewManagerDetails(manager)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedManager(manager);
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

      {/* Invite Modal */}
      <Transition appear show={showInviteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !inviting && resetInviteForm()}>
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
                    /* Success State */
                    <div className="p-6">
                      <div className="text-center mb-6">
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                          <CheckIcon className="w-6 h-6 text-green-600" />
                        </div>
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Manager Invited
                        </Dialog.Title>
                        <p className="mt-2 text-sm text-gray-600">
                          An invitation has been created for <strong>{inviteResult.email}</strong>
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Invite Token (share with manager)
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-white p-2 rounded border border-gray-200 break-all">
                            {inviteResult.token}
                          </code>
                          <button
                            onClick={() => copyToClipboard(inviteResult.token)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            {copiedToken ? (
                              <CheckIcon className="w-5 h-5" />
                            ) : (
                              <ClipboardDocumentIcon className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          The manager will use this token to set up their password at{" "}
                          <code>/set-password?token=...</code>
                        </p>
                      </div>

                      <button
                        onClick={resetInviteForm}
                        className="w-full py-2.5 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    /* Invite Form */
                    <>
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Invite Manager
                        </Dialog.Title>
                        <button
                          onClick={resetInviteForm}
                          className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>

                      <form onSubmit={handleInvite} className="p-6 space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            required
                            placeholder="John Smith"
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              required
                              placeholder="manager@example.com"
                              className="w-full pl-10 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            An invite token will be generated for this email
                          </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={resetInviteForm}
                            className="flex-1 py-2.5 px-4 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={inviting}
                            className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                          >
                            {inviting ? "Inviting..." : "Send Invite"}
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
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Delete Manager
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500">
                        Are you sure you want to delete{" "}
                        <strong>{selectedManager?.name || selectedManager?.email}</strong>? This will
                        also remove all their kiosk assignments. This action cannot be undone.
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
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Manager Details Modal */}
      <Transition appear show={showDetailsModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedManager(null);
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
                      Manager Details
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedManager(null);
                      }}
                      className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {selectedManager && (
                    <div className="p-6 space-y-6">
                      {/* Manager Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                          <UserIcon className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {selectedManager.name || "Unnamed"}
                          </h3>
                          <p className="text-gray-500">{selectedManager.email}</p>
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBadge(
                              selectedManager.status
                            )}`}
                          >
                            {selectedManager.status === "pending_verification"
                              ? "Pending Verification"
                              : selectedManager.status}
                          </span>
                        </div>
                      </div>

                      {/* Assigned Kiosks */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Assigned Kiosks ({selectedManager.assignedKiosks?.length || 0})
                        </h4>
                        {selectedManager.assignedKiosks &&
                        selectedManager.assignedKiosks.length > 0 ? (
                          <div className="space-y-2">
                            {selectedManager.assignedKiosks.map((kiosk) => (
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
                                <p className="text-xs text-gray-400">
                                  {new Date(kiosk.assignedAt).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No kiosks assigned yet</p>
                        )}
                      </div>

                      {/* Timestamps */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 text-sm">
                        <div>
                          <p className="text-gray-500">Created</p>
                          <p className="font-medium text-gray-900">
                            {new Date(selectedManager.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Last Login</p>
                          <p className="font-medium text-gray-900">
                            {selectedManager.lastLoginAt
                              ? new Date(selectedManager.lastLoginAt).toLocaleDateString()
                              : "Never"}
                          </p>
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
