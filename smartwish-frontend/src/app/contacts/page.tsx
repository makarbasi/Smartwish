'use client'

import { useState } from 'react'
import { PlusIcon, ChevronDownIcon, PhotoIcon } from '@heroicons/react/20/solid'
import { UserGroupIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { Menu, MenuButton, MenuItems, MenuItem, Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { EllipsisVerticalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'

type Contact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatar?: string
  company?: string
  address?: string
  occupation?: string
  notes?: string
  relationship?: string
  socialLinks?: {
    facebook?: string
    instagram?: string
    twitter?: string
    linkedin?: string
    whatsapp?: string
  }
  interests?: string[]
  createdAt: string
}

// Helper to get full name
const getFullName = (contact: Contact) => `${contact.firstName} ${contact.lastName}`.trim()

// Sample contacts data
const sampleContacts: Contact[] = [
  {
    id: '1',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.j@example.com',
    phone: '+1 (555) 123-4567',
    avatar: 'https://i.pravatar.cc/150?img=1',
    company: 'Design Studio Inc.',
    occupation: 'UX Designer',
    relationship: 'Business',
    notes: 'Met at design conference. Interested in custom greeting cards for her company.',
    socialLinks: {
      linkedin: 'sarah-johnson-designer',
      instagram: 'sarahdesigns'
    },
    interests: ['Design', 'UX Research', 'Photography'],
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@techcorp.com',
    phone: '+1 (555) 987-6543',
    company: 'TechCorp Solutions',
    occupation: 'Software Engineer',
    relationship: 'Colleague',
    createdAt: '2024-01-10'
  },
  {
    id: '3',
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.d@gmail.com',
    phone: '+1 (555) 456-7890',
    avatar: 'https://i.pravatar.cc/150?img=5',
    relationship: 'Family',
    notes: 'Sister. Loves handmade cards.',
    address: '123 Family St, Home City, HC 12345',
    socialLinks: {
      facebook: 'emily.davis.family',
      instagram: 'emily_d_photos',
      whatsapp: '+15554567890'
    },
    interests: ['Photography', 'Travel', 'Cooking'],
    createdAt: '2024-01-05'
  }
]

const relationshipOptions = [
  'Family',
  'Friend', 
  'Colleague',
  'Business',
  'Acquaintance',
  'Other'
]

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(sampleContacts)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [showExtraFields, setShowExtraFields] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const contactsPerPage = 10
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    relationship: '',
    company: '',
    address: '',
    occupation: '',
    notes: '',
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      whatsapp: ''
    },
    interests: []
  })
  const [interestInput, setInterestInput] = useState('')

  const filteredContacts = contacts.filter(contact =>
    getFullName(contact).toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredContacts.length / contactsPerPage)
  const startIndex = (currentPage - 1) * contactsPerPage
  const endIndex = startIndex + contactsPerPage
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex)

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleAddContact = () => {
    if (newContact.firstName && newContact.email) {
      if (editingContact) {
        // Update existing contact
        const updatedContact: Contact = {
          ...editingContact,
          firstName: newContact.firstName,
          lastName: newContact.lastName || '',
          email: newContact.email,
          phone: newContact.phone,
          relationship: newContact.relationship,
          company: newContact.company,
          address: newContact.address,
          occupation: newContact.occupation,
          notes: newContact.notes,
          socialLinks: newContact.socialLinks,
          interests: newContact.interests
        }
        setContacts(contacts.map(c => c.id === editingContact.id ? updatedContact : c))
      } else {
        // Add new contact
        const contact: Contact = {
          id: Date.now().toString(),
          firstName: newContact.firstName,
          lastName: newContact.lastName || '',
          email: newContact.email,
          phone: newContact.phone,
          relationship: newContact.relationship,
          company: newContact.company,
          address: newContact.address,
          occupation: newContact.occupation,
          notes: newContact.notes,
          socialLinks: newContact.socialLinks,
          interests: newContact.interests,
          createdAt: new Date().toISOString().split('T')[0]
        }
        setContacts([contact, ...contacts])
      }
      
      // Reset form
      setNewContact({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        phone: '', 
        relationship: '', 
        company: '', 
        address: '', 
        occupation: '', 
        notes: '',
        socialLinks: { facebook: '', instagram: '', twitter: '', linkedin: '', whatsapp: '' },
        interests: []
      })
      setInterestInput('')
      setShowExtraFields(false)
      setEditingContact(null)
      setIsAddContactOpen(false)
    }
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setNewContact({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      relationship: contact.relationship,
      company: contact.company,
      address: contact.address,
      occupation: contact.occupation,
      notes: contact.notes,
      socialLinks: contact.socialLinks || { facebook: '', instagram: '', twitter: '', linkedin: '', whatsapp: '' },
      interests: contact.interests || []
    })
    setShowExtraFields(Boolean(contact.company || contact.address || contact.occupation || contact.socialLinks || contact.interests?.length))
    setIsAddContactOpen(true)
  }

  const addInterest = () => {
    const trimmed = interestInput.trim()
    if (!trimmed) return
    const currentInterests = newContact.interests || []
    if (!currentInterests.includes(trimmed)) {
      setNewContact({ ...newContact, interests: [...currentInterests, trimmed] })
    }
    setInterestInput('')
  }

  const removeInterest = (value: string) => {
    const currentInterests = newContact.interests || []
    setNewContact({ ...newContact, interests: currentInterests.filter((i) => i !== value) })
  }

  const handleInterestKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addInterest()
    }
  }

  // Common input styling
  const inputClasses = "block w-full rounded-md border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
  const textareaClasses = "block w-full rounded-md border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 resize-none"

  const handleDeleteContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  return (
    <section className="w-full md:pl-16 lg:pl-20">
      <Sidebar />
      <div className={`transition-all duration-500 ease-in-out ${
        isAddContactOpen ? 'md:mr-96' : ''
      }`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <main className="py-10 sm:py-12">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Contacts</h1>
                <p className="mt-2 text-lg text-gray-600">Manage your wishcard contacts</p>
              </div>
              <button
                onClick={() => setIsAddContactOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 p-2 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
                title="Add Contact"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Search - using HeroSearch style */}
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
                    <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contacts List */}
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-sm font-medium text-gray-900">
                {searchTerm ? 'No contacts found' : 'No contacts yet'}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {searchTerm 
                  ? 'Try adjusting your search terms.'
                  : 'Get started by adding your first contact.'
                }
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
                {paginatedContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg bg-white p-6 shadow ring-1 ring-gray-200 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex-shrink-0">
                        {contact.avatar ? (
                          <Image
                            src={contact.avatar}
                            alt={getFullName(contact)}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover ring-1 ring-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center ring-1 ring-gray-200">
                            <span className="text-lg font-medium text-white">
                              {(contact.firstName.charAt(0) + (contact.lastName?.charAt(0) || '')).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{getFullName(contact)}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              {contact.relationship && (
                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  {contact.relationship}
                                </span>
                              )}
                              {contact.company && (
                                <span className="text-sm text-gray-600">{contact.company}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <EnvelopeIcon className="h-4 w-4" />
                            <a href={`mailto:${contact.email}`} className="hover:text-indigo-600 transition-colors">
                              {contact.email}
                            </a>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-1">
                              <PhoneIcon className="h-4 w-4" />
                              <a href={`tel:${contact.phone}`} className="hover:text-indigo-600 transition-colors">
                                {contact.phone}
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
                          <span>Added {formatDate(contact.createdAt)}</span>
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
                            onClick={() => handleDeleteContact(contact.id)}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </Menu>
                  </div>
                </div>
              ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(endIndex, filteredContacts.length)}</span> of{' '}
                        <span className="font-medium">{filteredContacts.length}</span> contacts
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              page === currentPage
                                ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
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

      {/* Add Contact Side Panel */}
      <Dialog open={isAddContactOpen} onClose={() => setIsAddContactOpen(false)} className="relative z-50">        
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            {/* Mobile overlay */}
            <div 
              className={`fixed inset-0 bg-black/30 transition-opacity duration-300 md:hidden ${
                isAddContactOpen ? 'opacity-100' : 'opacity-0'
              }`} 
            />
            
            <div className="pointer-events-none fixed top-0 bottom-16 md:bottom-0 right-0 flex max-w-full">
              <DialogPanel className={`pointer-events-auto w-screen transform transition-all duration-300 ease-in-out ${
                isAddContactOpen ? 'translate-x-0' : 'translate-x-full'
              } md:max-w-96`}>
                <form className="flex h-full flex-col bg-white shadow-xl">
                  <div className="h-0 flex-1 overflow-y-auto">
                    <div className="bg-indigo-700 px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-base font-semibold leading-6 text-white">
                          {editingContact ? 'Edit Contact' : 'Add New Contact'}
                        </DialogTitle>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddContactOpen(false)
                              setShowExtraFields(false)
                              setEditingContact(null)
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
                          {/* Profile Picture */}
                          <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">
                              Profile Picture (Optional)
                            </label>
                            <div className="mt-2 flex items-center gap-4">
                              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                                {newContact.avatar ? (
                                  <Image
                                    src={newContact.avatar}
                                    alt="Profile"
                                    width={64}
                                    height={64}
                                    className="h-16 w-16 rounded-full object-cover"
                                  />
                                ) : (
                                  <PhotoIcon className="h-8 w-8 text-gray-400" />
                                )}
                              </div>
                              <button
                                type="button"
                                className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                              >
                                Upload
                              </button>
                            </div>
                          </div>

                          {/* Name Fields */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium leading-6 text-gray-900">
                                First Name *
                              </label>
                              <div className="mt-3">
                                <input
                                  type="text"
                                  value={newContact.firstName || ''}
                                  onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
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
                                  value={newContact.lastName || ''}
                                  onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
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
                                value={newContact.email || ''}
                                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
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
                                value={newContact.phone || ''}
                                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
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
                                value={newContact.relationship || ''}
                                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
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

                          {/* Custom relationship input */}
                          {newContact.relationship === 'Other' && (
                            <div>
                              <label className="block text-sm font-medium leading-6 text-gray-900">
                                Custom Relationship
                              </label>
                              <div className="mt-3">
                                <input
                                  type="text"
                                  value={newContact.relationship === 'Other' ? '' : newContact.relationship || ''}
                                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                                  className={inputClasses}
                                  placeholder="Enter custom relationship"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Extra Fields Toggle */}
                        <div className="border-t border-gray-200 pt-8">
                          <button
                            type="button"
                            onClick={() => setShowExtraFields(!showExtraFields)}
                            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                          >
                            <ChevronDownIcon 
                              className={`h-4 w-4 transform transition-transform duration-300 ${showExtraFields ? 'rotate-180' : ''}`} 
                            />
                            Extra
                          </button>
                          
                          {showExtraFields && (
                            <div className="mt-8 space-y-8">
                              {/* Personal Information Section */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-5">Personal Information</h4>
                                <div className="space-y-6">
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Company
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.company || ''}
                                        onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
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
                                        value={newContact.occupation || ''}
                                        onChange={(e) => setNewContact({ ...newContact, occupation: e.target.value })}
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
                                        value={newContact.address || ''}
                                        onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                                        className={textareaClasses}
                                        placeholder="123 Main St, City, State 12345"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Social Links Section */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-5">Social Links</h4>
                                <div className="space-y-6">
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      WhatsApp
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="tel"
                                        value={newContact.socialLinks?.whatsapp || ''}
                                        onChange={(e) => setNewContact({ 
                                          ...newContact, 
                                          socialLinks: { 
                                            ...newContact.socialLinks, 
                                            whatsapp: e.target.value 
                                          } 
                                        })}
                                        className={inputClasses}
                                        placeholder="+1 (555) 123-4567"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Facebook
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.socialLinks?.facebook || ''}
                                        onChange={(e) => setNewContact({ 
                                          ...newContact, 
                                          socialLinks: { 
                                            ...newContact.socialLinks, 
                                            facebook: e.target.value 
                                          } 
                                        })}
                                        className={inputClasses}
                                        placeholder="username or profile URL"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Instagram
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.socialLinks?.instagram || ''}
                                        onChange={(e) => setNewContact({ 
                                          ...newContact, 
                                          socialLinks: { 
                                            ...newContact.socialLinks, 
                                            instagram: e.target.value 
                                          } 
                                        })}
                                        className={inputClasses}
                                        placeholder="@username"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      Twitter
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.socialLinks?.twitter || ''}
                                        onChange={(e) => setNewContact({ 
                                          ...newContact, 
                                          socialLinks: { 
                                            ...newContact.socialLinks, 
                                            twitter: e.target.value 
                                          } 
                                        })}
                                        className={inputClasses}
                                        placeholder="@username"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">
                                      LinkedIn
                                    </label>
                                    <div className="mt-3">
                                      <input
                                        type="text"
                                        value={newContact.socialLinks?.linkedin || ''}
                                        onChange={(e) => setNewContact({ 
                                          ...newContact, 
                                          socialLinks: { 
                                            ...newContact.socialLinks, 
                                            linkedin: e.target.value 
                                          } 
                                        })}
                                        className={inputClasses}
                                        placeholder="linkedin.com/in/username"
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
                                    {(newContact.interests || []).map((interest) => (
                                      <span key={interest} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
                                        {interest}
                                        <button type="button" className="text-indigo-400 hover:text-indigo-600" onClick={() => removeInterest(interest)}>
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <input
                                      value={interestInput}
                                      onChange={(e) => setInterestInput(e.target.value)}
                                      onKeyDown={handleInterestKey}
                                      placeholder="Add interest and press Enter"
                                      className="flex-1 rounded-md border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                    />
                                    <button type="button" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500" onClick={addInterest}>
                                      Add
                                    </button>
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">Use Enter or comma to add. You can add many.</p>
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
                                    value={newContact.notes || ''}
                                    onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
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
                        setIsAddContactOpen(false)
                        setShowExtraFields(false)
                        setEditingContact(null)
                      }}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddContact}
                      disabled={!newContact.firstName || !newContact.email}
                      className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingContact ? 'Save Changes' : 'Add Contact'}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
    </section>
  )
}