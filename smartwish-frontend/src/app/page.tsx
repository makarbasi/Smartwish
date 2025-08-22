'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { whatYouGet } from '@/resources/what'
import HeroSearch from '@/components/HeroSearch'
import GallerySection from '@/components/GallerySection'
import { ClockIcon } from '@heroicons/react/20/solid'
import MadeWithSmartWish from '@/components/MadeWithSmartWish'

const chips = [
  'Birthday',
  'Anniversary',
  'Holiday',
  'Thank You',
  'Wedding',
  'New Baby',
  'Graduation',
  'Congratulations',
  'Get Well',
  'Friendship',
]

const gallery = [
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-01.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-02.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-03.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-04.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-05.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-06.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-01.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-02.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-03.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-04.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-related-product-02.jpg',
  'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-related-product-04.jpg',
]

export default function Home() {
  const pathname = usePathname()
  return (
    <main className="font-sans">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-12 lg:pt-20 lg:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Generate your Custom Greeting <span className="text-indigo-600">Cards</span> in Seconds
          </h1>
          <p className="mt-4 text-sm leading-6 text-gray-600 sm:text-base">
            Whether it’s birthdays, anniversaries, holidays, or just because, our AI-powered card
            designer helps you craft heartfelt messages and stunning designs in a click.
          </p>
          
          {/* search */}
          <div className="mt-8">
            <HeroSearch />
          </div>

          
        </div>
      </section>

      {/* Gallery with category selector */}
      <section id="gallery" className="mx-auto max-w-7xl px-4">
        <GallerySection chips={chips} />
      </section>

      {/* Features - What do you get? */}
      <section className="mx-auto mt-16 max-w-7xl px-4">
        <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">What do you get?</h2>
        <p className="mx-auto mt-1 max-w-2xl text-center text-sm text-gray-500">Experience the Power of AI Image Generator</p>

        <WhatYouGetGrid />
      </section>

      {/* Made with SmartWish */}
      <section className="mx-auto mt-14 max-w-7xl px-4">
        <MadeWithSmartWish />
      </section>

      {/* Calendar moved to /home */}

      {/* CTA banner (updated full-width) */}
      <section className="mt-16">
        <div className="relative w-full bg-black">
          {/* grid background, visible even when zoomed out */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:28px_28px]" />

          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28 lg:py-36">
            <div className="flex flex-col items-center text-center">
              <h3 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Create Your Greeting Cards With Just a Few Clicks
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
                Design beautiful, personalized cards in seconds. No design skills required.
              </p>
              <Link
                href={`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition-all duration-200 hover:bg-indigo-600 hover:text-white hover:ring-indigo-500 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                Try it Now
                <span aria-hidden className="ml-1">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function WhatYouGetGrid() {
  const items = whatYouGet

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
      {items.map((it, idx) => (
        <div
          key={idx}
          className={`group relative overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-200 shadow-sm transition hover:shadow-md hover:ring-gray-300 ${
            it.span === 7 ? 'lg:col-span-7' : 'lg:col-span-5'
          }`}
        >
          {/* Mobile: side-by-side layout with 70/30 split */}
          <div className="flex md:hidden min-h-[180px] p-6">
            <div className="flex-1 pr-4" style={{width: '70%'}}>
              <h3 className="text-lg font-semibold tracking-tight text-gray-900 leading-6">{it.title}</h3>
              <p className="mt-2 text-[0.925rem] leading-6 text-gray-500 group-hover:text-gray-600">{it.description}</p>
            </div>
            <div className="relative flex-shrink-0 ml-4" style={{width: '30%'}}>
              <img
                alt=""
                src={it.image}
                className="pointer-events-none w-full h-auto object-contain rounded-lg"
              />
            </div>
          </div>
          
          {/* Desktop: side-by-side layout */}
          <div className="hidden md:block relative min-h-[200px] lg:min-h-[220px] p-8">
            <div className="pr-56">
              <h3 className="text-xl font-semibold tracking-tight text-gray-900 leading-6">{it.title}</h3>
              <p className="mt-2 text-[0.925rem] leading-6 text-gray-500 group-hover:text-gray-600">{it.description}</p>
            </div>
            <img
              alt=""
              src={it.image}
              className="pointer-events-none absolute -bottom-6 right-0 h-40 w-52 rounded-tl-lg object-cover object-top"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function CalendarGrid() {
  const events = [
    { id: 1, name: 'Maple syrup museum', time: '3PM', datetime: '2022-01-15T09:00', href: '#' },
    { id: 2, name: 'Hockey game', time: '7PM', datetime: '2022-01-22T19:00', href: '#' },
  ]
  const days = [
    { date: '2021-12-27', events: [] },
    { date: '2021-12-28', events: [] },
    { date: '2021-12-29', events: [] },
    { date: '2021-12-30', events: [] },
    { date: '2021-12-31', events: [] },
    { date: '2022-01-01', isCurrentMonth: true, events: [] },
    { date: '2022-01-02', isCurrentMonth: true, events: [] },
    {
      date: '2022-01-03',
      isCurrentMonth: true,
      events: [
        { id: 1, name: 'Design review', time: '10AM', datetime: '2022-01-03T10:00', href: '#' },
        { id: 2, name: 'Sales meeting', time: '2PM', datetime: '2022-01-03T14:00', href: '#' },
      ],
    },
    { date: '2022-01-04', isCurrentMonth: true, events: [] },
    { date: '2022-01-05', isCurrentMonth: true, events: [] },
    { date: '2022-01-06', isCurrentMonth: true, events: [] },
    {
      date: '2022-01-07',
      isCurrentMonth: true,
      events: [{ id: 3, name: 'Date night', time: '6PM', datetime: '2022-01-08T18:00', href: '#' }],
    },
    { date: '2022-01-08', isCurrentMonth: true, events: [] },
    { date: '2022-01-09', isCurrentMonth: true, events: [] },
    { date: '2022-01-10', isCurrentMonth: true, events: [] },
    { date: '2022-01-11', isCurrentMonth: true, events: [] },
    {
      date: '2022-01-12',
      isCurrentMonth: true,
      isToday: true,
      events: [{ id: 6, name: "Sam's birthday party", time: '2PM', datetime: '2022-01-25T14:00', href: '#' }],
    },
    { date: '2022-01-13', isCurrentMonth: true, events: [] },
    { date: '2022-01-14', isCurrentMonth: true, events: [] },
    { date: '2022-01-15', isCurrentMonth: true, events: [] },
    { date: '2022-01-16', isCurrentMonth: true, events: [] },
    { date: '2022-01-17', isCurrentMonth: true, events: [] },
    { date: '2022-01-18', isCurrentMonth: true, events: [] },
    { date: '2022-01-19', isCurrentMonth: true, events: [] },
    { date: '2022-01-20', isCurrentMonth: true, events: [] },
    { date: '2022-01-21', isCurrentMonth: true, events: [] },
    {
      date: '2022-01-22',
      isCurrentMonth: true,
      isSelected: true,
      events: [
        { id: 4, name: 'Maple syrup museum', time: '3PM', datetime: '2022-01-22T15:00', href: '#' },
        { id: 5, name: 'Hockey game', time: '7PM', datetime: '2022-01-22T19:00', href: '#' },
      ],
    },
    { date: '2022-01-23', isCurrentMonth: true, events: [] },
    { date: '2022-01-24', isCurrentMonth: true, events: [] },
    { date: '2022-01-25', isCurrentMonth: true, events: [] },
    { date: '2022-01-26', isCurrentMonth: true, events: [] },
    { date: '2022-01-27', isCurrentMonth: true, events: [] },
    { date: '2022-01-28', isCurrentMonth: true, events: [] },
    { date: '2022-01-29', isCurrentMonth: true, events: [] },
    { date: '2022-01-30', isCurrentMonth: true, events: [] },
    { date: '2022-01-31', isCurrentMonth: true, events: [] },
    { date: '2022-02-01', events: [] },
    { date: '2022-02-02', events: [] },
    { date: '2022-02-03', events: [] },
    {
      date: '2022-02-04',
      events: [{ id: 7, name: 'Cinema with friends', time: '9PM', datetime: '2022-02-04T21:00', href: '#' }],
    },
    { date: '2022-02-05', events: [] },
    { date: '2022-02-06', events: [] },
  ]

  return (
    <div className="shadow-sm ring-1 ring-black/5 lg:flex lg:flex-auto lg:flex-col">
      <div className="grid grid-cols-7 gap-px border-b border-gray-300 bg-gray-200 text-center text-xs/6 font-semibold text-gray-700 lg:flex-none">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
          <div key={d} className="flex justify-center bg-white py-2">{d}</div>
        ))}
      </div>
      <div className="flex bg-gray-200 text-xs/6 text-gray-700 lg:flex-auto">
        <div className="hidden w-full lg:grid lg:grid-cols-7 lg:grid-rows-6 lg:gap-px">
          {days.map((day) => (
            <div key={day.date} data-is-today={day.isToday ? '' : undefined} data-is-current-month={day.isCurrentMonth ? '' : undefined} className="group relative bg-gray-50 px-3 py-2 text-gray-500 data-is-current-month:bg-white">
              <time dateTime={day.date || ''} className="relative group-not-data-is-current-month:opacity-75 in-data-is-today:flex in-data-is-today:size-6 in-data-is-today:items-center in-data-is-today:justify-center in-data-is-today:rounded-full in-data-is-today:bg-indigo-600 in-data-is-today:font-semibold in-data-is-today:text-white">
                {(day.date || '').split('-').pop()?.replace(/^0/, '')}
              </time>
              {day.events.length > 0 ? (
                <ol className="mt-2">
                  {day.events.slice(0, 2).map((event) => (
                    <li key={event.id}>
                      <a href={event.href} className="group flex">
                        <p className="flex-auto truncate font-medium text-gray-900 group-hover:text-indigo-600">{event.name}</p>
                        <time dateTime={event.datetime} className="ml-3 hidden flex-none text-gray-500 group-hover:text-indigo-600 xl:block">{event.time}</time>
                      </a>
                    </li>
                  ))}
                  {day.events.length > 2 ? <li className="text-gray-500">+ {day.events.length - 2} more</li> : null}
                </ol>
              ) : null}
            </div>
          ))}
        </div>
        <div className="isolate grid w-full grid-cols-7 grid-rows-6 gap-px lg:hidden">
          {days.map((day) => (
            <button key={day.date} type="button" data-is-today={day.isToday ? '' : undefined} data-is-selected={day.isSelected ? '' : undefined} data-is-current-month={day.isCurrentMonth ? '' : undefined} className="group relative flex h-14 flex-col px-3 py-2 not-data-is-current-month:bg-gray-50 not-data-is-selected:not-data-is-current-month:not-data-is-today:text-gray-500 hover:bg-gray-100 focus:z-10 data-is-current-month:bg-white not-data-is-selected:data-is-current-month:not-data-is-today:text-gray-900 data-is-current-month:hover:bg-gray-100 data-is-selected:font-semibold data-is-selected:text-white data-is-today:font-semibold not-data-is-selected:data-is-today:text-indigo-600">
              <time dateTime={day.date || ''} className="ml-auto group-not-data-is-current-month:opacity-75 in-data-is-selected:flex in-data-is-selected:size-6 in-data-is-selected:items-center in-data-is-selected:justify-center in-data-is-selected:rounded-full in-data-is-selected:not-in-data-is-today:bg-gray-900 in-data-is-selected:in-data-is-today:bg-indigo-600">
                {(day.date || '').split('-').pop()?.replace(/^0/, '')}
              </time>
              <span className="sr-only">{day.events.length} events</span>
              {day.events.length > 0 ? (
                <span className="-mx-0.5 mt-auto flex flex-wrap-reverse">
                  {day.events.map((event) => (
                    <span key={event.id} className="mx-0.5 mb-1 size-1.5 rounded-full bg-gray-400" />
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="relative px-4 py-10 sm:px-6 lg:hidden">
        <ol className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white text-sm shadow-sm outline-1 outline-black/5">
          {events.map((event) => (
            <li key={event.id} className="group flex p-4 pr-6 focus-within:bg-gray-50 hover:bg-gray-50">
              <div className="flex-auto">
                <p className="font-semibold text-gray-900">{event.name}</p>
                <time dateTime={event.datetime} className="mt-2 flex items-center text-gray-700">
                  <ClockIcon aria-hidden className="mr-2 size-5 text-gray-400" />
                  {event.time}
                </time>
              </div>
              <a href={event.href} className="ml-6 flex-none self-center rounded-md bg-white px-3 py-2 font-semibold text-gray-900 opacity-0 shadow-xs ring-1 ring-gray-300 ring-inset group-hover:opacity-100 hover:ring-gray-400 focus:opacity-100">
                Edit<span className="sr-only">, {event.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
