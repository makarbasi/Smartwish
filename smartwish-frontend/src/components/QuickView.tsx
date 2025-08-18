'use client'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { HeartIcon, ArrowDownTrayIcon } from '@heroicons/react/20/solid'

export type QuickViewProduct = {
  name: string
  price: string
  rating: number
  reviewCount: number
  href: string
  imageSrc: string
  imageAlt: string
  colors?: { id: string; name: string; classes: string }[]
  sizes?: { id: string; name: string; inStock: boolean }[]
  publisher?: { name: string; avatar: string }
  downloads?: number
  likes?: number
  category?: string
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function QuickView({
  open,
  onClose,
  product,
}: {
  open: boolean
  onClose: (value: boolean) => void
  product: QuickViewProduct
}) {
  const hasColors = product.colors && product.colors.length > 0
  const hasSizes = product.sizes && product.sizes.length > 0

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 hidden bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in md:block"
      />

      <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div className="flex min-h-full items-stretch justify-center text-center md:items-center md:px-2 lg:px-4">
          <span aria-hidden="true" className="hidden md:inline-block md:h-screen md:align-middle">
            &#8203;
          </span>
          <DialogPanel
            transition
            className="flex w-full transform text-left text-base transition data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in md:my-8 md:max-w-2xl md:px-4 data-closed:md:translate-y-0 data-closed:md:scale-95 lg:max-w-4xl"
          >
            <div className="relative flex w-full items-center overflow-hidden bg-white px-4 pt-14 pb-8 shadow-2xl sm:px-6 sm:pt-8 md:p-6 lg:p-8">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 sm:top-8 sm:right-6 md:top-6 md:right-6 lg:top-8 lg:right-8"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>

              <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-12 lg:items-center lg:gap-x-8">
                <img
                  alt={product.imageAlt}
                  src={product.imageSrc}
                  className="aspect-square w-full rounded-lg bg-gray-100 object-cover sm:col-span-4 lg:col-span-5"
                />
                <div className="sm:col-span-8 lg:col-span-7">
                  <h2 className="text-xl font-medium text-gray-900 sm:pr-12">{product.name}</h2>

                  {/* Price */}
                  <p className="mt-1 font-medium text-gray-900">{product.price}</p>

                  {/* Publisher and metrics to match card style */}
                  {(product.publisher || product.downloads || product.likes) && (
                    <div className="mt-3 space-y-2">
                      {product.publisher && (
                        <div className="flex items-center gap-2">
                          <img src={product.publisher.avatar} alt="" className="h-6 w-6 rounded-full ring-1 ring-gray-200" />
                          <span className="text-xs text-gray-700">{product.publisher.name}</span>
                          {product.category && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                              {product.category}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-700">
                        {typeof product.downloads === 'number' && (
                          <span className="inline-flex items-center gap-1"><ArrowDownTrayIcon className="h-4 w-4 text-gray-400" />{product.downloads.toLocaleString()} downloads</span>
                        )}
                        {typeof product.likes === 'number' && (
                          <>
                            <span aria-hidden className="text-gray-300">·</span>
                            <span className="inline-flex items-center gap-1"><HeartIcon className="h-4 w-4 text-rose-500" />{product.likes.toLocaleString()} likes</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Options if present */}
                  {(hasColors || hasSizes) && (
                    <section aria-labelledby="options-heading" className="mt-8">
                      <h3 id="options-heading" className="sr-only">
                        Product options
                      </h3>

                      <form>
                        {hasColors && (
                          <fieldset aria-label="Choose a color">
                            <legend className="text-sm font-medium text-gray-900">Color</legend>
                            <div className="mt-2 flex items-center gap-x-3">
                              {product.colors!.map((color, idx) => (
                                <div key={color.id} className="flex rounded-full outline -outline-offset-1 outline-black/10">
                                  <input
                                    defaultValue={color.id}
                                    defaultChecked={idx === 0}
                                    name="color"
                                    type="radio"
                                    aria-label={color.name}
                                    className={classNames(
                                      color.classes,
                                      'size-8 appearance-none rounded-full forced-color-adjust-none checked:outline-2 checked:outline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-3',
                                    )}
                                  />
                                </div>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        {hasSizes && (
                          <fieldset aria-label="Choose a size" className="mt-8">
                            <div className="text-sm font-medium text-gray-900">Size</div>
                            <div className="mt-2 grid grid-cols-4 gap-3">
                              {product.sizes!.map((size, idx) => (
                                <label
                                  key={size.id}
                                  aria-label={size.name}
                                  className="group relative flex items-center justify-center rounded-md border border-gray-300 bg-white p-3 has-checked:border-indigo-600 has-checked:bg-indigo-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-indigo-600 has-disabled:border-gray-400 has-disabled:bg-gray-200 has-disabled:opacity-25"
                                >
                                  <input
                                    defaultValue={size.id}
                                    defaultChecked={idx === 0}
                                    name="size"
                                    type="radio"
                                    disabled={!size.inStock}
                                    className="absolute inset-0 appearance-none focus:outline-none disabled:cursor-not-allowed"
                                  />
                                  <span className="text-sm font-medium text-gray-900 uppercase group-has-checked:text-white">
                                    {size.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        <button
                          type="submit"
                          className="mt-8 flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden"
                        >
                          Add to bag
                        </button>

                        <p className="absolute top-4 left-4 text-center sm:static sm:mt-8">
                          <a href={product.href} className="font-medium text-indigo-600 hover:text-indigo-500">
                            View full details
                          </a>
                        </p>
                      </form>
                    </section>
                  )}

                  {!(hasColors || hasSizes) && (
                    <div className="mt-6">
                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-md bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden"
                      >
                        Add to bag
                      </button>
                      <p className="mt-4 text-center">
                        <a href={product.href} className="font-medium text-indigo-600 hover:text-indigo-500">
                          View full details
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}