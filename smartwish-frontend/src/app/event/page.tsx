"use client"

import Image from 'next/image'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/20/solid'
import { useMemo, useState } from 'react'

type BaseEvent = { id: number; name: string; time?: string; type?: string; datetime?: string }

type MyCard = { id: number; name: string; thumbnail: string; lastEdited: string }
const demoMyCards: MyCard[] = [
  { id: 1, name: 'Thank You – Clients', thumbnail: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-06.jpg', lastEdited: 'Edited 2d ago' },
  { id: 2, name: 'Birthday – For John', thumbnail: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-04.jpg', lastEdited: 'Edited 5d ago' },
  { id: 3, name: 'Holiday – Family Card', thumbnail: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-05.jpg', lastEdited: 'Edited 1w ago' },
  { id: 4, name: 'New Baby – Congrats', thumbnail: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-03.jpg', lastEdited: 'Edited 2w ago' },
]

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function iconForEvent(name: string) {
  const n = (name || '').toLowerCase()
  if (n.includes('birth')) return { icon: '🎂', label: 'Birthday' }
  if (n.includes('anniv')) return { icon: '💍', label: 'Anniversary' }
  if (n.includes('wedding')) return { icon: '💒', label: 'Wedding' }
  return { icon: '📌', label: 'Event' }
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

export default function EventCalendarPage() {
  const userName = 'User'
  const [current, setCurrent] = useState(new Date())
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [customEvents, setCustomEvents] = useState<BaseEvent[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState(toDateStr(new Date()))
  const [formType, setFormType] = useState('Event')
  const [selectedEventsPage, setSelectedEventsPage] = useState(0)
  const [upcomingPage, setUpcomingPage] = useState(0)

  const eventsByDate = useMemo(() => {
    const map: Record<string, BaseEvent[]> = {}
    const sample: BaseEvent[] = [
      { id: 101, name: 'Team Meeting', datetime: `${toDateStr(new Date())}T10:00` },
      { id: 102, name: 'Alice Birthday', datetime: `${toDateStr(new Date(new Date().setDate(new Date().getDate()+3)))}T00:00` },
      // fewer demo events for September 2025 with mixed event types
      ...Array.from({ length: 10 }).map((_, i) => {
        const day = i + 1
        const iso = `2025-09-${String(day).padStart(2, '0')}`
        const types = ['Birthday', 'Anniversary', 'Graduation', 'Wedding', 'Cinema', 'Date night', 'Meeting', 'Other', 'Birthday', 'Event']
        const name = `${types[i % types.length]} - Sample ${day}`
        return { id: 2000 + day, name, datetime: `${iso}T12:00` }
      }),
      // Small set of extra events for 2025-09-10 to test pagination (fewer than before)
      ...Array.from({ length: 3 }).map((_, i) => {
        const eventNum = i + 11
        return { id: 3000 + eventNum, name: `Extra Sep Event ${eventNum}`, datetime: `2025-09-10T${String(9 + i).padStart(2, '0')}:00` }
      }),
    ]
    for (const ev of sample.concat(customEvents)) {
      const key = ev.datetime ? ev.datetime.slice(0, 10) : toDateStr(new Date())
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [customEvents])

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

  function saveEvent() {
    if (!formName || !formDate) return
    const ev: BaseEvent = { id: Date.now(), name: formName, datetime: `${formDate}T00:00`, type: formType }
    setCustomEvents(s => [ev, ...s])
    setIsAddOpen(false)
    setFormName('')
    setFormDate(toDateStr(new Date()))
    setFormType('Event')
    setSelectedDate(formDate)
    setSelectedEventsPage(0) // Reset to first page when new event added
  }

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Hello, {userName}</h1>
          <p className="mt-2 text-lg text-gray-600">Welcome back to your calendar dashboard</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{label}</h2>
              <div className="flex items-center">
                <button onClick={() => setIsAddOpen(true)} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                  <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" /> Add Event
                </button>
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
                <span>Click dates to view details</span>
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
                          if (day.isCurrentMonth) {
                            setSelectedDate(day.date)
                            setSelectedEventsPage(0)
                          }
                        }} 
                        className="w-full h-full text-left flex flex-col items-start"
                        disabled={!day.isCurrentMonth}
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
                                const info = iconForEvent(event.name)
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

            {/* Legends removed as requested */}


            {/* Mobile/Tablet sections - show below calendar in this order */}
            <div className="lg:hidden mt-8 space-y-6">
              {/* 1. Selected Date Events - FIRST on mobile/tablet */}
              <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(selectedDate))}</h3>
                {selectedEvents.length === 0 ? (
                  <div className="text-center text-sm text-gray-500">No events for this date</div>
                ) : (
                  <div>
                    <ol className="space-y-3 mb-4">
                      {selectedEventsSlice.map(ev => (
                        <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                          <div className="text-lg">{iconForEvent(ev.name).icon}</div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                            {ev.time && <div className="text-xs text-gray-500">{ev.time}</div>}
                          </div>
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
                {upcomingPageSlice.length === 0 ? (
                  <div className="text-center text-sm text-gray-500">No upcoming events</div>
                ) : (
                  <div>
                    <ol className="space-y-3 mb-4">
                      {upcomingPageSlice.map(ev => (
                        <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                          <div className="text-lg">{iconForEvent(ev.name).icon}</div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                            <div className="text-xs text-gray-500">{ev.datetime?.slice(0,10)}</div>
                          </div>
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
              {selectedEvents.length === 0 ? (
                <div className="text-center text-sm text-gray-500">No events for this date</div>
              ) : (
                <div>
                  <ol className="space-y-3 mb-4">
                    {selectedEventsSlice.map(ev => (
                      <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                        <div className="text-lg">{iconForEvent(ev.name).icon}</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                          {ev.time && <div className="text-xs text-gray-500">{ev.time}</div>}
                        </div>
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
              {upcomingPageSlice.length === 0 ? (
                <div className="text-center text-sm text-gray-500">No upcoming events</div>
              ) : (
                <div>
                  <ol className="space-y-3 mb-4">
                    {upcomingPageSlice.map(ev => (
                      <li key={ev.id} className="flex items-start gap-3 p-3 rounded-md bg-gray-50">
                        <div className="text-lg">{iconForEvent(ev.name).icon}</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{ev.name}</div>
                          <div className="text-xs text-gray-500">{ev.datetime?.slice(0,10)}</div>
                        </div>
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
      </main>

      {isAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Add event</h3></div>
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
                  <div className="text-2xl flex-shrink-0">{iconForEvent(formType === 'Event' ? formName : formType).icon}</div>
                  <select 
                    id="event-type"
                    value={formType} 
                    onChange={(e) => setFormType(e.target.value)} 
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  >
                    <option>Event</option>
                    <option>Birthday</option>
                    <option>Anniversary</option>
                    <option>Graduation</option>
                    <option>Wedding</option>
                    <option>Cinema</option>
                    <option>Date night</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 rounded-b-lg">
              <button 
                onClick={() => setIsAddOpen(false)} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button 
                onClick={saveEvent} 
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

