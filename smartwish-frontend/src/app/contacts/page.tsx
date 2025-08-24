"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  PlusIcon,
  ChevronDownIcon,
  PhotoIcon,
} from "@heroicons/react/20/solid";
import {
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Dialog,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { EllipsisVerticalIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import useSWR, { mutate } from "swr";
import Sidebar from "@/components/Sidebar";
import { Contact, ContactFormData, ContactsResponse } from "@/types/contact";
import {
  DynamicRouter,
  authGet,
  deleteRequest,
  postRequest,
  putRequest,
} from "@/utils/request_utils";

// Helper to get full name
const getFullName = (contact: Contact) =>
  `${contact.firstName} ${contact.lastName}`.trim();

// Helper to get avatar URL or initials
const getContactAvatar = (contact: Contact) => {
  // For now, we'll use initials since backend doesn't store avatars yet
  return {
    type: "initials" as const,
    value: (
      contact.firstName.charAt(0) + (contact.lastName?.charAt(0) || "")
    ).toUpperCase(),
  };
};

const relationshipOptions = [
  "Family",
  "Friend",
  "Colleague",
  "Business",
  "Acquaintance",
  "Other",
];

// Authenticated fetcher using request utils
const createAuthenticatedFetcher =
  (session: any) =>
  async (url: string): Promise<ContactsResponse> => {
    try {
      console.log("🔍 Fetching contacts from:", url);
      console.log("🔐 Session exists:", !!session);

      if (!session?.user) {
        throw new Error("No authenticated session");
      }

      const response = await authGet<any>(url, session);
      console.log("✅ Contacts fetched successfully (raw):", response);

      // Normalize several possible API shapes:
      // 1) Raw array: [{...}, {...}]
      // 2) Wrapped: { data: [...], success: true }
      // 3) Single object: { data: {...} }
      let contacts: Contact[] = [];

      if (Array.isArray(response)) {
        contacts = response as Contact[];
      } else if (response && Array.isArray(response.data)) {
        contacts = response.data as Contact[];
      } else if (response && response.data) {
        // single contact -> wrap into array
        contacts = [response.data] as Contact[];
      } else {
        console.log("🔍 Unexpected response structure:", response);
        contacts = [];
      }

      console.log("📋 Processed contacts count:", contacts.length);

      return {
        success: true,
        data: contacts,
        pagination: {
          page: 1,
          limit: contacts.length,
          total: contacts.length,
          totalPages: 1,
        },
      };
    } catch (error) {
      console.error("❌ Error fetching contacts:", error);
      throw error;
    }
  };

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const contactsPerPage = 10;

  const [newContact, setNewContact] = useState<ContactFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    relationship: "",
    company: "",
    address: "",
    occupation: "",
    notes: "",
    socialMedia: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
      whatsapp: "",
    },
    interests: [],
  });
  const [interestInput, setInterestInput] = useState("");

  // Create authenticated fetcher with session
  const authenticatedFetcher = session
    ? createAuthenticatedFetcher(session)
    : null;

  // Build direct backend API URL
  const apiUrl = useMemo(() => {
    if (searchTerm) {
      return DynamicRouter(
        "contacts",
        `search/${encodeURIComponent(searchTerm)}`,
        undefined,
        false
      );
    }
    return DynamicRouter("contacts", "", undefined, false);
  }, [searchTerm]);

  // Fetch contacts using SWR with direct backend calls
  const {
    data: contactsResponse,
    error,
    isLoading,
    mutate: mutateContacts,
  } = useSWR<ContactsResponse>(
    session && authenticatedFetcher ? apiUrl : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  );

  // Client-side pagination since backend returns all contacts
  const allContacts = contactsResponse?.data || [];

  // Apply client-side pagination
  const totalPages = Math.max(
    1,
    Math.ceil(allContacts.length / contactsPerPage)
  );
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const contacts = useMemo(() => {
    const start = (safePage - 1) * contactsPerPage;
    return allContacts.slice(start, start + contactsPerPage);
  }, [allContacts, safePage, contactsPerPage]);

  // Create pagination object for UI
  const pagination = {
    page: safePage,
    limit: contactsPerPage,
    total: allContacts.length,
    totalPages: totalPages,
  };

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Reset to last valid page if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddContact = async () => {
    if (!newContact.firstName || !newContact.email || !session) return;

    setIsSubmitting(true);
    try {
      console.log("💾 Saving contact:", editingContact ? "Edit" : "Create");

      let result;
      if (editingContact) {
        // Update existing contact
        const updateUrl = DynamicRouter(
          "contacts",
          editingContact.id,
          undefined,
          false
        );
        console.log("📝 Update URL:", updateUrl);
        result = await putRequest(updateUrl, newContact, session);
      } else {
        // Create new contact
        const createUrl = DynamicRouter("contacts", "", undefined, false);
        console.log("➕ Create URL:", createUrl);
        result = await postRequest(createUrl, newContact, session);
      }

      console.log("✅ Contact saved successfully:", result);

      // Reset form
      setNewContact({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        relationship: "",
        company: "",
        address: "",
        occupation: "",
        notes: "",
        socialMedia: {
          facebook: "",
          instagram: "",
          twitter: "",
          linkedin: "",
          whatsapp: "",
        },
        interests: [],
      });
      setInterestInput("");
      setShowExtraFields(false);
      setEditingContact(null);
      setIsAddContactOpen(false);

      // Revalidate the data
      mutateContacts();
    } catch (error) {
      console.error("❌ Error saving contact:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to save contact: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setNewContact({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phoneNumber: contact.phoneNumber || "",
      relationship: contact.relationship || "",
      company: contact.company || "",
      address: contact.address || "",
      occupation: contact.occupation || "",
      notes: contact.notes || "",
      socialMedia: contact.socialMedia || {
        facebook: "",
        instagram: "",
        twitter: "",
        linkedin: "",
        whatsapp: "",
      },
      interests: contact.interests || [],
    });
    setShowExtraFields(
      Boolean(
        contact.company ||
          contact.address ||
          contact.occupation ||
          contact.socialMedia ||
          contact.interests?.length
      )
    );
    setIsAddContactOpen(true);
  };

  // open app modal to confirm delete (replaces browser confirm)
  const handleDeleteContact = (contactId: string) => {
    setContactToDelete(contactId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteContact = async () => {
    if (!session || !contactToDelete) {
      setIsDeleteConfirmOpen(false);
      setContactToDelete(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const deleteUrl = DynamicRouter(
        "contacts",
        contactToDelete,
        undefined,
        false
      );
      console.log("📡 Delete URL:", deleteUrl);
      const result = await deleteRequest(deleteUrl, session);
      console.log("✅ Contact deleted successfully:", result);
      setIsDeleteConfirmOpen(false);
      setContactToDelete(null);
      mutateContacts();
    } catch (error) {
      console.error("❌ Error deleting contact:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to delete contact: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addInterest = () => {
    const trimmed = interestInput.trim();
    if (!trimmed) return;
    const currentInterests = newContact.interests || [];
    if (!currentInterests.includes(trimmed)) {
      setNewContact({
        ...newContact,
        interests: [...currentInterests, trimmed],
      });
    }
    setInterestInput("");
  };

  const removeInterest = (value: string) => {
    const currentInterests = newContact.interests || [];
    setNewContact({
      ...newContact,
      interests: currentInterests.filter((i) => i !== value),
    });
  };

  const handleInterestKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addInterest();
    }
  };

  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  // Common input styling
  const inputClasses =
    "block w-full rounded-md border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6";
  const textareaClasses =
    "block w-full rounded-md border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 resize-none";

  // Show loading state
  if (status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <section className="w-full md:pl-16 lg:pl-20">
        <Sidebar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <main className="py-10 sm:py-12">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Contacts
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Manage your wishcard contacts
              </p>
            </div>

            {/* Loading skeletons */}
            <div className="space-y-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white p-6 shadow ring-1 ring-gray-200"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-gray-200 rounded animate-pulse w-1/3" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </main>
        </div>
      </section>
    );
  }

  // Show error state
  if (error) {
    return (
      <section className="w-full md:pl-16 lg:pl-20">
        <Sidebar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <main className="py-10 sm:py-12">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Contacts
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Manage your wishcard contacts
              </p>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center text-red-600">
              Failed to load contacts. Please try again later.
              <button
                onClick={() => mutateContacts()}
                className="ml-4 inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Retry
              </button>
            </div>
          </main>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full md:pl-16 lg:pl-20">
      <Sidebar />
      <div
        className={`transition-all duration-500 ease-in-out ${
          isAddContactOpen ? "md:mr-96" : ""
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <main className="py-10 sm:py-12">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                    Contacts
                  </h1>
                  <p className="mt-2 text-lg text-gray-600">
                    Manage your wishcard contacts
                  </p>
                </div>
                <button
                  onClick={() => setIsAddContactOpen(true)}
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 p-2 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
                  title="Add Contact"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="mt-6">
                <div className="relative mx-auto max-w-3xl">
                  <div className="flex items-center gap-1 sm:gap-2 rounded-2xl bg-white/95 p-1.5 sm:p-2 shadow-sm ring-1 ring-gray-300 backdrop-blur transition focus-within:ring-indigo-400">
                    <input
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      type="text"
                      aria-label="Search contacts"
                      placeholder="Search contacts by name, email, or company..."
                      className="flex-1 min-w-0 rounded-2xl bg-transparent px-2 sm:px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Search"
                      className="flex-shrink-0 mr-0.5 sm:mr-1 grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 sm:h-5 sm:w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacts List */}
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-sm font-medium text-gray-900">
                  {searchTerm ? "No contacts found" : "No contacts yet"}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {searchTerm
                    ? "Try adjusting your search terms."
                    : "Get started by adding your first contact."}
                </p>
                {!searchTerm && (
                  <div className="mt-6">
                    <button
                      onClick={() => setIsAddContactOpen(true)}
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Contact
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {contacts.map((contact) => {
                    const avatar = getContactAvatar(contact);
                    return (
                      <div
                        key={contact.id}
                        className="rounded-lg bg-white p-6 shadow ring-1 ring-gray-200 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="flex-shrink-0">
                              <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center ring-1 ring-gray-200">
                                <span className="text-lg font-medium text-white">
                                  {avatar.value}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {getFullName(contact)}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    {contact.relationship && (
                                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                        {contact.relationship}
                                      </span>
                                    )}
                                    {contact.company && (
                                      <span className="text-sm text-gray-600">
                                        {contact.company}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                                {contact.email && (
                                  <div className="flex items-center gap-1">
                                    <EnvelopeIcon className="h-4 w-4" />
                                    <a
                                      href={`mailto:${contact.email}`}
                                      className="hover:text-indigo-600 transition-colors"
                                    >
                                      {contact.email}
                                    </a>
                                  </div>
                                )}
                                {contact.phoneNumber && (
                                  <div className="flex items-center gap-1">
                                    <PhoneIcon className="h-4 w-4" />
                                    <a
                                      href={`tel:${contact.phoneNumber}`}
                                      className="hover:text-indigo-600 transition-colors"
                                    >
                                      {contact.phoneNumber}
                                    </a>
                                  </div>
                                )}
                              </div>
                              {contact.notes && (
                                <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
                                  {contact.notes}
                                </p>
                              )}
                              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                <span>
                                  Added {formatDate(contact.createdAt)}
                                </span>
                                {contact.events &&
                                  contact.events.length > 0 && (
                                    <span>
                                      {contact.events.length} event
                                      {contact.events.length !== 1 ? "s" : ""}
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                          <Menu as="div" className="relative">
                            <MenuButton className="flex items-center p-2 text-gray-400 hover:text-gray-600">
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </MenuButton>
                            <MenuItems className="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <MenuItem>
                                <button
                                  onClick={() => handleEditContact(contact)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Edit Contact
                                </button>
                              </MenuItem>
                              <MenuItem>
                                <button
                                  onClick={() =>
                                    handleDeleteContact(contact.id)
                                  }
                                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </MenuItem>
                            </MenuItems>
                          </Menu>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage(
                            Math.min(pagination.totalPages, currentPage + 1)
                          )
                        }
                        disabled={currentPage === pagination.totalPages}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{" "}
                          <span className="font-medium">
                            {(currentPage - 1) * contactsPerPage + 1}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium">
                            {Math.min(
                              currentPage * contactsPerPage,
                              pagination.total
                            )}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium">
                            {pagination.total}
                          </span>{" "}
                          contacts
                        </p>
                      </div>
                      <div>
                        <nav
                          className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                          aria-label="Pagination"
                        >
                          <button
                            onClick={() =>
                              setCurrentPage(Math.max(1, currentPage - 1))
                            }
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Previous</span>
                            <svg
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {Array.from(
                            { length: pagination.totalPages },
                            (_, i) => i + 1
                          ).map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                page === currentPage
                                  ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                  : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            onClick={() =>
                              setCurrentPage(
                                Math.min(pagination.totalPages, currentPage + 1)
                              )
                            }
                            disabled={currentPage === pagination.totalPages}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Next</span>
                            <svg
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Add Contact Side Panel - truncated for brevity, but would include the same form as before */}
      <Dialog
        open={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div
              className={`fixed inset-0 bg-black/30 transition-opacity duration-300 md:hidden ${
                isAddContactOpen ? "opacity-100" : "opacity-0"
              }`}
            />

            <div className="pointer-events-none fixed top-0 bottom-16 md:bottom-0 right-0 flex max-w-full">
              <DialogPanel
                className={`pointer-events-auto w-screen transform transition-all duration-300 ease-in-out ${
                  isAddContactOpen ? "translate-x-0" : "translate-x-full"
                } md:max-w-96`}
              >
                <form className="flex h-full flex-col bg-white shadow-xl">
                  <div className="h-0 flex-1 overflow-y-auto">
                    <div className="bg-indigo-700 px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-base font-semibold leading-6 text-white">
                          {editingContact ? "Edit Contact" : "Add New Contact"}
                        </DialogTitle>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddContactOpen(false);
                              setShowExtraFields(false);
                              setEditingContact(null);
                            }}
                            className="relative rounded-md bg-indigo-700 text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon aria-hidden="true" className="h-6 w-6" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-sm text-indigo-300">
                          Add contact information and details below.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="px-6 sm:px-8">
                        <div className="space-y-8 py-8">
                          {/* Name Fields */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium leading-6 text-gray-900">
                                First Name *
                              </label>
                              <div className="mt-3">
                                <input
                                  type="text"
                                  value={newContact.firstName || ""}
                                  onChange={(e) =>
                                    setNewContact({
                                      ...newContact,
                                      firstName: e.target.value,
                                    })
                                  }
                                  className={inputClasses}
                                  placeholder="John"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium leading-6 text-gray-900">
                                Last Name
                              </label>
                              <div className="mt-3">
                                <input
                                  type="text"
                                  value={newContact.lastName || ""}
                                  onChange={(e) =>
                                    setNewContact({
                                      ...newContact,
                                      lastName: e.target.value,
                                    })
                                  }
                                  className={inputClasses}
                                  placeholder="Doe"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">
                              Email *
                            </label>
                            <div className="mt-3">
                              <input
                                type="email"
                                value={newContact.email || ""}
                                onChange={(e) =>
                                  setNewContact({
                                    ...newContact,
                                    email: e.target.value,
                                  })
                                }
                                className={inputClasses}
                                placeholder="john@example.com"
                              />
                            </div>
                          </div>

                          {/* Phone */}
                          <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">
                              Phone
                            </label>
                            <div className="mt-3">
                              <input
                                type="tel"
                                value={newContact.phoneNumber || ""}
                                onChange={(e) =>
                                  setNewContact({
                                    ...newContact,
                                    phoneNumber: e.target.value,
                                  })
                                }
                                className={inputClasses}
                                placeholder="+1 (555) 123-4567"
                              />
                            </div>
                          </div>

                          {/* Relationship */}
                          <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">
                              Relationship
                            </label>
                            <div className="mt-3">
                              <select
                                value={newContact.relationship || ""}
                                onChange={(e) =>
                                  setNewContact({
                                    ...newContact,
                                    relationship: e.target.value,
                                  })
                                }
                                className={inputClasses}
                              >
                                <option value="">Select relationship</option>
                                {relationshipOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Extra Fields Toggle */}
                        <div className="border-t border-gray-200 pt-8">
                          <button
                            type="button"
                            onClick={() => setShowExtraFields(!showExtraFields)}
                            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                          >
                            <ChevronDownIcon
                              className={`h-4 w-4 transform transition-transform duration-300 ${
                                showExtraFields ? "rotate-180" : ""
                              }`}
                            />
                            Extra
                          </button>

                          {showExtraFields && (
                            <div className="mt-8 space-y-8">
                              {/* Personal Information Section */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-5">
                                  Personal Information
                                </h4>
                                <div className="space-y-6">
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Company
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.company || ""}
                                        onChange={(e) =>
                                          setNewContact({
                                            ...newContact,
                                            company: e.target.value,
                                          })
                                        }
                                        className={inputClasses}
                                        placeholder="Company Name"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Occupation
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.occupation || ""}
                                        onChange={(e) =>
                                          setNewContact({
                                            ...newContact,
                                            occupation: e.target.value,
                                          })
                                        }
                                        className={inputClasses}
                                        placeholder="Job Title"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Address
                                    </label>
                                    <div className="mt-3">
                                      <textarea
                                        rows={2}
                                        value={newContact.address || ""}
                                        onChange={(e) =>
                                          setNewContact({
                                            ...newContact,
                                            address: e.target.value,
                                          })
                                        }
                                        className={textareaClasses}
                                        placeholder="123 Main St, City, State 12345"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Interests & Hobbies */}
                              <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900 mb-3">
                                  Interests & Hobbies
                                </label>
                                <div className="mt-3">
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {(newContact.interests || []).map(
                                      (interest) => (
                                        <span
                                          key={interest}
                                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
                                        >
                                          {interest}
                                          <button
                                            type="button"
                                            className="text-indigo-400 hover:text-indigo-600"
                                            onClick={() =>
                                              removeInterest(interest)
                                            }
                                          >
                                            ×
                                          </button>
                                        </span>
                                      )
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <input
                                      value={interestInput}
                                      onChange={(e) =>
                                        setInterestInput(e.target.value)
                                      }
                                      onKeyDown={handleInterestKey}
                                      placeholder="Add interest and press Enter"
                                      className="flex-1 rounded-md border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                    />
                                    <button
                                      type="button"
                                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                                      onClick={addInterest}
                                    >
                                      Add
                                    </button>
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">
                                    Use Enter or comma to add. You can add many.
                                  </p>
                                </div>
                              </div>

                              {/* Notes */}
                              <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900">
                                  Notes
                                </label>
                                <div className="mt-3">
                                  <textarea
                                    rows={3}
                                    value={newContact.notes || ""}
                                    onChange={(e) =>
                                      setNewContact({
                                        ...newContact,
                                        notes: e.target.value,
                                      })
                                    }
                                    className={textareaClasses}
                                    placeholder="Add notes about this contact..."
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 justify-end gap-3 px-6 py-6 border-t border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddContactOpen(false);
                        setShowExtraFields(false);
                        setEditingContact(null);
                      }}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddContact}
                      disabled={
                        !newContact.firstName ||
                        !newContact.email ||
                        isSubmitting
                      }
                      className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting
                        ? "Saving..."
                        : editingContact
                        ? "Save Changes"
                        : "Add Contact"}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
      {/* Delete confirmation modal (app-native, not browser confirm) */}
      <Dialog
        open={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setContactToDelete(null);
        }}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <DialogTitle className="text-lg font-medium text-gray-900">
              Delete contact
            </DialogTitle>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this contact? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setContactToDelete(null);
                }}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteContact}
                disabled={isSubmitting}
                className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </section>
  );
}
