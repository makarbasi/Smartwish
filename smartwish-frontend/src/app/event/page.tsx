"use client"

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, EllipsisVerticalIcon } from '@heroicons/react/20/solid'
import { useMemo, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react';
import useSWR from 'swr';

// Types
interface UserEvent {
  id: string;
  name: string;
  event_date: string;
  event_type: string;
}

interface ApiResponse {
  success: boolean;
  data: UserEvent[];
  count: number;
  year: number;
  month: number;
}

// Fetcher function with authentication
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

type BaseEvent = { id: string; name: string; time?: string; type?: string; datetime?: string; event_date: string; event_type: string }

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function iconForEvent(nameOrType: string) {
  const input = (nameOrType || '').toLowerCase()
  
  // First check by event type (for API data)
  if (input === 'birthday') return { icon: '🎂', label: 'Birthday' }
  if (input === 'meeting') return { icon: '🤝', label: 'Meeting' }
  if (input === 'personal') return { icon: '👤', label: 'Personal' }
  if (input === 'work') return { icon: '💼', label: 'Work' }
  if (input === 'holiday') return { icon: '🏖️', label: 'Holiday' }
  if (input === 'general') return { icon: '📅', label: 'General' }
  
  // Then check by name content (for backward compatibility and custom events)
  if (input.includes('birth')) return { icon: '🎂', label: 'Birthday' }
  if (input.includes('anniv')) return { icon: '💍', label: 'Anniversary' }
  if (input.includes('wedding')) return { icon: '💒', label: 'Wedding' }
  if (input.includes('graduation')) return { icon: '🎓', label: 'Graduation' }
  if (input.includes('cinema') || input.includes('movie')) return { icon: '🎬', label: 'Cinema' }
  if (input.includes('date')) return { icon: '💕', label: 'Date' }
  if (input.includes('meeting') || input.includes('meet')) return { icon: '🤝', label: 'Meeting' }
  if (input.includes('work') || input.includes('office')) return { icon: '�', label: 'Work' }
  if (input.includes('holiday') || input.includes('vacation')) return { icon: '🏖️', label: 'Holiday' }
  if (input.includes('doctor') || input.includes('medical')) return { icon: '🏥', label: 'Medical' }
  if (input.includes('gym') || input.includes('workout')) return { icon: '💪', label: 'Fitness' }
  if (input.includes('travel') || input.includes('trip')) return { icon: '✈️', label: 'Travel' }
  if (input.includes('party') || input.includes('celebration')) return { icon: '🎉', label: 'Party' }
  if (input.includes('dinner') || input.includes('lunch') || input.includes('meal')) return { icon: '🍽️', label: 'Meal' }
  if (input.includes('shopping')) return { icon: '🛍️', label: 'Shopping' }
  if (input.includes('sports') || input.includes('game')) return { icon: '⚽', label: 'Sports' }
  if (input.includes('music') || input.includes('concert')) return { icon: '🎵', label: 'Music' }
  if (input.includes('appointment')) return { icon: '📋', label: 'Appointment' }
  if (input.includes('reminder')) return { icon: '⏰', label: 'Reminder' }
  
  // Default fallback
  return { icon: '📅', label: 'Event' }
}

function generateMonthDays(base: Date, eventsMap: Record<string, BaseEvent[]>) {
  const year = base.getFullYear()
  const month = base.getMonth()
  const first = new Date(year, month, 1)
  const startDay = (first.getDay() + 6) % 7 // Monday=0
  const start = new Date(year, month, 1 - startDay)
  
  const res: { date: string; isCurrentMonth: boolean; isToday: boolean; events: BaseEvent[] }[] = []
  
  // Generate 42 days (6 weeks) to fill the calendar grid
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const ds = toDateStr(d)
    res.push({ 
      date: ds, 
      isCurrentMonth: d.getMonth() === month, 
      isToday: ds === toDateStr(new Date()), 
      events: eventsMap[ds] || [] 
    })
  }
  
  return res
}

