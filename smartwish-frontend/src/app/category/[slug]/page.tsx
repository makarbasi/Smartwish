"use client"

import { useMemo, useState, use } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ChevronDownIcon, FunnelIcon, HeartIcon, ArrowDownTrayIcon, PlusIcon } from '@heroicons/react/20/solid'
import { XMarkIcon } from '@heroicons/react/24/outline'
import QuickView, { QuickViewProduct } from '@/components/QuickView'

type CardProduct = {
  id: number
  name: string
  price: string
  rating: number
  reviewCount: number
  imageSrc: string
  imageAlt: string
  publisher: { name: string; avatar: string }
  downloads: number
  likes: number
}

const sortOptions = [
  { name: 'Most Popular', value: 'popular' },
  { name: 'Best Rating', value: 'rating' },
  { name: 'Newest', value: 'new' },
  { name: 'Price: Low to High', value: 'price-asc' },
  { name: 'Price: High to Low', value: 'price-desc' },
]

const filters = {
  price: [
    { value: '0-25', label: '$0 - $25' },
    { value: '25-50', label: '$25 - $50' },
    { value: '50-75', label: '$50 - $75' },
    { value: '75+', label: '$75+' },
  ],
}

// Extra filters for sidebar and mobile dialog
const extraFilters = [
  {
    id: 'color',
    name: 'Color',
    options: [
      { value: 'white', label: 'White' },
      { value: 'beige', label: 'Beige' },
      { value: 'blue', label: 'Blue' },
      { value: 'brown', label: 'Brown' },
      { value: 'green', label: 'Green' },
      { value: 'purple', label: 'Purple' },
    ],
  },
  {
    id: 'category',
    name: 'Category',
    options: [
      { value: 'new-arrivals', label: 'All New Arrivals' },
      { value: 'tees', label: 'Tees' },
      { value: 'crewnecks', label: 'Crewnecks' },
      { value: 'sweatshirts', label: 'Sweatshirts' },
      { value: 'pants-shorts', label: 'Pants & Shorts' },
    ],
  },
  {
    id: 'sizes',
    name: 'Sizes',
    options: [
      { value: 'xs', label: 'XS' },
      { value: 's', label: 'S' },
      { value: 'm', label: 'M' },
      { value: 'l', label: 'L' },
      { value: 'xl', label: 'XL' },
      { value: '2xl', label: '2XL' },
    ],
  },
]