// Event Actions Dropdown Component
const EventActionsDropdown = ({ event, onEdit, onDelete }: { 
  event: BaseEvent; 
  onEdit: (event: BaseEvent) => void; 
  onDelete: (event: BaseEvent) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
        title="More actions"
      >
        <EllipsisVerticalIcon className="w-4 h-4 text-gray-500" />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(event);
                  setIsOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event);
                  setIsOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Delete Confirmation Modal Component
const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  eventName,
  isDeleting 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  eventName: string;
  isDeleting: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="px-6 py-4">
          <div className="flex items-center mb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Event</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "<span className="font-medium">{eventName}</span>"? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 rounded-b-lg">
          <button 
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function EventsPage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name || 'User'
  const [current, setCurrent] = useState(new Date())
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState(toDateStr(new Date()))
  const [formType, setFormType] = useState('general')
  const [selectedEventsPage, setSelectedEventsPage] = useState(0)
  const [upcomingPage, setUpcomingPage] = useState(0)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<BaseEvent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Generate API URL for current month
  const apiUrl = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    return `/api/events/month/${year}/${month}`;
  }, [current]);

  // Fetch events for current month
  const { data: eventsResponse, error, mutate, isLoading } = useSWR<ApiResponse>(
    session ? apiUrl : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000 // 30 seconds
    }
  );

  const events = eventsResponse?.data || [];

  const eventsByDate = useMemo(() => {
    const map: Record<string, BaseEvent[]> = {}
    
    // Only process events if user is signed in
    if (session && events.length > 0) {
      // Convert API events to BaseEvent format
      for (const ev of events) {
        const key = ev.event_date
        if (!map[key]) map[key] = []
        map[key].push({
          id: ev.id,
          name: ev.name,
          event_date: ev.event_date,
          event_type: ev.event_type,
          datetime: `${ev.event_date}T00:00`
        })
      }
    }
    return map
  }, [events, session])

  const days = useMemo(() => generateMonthDays(current, eventsByDate), [current, eventsByDate])
  const selectedEvents = eventsByDate[selectedDate] || []
  const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(current)

  // Pagination for selected date events
  const selectedEventsPerPage = 5
  const selectedEventsTotalPages = Math.ceil(selectedEvents.length / selectedEventsPerPage)
  const selectedEventsSlice = selectedEvents.slice(
    selectedEventsPage * selectedEventsPerPage,
    (selectedEventsPage + 1) * selectedEventsPerPage
  )

  // Pagination for upcoming events
  const upcoming = Object.entries(eventsByDate).flatMap(([k, v]) => v.map(ev => ({ ...ev, iso: k, label: k })))
  const upcomingPerPage = 6
  const upcomingTotalPages = Math.ceil(upcoming.length / upcomingPerPage)
  const upcomingPageSlice = upcoming.slice(
    upcomingPage * upcomingPerPage,
    (upcomingPage + 1) * upcomingPerPage
  )

  const handleSaveEvent = async () => {
    if (!formName || !formDate || !session) return

    try {
      const method = editingEventId ? 'PUT' : 'POST';
      const url = editingEventId ? `/api/events/${editingEventId}` : '/api/events';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formName,
          event_date: formDate,
          event_type: formType
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await mutate(); // Refresh events
      setIsAddOpen(false)
      setFormName('')
      setFormDate(toDateStr(new Date()))
      setFormType('general')
      setEditingEventId(null)
      setSelectedDate(formDate)
      setSelectedEventsPage(0) // Reset to first page when new event added
    } catch (error) {
      console.error('Error saving event:', error);
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!session) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await mutate(); // Refresh events
      setDeleteModalOpen(false);
      setEventToDelete(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  }

  const handleDeleteClick = (event: BaseEvent) => {
    setEventToDelete(event);
    setDeleteModalOpen(true);
  }

  const handleConfirmDelete = async () => {
    if (eventToDelete) {
      await handleDeleteEvent(eventToDelete.id);
    }
  }

  const handleEditEvent = (event: BaseEvent) => {
    setFormName(event.name);
    setFormDate(event.event_date);
    setFormType(event.event_type);
    setIsAddOpen(true);
    setEditingEventId(event.id);
  }

  // Loading and authentication states
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Show disabled Add Event button and empty sidebar when not authenticated
  const isAuthenticated = status === 'authenticated' && session;
  const showAddEventButton = isAuthenticated;
  const canEditEvents = isAuthenticated;

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Hello, {userName}</h1>
          <p className="mt-2 text-lg text-gray-600">
            {isAuthenticated ? 'Welcome back to your calendar dashboard' : 'Sign in to manage your events and schedule'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{label}</h2>
              <div className="flex items-center">
                {showAddEventButton ? (
                  <button onClick={() => {
                    setFormDate(selectedDate);
                    setIsAddOpen(true);
                  }} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                    <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" /> Add Event
                  </button>
                ) : (
                  <button 
                    disabled 
                    className="inline-flex items-center rounded-md bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-500 shadow-sm cursor-not-allowed"
                    title="Sign in to add events"
                  >
                    <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" /> Add Event
                  </button>
                )}
              </div>
            </div>

            <header className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative flex items-center rounded-md bg-white shadow-sm ring-1 ring-gray-300">
                  <button onClick={() => { const d = new Date(current); d.setMonth(d.getMonth() - 1); setCurrent(d) }} type="button" className="flex h-9 w-12 items-center justify-center rounded-l-md text-gray-400 hover:text-gray-500 hover:bg-gray-50 focus:relative">
                    <span className="sr-only">Previous month</span>
                    <ChevronLeftIcon aria-hidden className="size-5" />
                  </button>
                  <div className="px-4 py-2 text-sm font-medium text-gray-900 min-w-[140px] text-center">
                    {label}
                  </div>
                  <button onClick={() => { const d = new Date(current); d.setMonth(d.getMonth() + 1); setCurrent(d) }} type="button" className="flex h-9 w-12 items-center justify-center rounded-r-md text-gray-400 hover:text-gray-500 hover:bg-gray-50 focus:relative">
                    <span className="sr-only">Next month</span>
                    <ChevronRightIcon aria-hidden className="size-5" />
                  </button>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
                <span>{isAuthenticated ? 'Click dates to view details' : 'Sign in to manage events'}</span>
              </div>
            </header>

            <div className="shadow-sm ring-1 ring-black/5 lg:flex lg:flex-auto lg:flex-col rounded-lg overflow-hidden bg-white">
              <div className="grid grid-cols-7 gap-0 bg-gray-50 text-center text-xs/6 font-semibold text-gray-700 lg:flex-none">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                  <div key={d} className="flex justify-center py-2 lg:py-3">{d}</div>
                ))}
              </div>
              <div className="flex bg-white text-xs/6 text-gray-700 lg:flex-auto">
                <div className="w-full grid grid-cols-7 grid-rows-6 gap-0">
                  {days.map((day) => (
                    <div
                      key={day.date}
                      className={`group relative px-1 py-2 lg:px-3 lg:py-4 min-h-[60px] lg:min-h-[96px] hover:bg-gray-50 focus:outline-none transition-colors duration-200 border-r border-b border-gray-100 ${!day.isCurrentMonth ? 'bg-gray-50' : 'text-gray-700'}`}
                    >
                      <button 
                        onClick={() => {
                          if (day.isCurrentMonth && canEditEvents) {
                            setSelectedDate(day.date)
                            setSelectedEventsPage(0)
                          }
                        }} 
                        className={`w-full h-full text-left flex flex-col items-start ${!canEditEvents ? 'cursor-default' : ''}`}
                        disabled={!day.isCurrentMonth || !canEditEvents}
                      >
                        <time 
                          dateTime={day.date || ''} 
                          className={`
                            relative inline-flex h-6 w-6 lg:h-8 lg:w-8 items-center justify-center rounded-full text-xs lg:text-sm font-medium transition-all duration-200 mb-1
                            ${day.isCurrentMonth ? (selectedDate === day.date ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-900 hover:bg-gray-100') : 'text-gray-400'}
                          `}
                        >
                          {new Date(day.date).getDate()}
                        </time>
                        {day.events.length > 0 && day.isCurrentMonth ? (
                          <div className="flex items-center justify-center w-full">
                            {/* Mobile: Show dots for events */}
                            <div className="lg:hidden flex items-center gap-0.5">
                              {day.events.slice(0, 3).map((event) => (
                                <div key={event.id} className="w-1.5 h-1.5 rounded-full bg-indigo-500" title={event.name}></div>
                              ))}
                              {day.events.length > 3 && (
                                <span className="text-[10px] text-gray-600 ml-1 font-medium">+{day.events.length - 3}</span>
                              )}
                            </div>
                            {/* Desktop: Show icons */}
                            <div className="hidden lg:flex items-center gap-1 flex-wrap">
                              {day.events.slice(0, 3).map((event) => {
                                const info = iconForEvent(event.event_type || event.name)
                                return (
                                  <span key={event.id} title={event.name} className="text-sm" aria-hidden>{info.icon}</span>
                                )
                              })}
                              {day.events.length > 3 && (
                                <span className="text-xs text-gray-500 font-medium">+{day.events.length - 3}</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile/Tablet sections - show below calendar in this order */}
            <div className="lg:hidden mt-8 space-y-6">
              {/* 1. Selected Date Events - FIRST on mobile/tablet */}
              <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(selectedDate))}</h3>
                {!isAuthenticated ? (
                  <div className="text-center text-sm text-gray-500 py-4">
                    Sign in to view and manage your events
                  </div>
                ) : selectedEvents.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-4">
                    No events for this date
                  </div>
                ) : (
                  <div>
                    <ol className="space-y-3 mb-4">
                      {selectedEventsSlice.map(ev => (
                        <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                          <div className="text-lg">{iconForEvent(ev.event_type || ev.name).icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                            {ev.time && <div className="text-xs text-gray-500">{ev.time}</div>}
                          </div>
                          <EventActionsDropdown 
                            event={ev} 
                            onEdit={handleEditEvent}
                            onDelete={handleDeleteClick}
                          />
                        </li>
                      ))}
                    </ol>
                    {selectedEventsTotalPages > 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <button 
                          onClick={() => setSelectedEventsPage(p => Math.max(0, p - 1))} 
                          disabled={selectedEventsPage === 0}
                          className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                        >
                          Previous
                        </button>
                        <span className="text-gray-500">
                          {selectedEventsPage + 1} of {selectedEventsTotalPages} ({selectedEvents.length} events)
                        </span>
                        <button 
                          onClick={() => setSelectedEventsPage(p => Math.min(selectedEventsTotalPages - 1, p + 1))} 
                          disabled={selectedEventsPage >= selectedEventsTotalPages - 1}
                          className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Upcoming Events - SECOND on mobile/tablet */}
              <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Upcoming Events</h3>
                {!isAuthenticated ? (
                  <div className="text-center text-sm text-gray-500">Sign in to view upcoming events</div>
                ) : upcomingPageSlice.length === 0 ? (
                  <div className="text-center text-sm text-gray-500">No upcoming events</div>
                ) : (
                  <div>
                    <ol className="space-y-3 mb-4">
                      {upcomingPageSlice.map(ev => (
                        <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                          <div className="text-lg">{iconForEvent(ev.event_type || ev.name).icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                            <div className="text-xs text-gray-500">{ev.datetime?.slice(0,10)}</div>
                          </div>
                          <EventActionsDropdown 
                            event={ev} 
                            onEdit={handleEditEvent}
                            onDelete={handleDeleteClick}
                          />
                        </li>
                      ))}
                    </ol>
                    {upcomingTotalPages > 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <button 
                          onClick={() => setUpcomingPage(p => Math.max(0, p - 1))} 
                          disabled={upcomingPage === 0}
                          className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                        >
                          Previous
                        </button>
                        <span className="text-gray-500">
                          {upcomingPage + 1} of {upcomingTotalPages}
                        </span>
                        <button 
                          onClick={() => setUpcomingPage(p => Math.min(upcomingTotalPages - 1, p + 1))} 
                          disabled={upcomingPage >= upcomingTotalPages - 1}
                          className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Sidebar - hidden on mobile/tablet */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            {/* Selected date events - shows second on desktop */}
            <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(selectedDate))}</h3>
              {!isAuthenticated ? (
                <div className="text-center text-sm text-gray-500">Sign in to view and manage your events</div>
              ) : selectedEvents.length === 0 ? (
                <div className="text-center text-sm text-gray-500">No events for this date</div>
              ) : (
                <div>
                  <ol className="space-y-3 mb-4">
                    {selectedEventsSlice.map(ev => (
                      <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                        <div className="text-lg">{iconForEvent(ev.event_type || ev.name).icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                          {ev.time && <div className="text-xs text-gray-500">{ev.time}</div>}
                        </div>
                        <EventActionsDropdown 
                          event={ev} 
                          onEdit={handleEditEvent}
                          onDelete={handleDeleteClick}
                        />
                      </li>
                    ))}
                  </ol>
                  {selectedEventsTotalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <button 
                        onClick={() => setSelectedEventsPage(p => Math.max(0, p - 1))} 
                        disabled={selectedEventsPage === 0}
                        className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                      >
                        Previous
                      </button>
                      <span className="text-gray-500">
                        {selectedEventsPage + 1} of {selectedEventsTotalPages} ({selectedEvents.length} events)
                      </span>
                      <button 
                        onClick={() => setSelectedEventsPage(p => Math.min(selectedEventsTotalPages - 1, p + 1))} 
                        disabled={selectedEventsPage >= selectedEventsTotalPages - 1}
                        className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming events - shows third on desktop */}
            <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Upcoming Events</h3>
              {!isAuthenticated ? (
                <div className="text-center text-sm text-gray-500">Sign in to view your upcoming events</div>
              ) : upcomingPageSlice.length === 0 ? (
                <div className="text-center text-sm text-gray-500">No upcoming events</div>
              ) : (
                <div>
                  <ol className="space-y-3 mb-4">
                    {upcomingPageSlice.map(ev => (
                      <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                        <div className="text-lg">{iconForEvent(ev.event_type || ev.name).icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                          <div className="text-xs text-gray-500">{ev.datetime?.slice(0,10)}</div>
                        </div>
                        <EventActionsDropdown 
                          event={ev} 
                          onEdit={handleEditEvent}
                          onDelete={handleDeleteClick}
                        />
                      </li>
                    ))}
                  </ol>
                  {upcomingTotalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <button 
                        onClick={() => setUpcomingPage(p => Math.max(0, p - 1))} 
                        disabled={upcomingPage === 0}
                        className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                      >
                        Previous
                      </button>
                      <span className="text-gray-500">
                        {upcomingPage + 1} of {upcomingTotalPages}
                      </span>
                      <button 
                        onClick={() => setUpcomingPage(p => Math.min(upcomingTotalPages - 1, p + 1))} 
                        disabled={upcomingPage >= upcomingTotalPages - 1}
                        className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span className="ml-2">Loading events...</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-md shadow-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>Failed to load events</span>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        eventName={eventToDelete?.name || ''}
        isDeleting={isDeleting}
      />

      {/* Add/Edit Event Modal */}
      {isAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEventId ? 'Edit Event' : 'Add Event'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
                <input 
                  id="event-name"
                  type="text"
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2" 
                  placeholder="Enter event name"
                />
              </div>
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input 
                  id="event-date"
                  type="date" 
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2" 
                />
              </div>
              <div>
                <label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0">{iconForEvent(formType === 'general' ? formName : formType).icon}</div>
                  <select 
                    id="event-type"
                    value={formType} 
                    onChange={(e) => setFormType(e.target.value)} 
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  >
                    <option value="general">General</option>
                    <option value="birthday">Birthday</option>
                    <option value="meeting">Meeting</option>
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="holiday">Holiday</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="wedding">Wedding</option>
                    <option value="graduation">Graduation</option>
                    <option value="cinema">Cinema</option>
                    <option value="date">Date</option>
                    <option value="medical">Medical</option>
                    <option value="fitness">Fitness</option>
                    <option value="travel">Travel</option>
                    <option value="party">Party</option>
                    <option value="meal">Meal</option>
                    <option value="shopping">Shopping</option>
                    <option value="sports">Sports</option>
                    <option value="music">Music</option>
                    <option value="appointment">Appointment</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 rounded-b-lg">
              <button 
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingEventId(null);
                  setFormName('');
                  setFormDate(toDateStr(new Date()));
                  setFormType('general');
                }} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEvent} 
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {editingEventId ? 'Update Event' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}