const demoProducts: CardProduct[] = [
  {
    id: 1,
    name: 'Wish Card – Floral Joy',
    price: '$12',
    rating: 5,
    reviewCount: 38,
    imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-01.jpg',
    imageAlt: 'Wish card cover',
    publisher: { name: 'SmartWish Studio', avatar: 'https://i.pravatar.cc/80?img=5' },
    downloads: 2431,
    likes: 186,
  },
  {
    id: 2,
    name: 'Wish Card – Minimal Lines',
    price: '$9',
    rating: 4,
    reviewCount: 18,
    imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-02.jpg',
    imageAlt: 'Wish card cover',
    publisher: { name: 'SmartWish Studio', avatar: 'https://i.pravatar.cc/80?img=6' },
    downloads: 1210,
    likes: 92,
  },
  {
    id: 3,
    name: 'Wish Card – Pastel Shapes',
    price: '$11',
    rating: 5,
    reviewCount: 22,
    imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-03.jpg',
    imageAlt: 'Wish card cover',
    publisher: { name: 'SmartWish Studio', avatar: 'https://i.pravatar.cc/80?img=7' },
    downloads: 1789,
    likes: 145,
  },
  {
    id: 4,
    name: 'Wish Card – Bold Type',
    price: '$10',
    rating: 4,
    reviewCount: 12,
    imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-05-image-card-04.jpg',
    imageAlt: 'Wish card cover',
    publisher: { name: 'SmartWish Studio', avatar: 'https://i.pravatar.cc/80?img=8' },
    downloads: 954,
    likes: 61,
  },
]

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const [sort, setSort] = useState('popular')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickProduct, setQuickProduct] = useState<QuickViewProduct | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const { slug } = use(params)

  const title = useMemo(() => {
    return slug
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
  }, [slug])

  const productHref = `/category/${slug}/product`

  const openQuick = (p: CardProduct) => {
    const qp: QuickViewProduct = {
      name: p.name,
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      href: productHref,
      imageSrc: p.imageSrc,
      imageAlt: p.imageAlt,
      publisher: p.publisher,
      downloads: p.downloads,
      likes: p.likes,
    }
    setQuickProduct(qp)
    setQuickOpen(true)
  }

  return (
    <main className="pb-24">
      <div className="px-4 py-10 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">
          Explore our curated wish cards in {title}.
        </p>
      </div>

      <Disclosure as="section" className="grid items-center border-t border-b border-gray-200">
        <div className="relative col-start-1 row-start-1 py-4">
          <div className="mx-auto flex max-w-7xl divide-x divide-gray-200 px-4 text-sm sm:px-6 lg:px-8">
            <div className="pr-6">
              <DisclosureButton className="group flex items-center font-medium text-gray-700">
                <FunnelIcon aria-hidden className="mr-2 size-5 flex-none text-gray-400 group-hover:text-gray-500" />
                Filters
              </DisclosureButton>
            </div>
            <div className="pl-6">
              <Menu as="div" className="relative inline-block">
                <MenuButton className="group inline-flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-900">
                  Sort
                  <ChevronDownIcon aria-hidden className="-mr-1 ml-1 size-5 shrink-0 text-gray-400 group-hover:text-gray-500" />
                </MenuButton>
                <MenuItems transition className="absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black/5 transition data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in">
                  <div className="py-1">
                    {sortOptions.map((o) => (
                      <MenuItem key={o.value}>
                        <button
                          onClick={() => setSort(o.value)}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-600 data-focus:bg-gray-100"
                        >
                          {o.name}
                        </button>
                      </MenuItem>
                    ))}
                  </div>
                </MenuItems>
              </Menu>
            </div>
          </div>
        </div>
        <DisclosurePanel className="border-t border-gray-200 py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filters.price.map((f) => (
                <label key={f.value} className="flex items-center gap-3 text-gray-700">
                  <input type="checkbox" className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      {/* Mobile filter dialog */}
      <Dialog open={mobileFiltersOpen} onClose={setMobileFiltersOpen} className="relative z-40 lg:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-closed:opacity-0" />
        <div className="fixed inset-0 z-40 flex">
          <DialogPanel transition className="relative ml-auto flex h-full w-full max-w-xs transform flex-col overflow-y-auto bg-white pt-4 pb-6 shadow-xl transition duration-300 ease-in-out data-closed:translate-x-full">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-medium text-gray-900">Filters</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="relative -mr-2 flex size-10 items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden">
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Close menu</span>
                <XMarkIcon aria-hidden className="size-6" />
              </button>
            </div>
            <form className="mt-4">
              {extraFilters.map((section) => (
                <Disclosure key={section.id} as="div" className="border-t border-gray-200 pt-4 pb-4">
                  <fieldset>
                    <legend className="w-full px-2">
                      <DisclosureButton className="group flex w-full items-center justify-between p-2 text-gray-400 hover:text-gray-500">
                        <span className="text-sm font-medium text-gray-900">{section.name}</span>
                        <span className="ml-6 flex h-7 items-center">
                          <ChevronDownIcon aria-hidden className="size-5 rotate-0 transform group-data-open:-rotate-180" />
                        </span>
                      </DisclosureButton>
                    </legend>
                    <DisclosurePanel className="px-4 pt-4 pb-2">
                      <div className="space-y-6">
                        {section.options.map((option, optionIdx) => (
                          <div key={option.value} className="flex gap-3">
                            <div className="flex h-5 shrink-0 items-center">
                              <div className="group grid size-4 grid-cols-1">
                                <input
                                  defaultValue={option.value}
                                  id={`${section.id}-${optionIdx}-mobile`}
                                  name={`${section.id}[]`}
                                  type="checkbox"
                                  className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                                />
                                <svg fill="none" viewBox="0 0 14 14" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25">
                                  <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                                  <path d="M3 7H11" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                                </svg>
                              </div>
                            </div>
                            <label htmlFor={`${section.id}-${optionIdx}-mobile`} className="text-sm text-gray-500">{option.label}</label>
                          </div>
                        ))}
                      </div>
                    </DisclosurePanel>
                  </fieldset>
                </Disclosure>
              ))}
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Filters + Products layout */}
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="pt-8 pb-16 lg:grid lg:grid-cols-3 lg:gap-x-8 xl:grid-cols-4">
          <aside>
            <h2 className="sr-only">Filters</h2>
            <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex items-center lg:hidden">
              <span className="text-sm font-medium text-gray-700">Filters</span>
              <PlusIcon aria-hidden className="ml-1 size-5 shrink-0 text-gray-400" />
            </button>
            <div className="hidden lg:block">
              <form className="divide-y divide-gray-200">
                {extraFilters.map((section) => (
                  <div key={section.id} className="py-10 first:pt-0 last:pb-0">
                    <fieldset>
                      <legend className="block text-sm font-medium text-gray-900">{section.name}</legend>
                      <div className="space-y-3 pt-6">
                        {section.options.map((option, optionIdx) => (
                          <div key={option.value} className="flex gap-3">
                            <div className="flex h-5 shrink-0 items-center">
                              <div className="group grid size-4 grid-cols-1">
                                <input
                                  defaultValue={option.value}
                                  id={`${section.id}-${optionIdx}`}
                                  name={`${section.id}[]`}
                                  type="checkbox"
                                  className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                                />
                                <svg fill="none" viewBox="0 0 14 14" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25">
                                  <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                                  <path d="M3 7H11" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                                </svg>
                              </div>
                            </div>
                            <label htmlFor={`${section.id}-${optionIdx}`} className="text-sm text-gray-600">{option.label}</label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                ))}
              </form>
            </div>
          </aside>

          <section className="mt-6 lg:col-span-2 lg:mt-0 xl:col-span-3">
            <div className="-mx-px grid grid-cols-2 border-l border-gray-200 sm:mx-0 md:grid-cols-3 lg:grid-cols-3">
              {demoProducts.map((p) => {
                const href = productHref
                return (
                  <div key={p.id} className="group border-r border-b border-gray-200 p-4 sm:p-6 transition-shadow duration-300 hover:shadow-md">
                    <a href={href} className="block overflow-hidden rounded-lg">
                      <img
                        alt={p.imageAlt}
                        src={p.imageSrc}
                        className="aspect-square w-full rounded-lg bg-gray-200 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </a>
                    <div className="pt-6 pb-4 text-center">
                      <h3 className="text-sm font-medium text-gray-900">
                        <a href={href} className="relative inline-block">
                          {p.name}
                        </a>
                      </h3>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <img src={p.publisher.avatar} alt="" className="h-6 w-6 rounded-full ring-1 ring-gray-200" />
                        <span className="text-xs text-gray-700">{p.publisher.name}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-700">
                        <span className="inline-flex items-center gap-1"><ArrowDownTrayIcon className="h-4 w-4 text-gray-400" />{p.downloads.toLocaleString()} downloads</span>
                        <span aria-hidden className="text-gray-300">·</span>
                        <span className="inline-flex items-center gap-1"><HeartIcon className="h-4 w-4 text-rose-500" />{p.likes.toLocaleString()} likes</span>
                      </div>
                      <p className="mt-4 text-base font-medium text-gray-900">{p.price}</p>
                      <button
                        type="button"
                        onClick={() => openQuick(p)}
                        className="mt-3 inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        Quick view
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {quickProduct && (
        <QuickView open={quickOpen} onClose={setQuickOpen} product={quickProduct} />
      )}
    </main>
  )
}