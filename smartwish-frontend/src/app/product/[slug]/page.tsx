// server component: no client hooks
import { HeartIcon, ArrowDownTrayIcon } from '@heroicons/react/20/solid'

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

type ProductImage = {
  id: number
  imageSrc: string
  imageAlt: string
  primary?: boolean
}

type Product = {
  name: string
  price: string
  href: string
  images: ProductImage[]
  finishes: { id: string; name: string; classes: string }[]
  packs: { id: string; name: string; inStock: boolean }[]
  descriptionHtml: string
  details: string[]
  rating: number
  reviewCount: number
  publisher: { name: string; avatar: string }
  downloads: number
  likes: number
  category: string
}

type Review = {
  id: number
  title: string
  rating: number
  contentHtml: string
  author: string
  date: string
  datetime: string
}

type Related = { id: number; name: string; href: string; imageSrc: string; imageAlt: string; price: string; color: string }

function buildDemoProduct(title: string): { product: Product; reviews: Review[]; related: Related[] } {
  const product: Product = {
    name: `${title} Wish Card`,
    price: '$12',
    href: '#',
    images: [
      {
        id: 1,
        imageSrc:
          'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-featured-product-shot.jpg',
        imageAlt: 'Front cover of wish card.',
        primary: true,
      },
      {
        id: 2,
        imageSrc:
          'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-product-shot-01.jpg',
        imageAlt: 'Wish card opened showing interior.',
      },
      {
        id: 3,
        imageSrc:
          'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-product-shot-02.jpg',
        imageAlt: 'Back side with brand mark.',
      },
    ],
    finishes: [
      { id: 'matte', name: 'Matte', classes: 'bg-gray-300 checked:outline-gray-400' },
      { id: 'gloss', name: 'Gloss', classes: 'bg-gray-200 checked:outline-gray-300' },
      { id: 'foil', name: 'Foil', classes: 'bg-yellow-300 checked:outline-yellow-400' },
    ],
    packs: [
      { id: 'single', name: 'Single', inStock: true },
      { id: '5-pack', name: '5 Pack', inStock: true },
      { id: '10-pack', name: '10 Pack', inStock: true },
      { id: '25-pack', name: '25 Pack', inStock: false },
    ],
    descriptionHtml:
      '<p>Premium wish card printed on archival paper with optional foil finish. Blank interior for your message.</p><p>Pairs beautifully with our coordinated envelopes. Sustainably produced.</p>',
    details: ['Archival 300gsm paper', 'A6 size (4.5in × 6.25in)', 'Envelope included', 'Made locally'],
    rating: 4.6,
    reviewCount: 127,
    publisher: {
      name: 'SmartWish Studio',
      avatar: 'https://i.pravatar.cc/80?img=5',
    },
    downloads: 2431,
    likes: 186,
    category: 'Floral',
  }

  const reviews: Review[] = [
    {
      id: 1,
      title: "Can't say enough good things",
      rating: 5,
      contentHtml:
        '<p>Incredible quality and the foil finish feels premium. Shipping was quick and the packaging was beautiful.</p>',
      author: 'Risako M',
      date: 'May 16, 2024',
      datetime: '2024-05-16',
    },
    {
      id: 2,
      title: 'Very classy and looks the part',
      rating: 5,
      contentHtml:
        '<p>The paper weight is perfect and the print is crisp. I ordered a 10-pack for our office and everyone loved it.</p>',
      author: 'Jackie H',
      date: 'Apr 6, 2024',
      datetime: '2024-04-06',
    },
    {
      id: 3,
      title: 'Lovely design',
      rating: 4,
      contentHtml:
        '<p>Great value and colors. Would buy again. Consider adding more pastel options!</p>',
      author: 'Laura G',
      date: 'Feb 24, 2024',
      datetime: '2024-02-24',
    },
  ]

  const related: Related[] = [
    {
      id: 1,
      name: 'Wish Card – Minimal Lines',
      href: '#',
      imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-related-product-02.jpg',
      imageAlt: 'Minimal line artwork wish card.',
      price: '$9',
      color: 'Pastel Blue',
    },
    {
      id: 2,
      name: 'Wish Card – Bold Type',
      href: '#',
      imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-related-product-03.jpg',
      imageAlt: 'Bold typography wish card.',
      price: '$10',
      color: 'Charcoal',
    },
    {
      id: 3,
      name: 'Wish Card – Pastel Shapes',
      href: '#',
      imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-related-product-04.jpg',
      imageAlt: 'Pastel geometric wish card.',
      price: '$11',
      color: 'Blush',
    },
    {
      id: 4,
      name: 'Wish Card – Floral Joy',
      href: '#',
      imageSrc: 'https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-01-related-product-01.jpg',
      imageAlt: 'Floral wish card.',
      price: '$12',
      color: 'Garden',
    },
  ]

  return { product, reviews, related }
}

export default async function ProductPage({ params }: { params?: Promise<{ slug?: string | string[] | undefined }> }) {
  const resolved = (await params) ?? { slug: '' }
  const slug = Array.isArray(resolved.slug) ? resolved.slug[0] ?? '' : resolved.slug ?? ''
  const title = slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')

  const { product, reviews, related } = buildDemoProduct(title)

  return (
    <main className="mx-auto mt-8 max-w-2xl px-4 pb-16 sm:px-6 sm:pb-24 lg:max-w-7xl lg:px-8">
      <div className="lg:grid lg:auto-rows-min lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-5 lg:col-start-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-medium text-gray-900">{product.name}</h1>
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.publisher.avatar} alt="" className="h-7 w-7 rounded-full ring-1 ring-gray-200" />
                <span className="text-sm text-gray-700">{product.publisher.name}</span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                  {product.category}
                </span>
              </div>
            </div>
            <p className="text-xl font-medium text-gray-900">{product.price}</p>
          </div>

          {/* Metrics: downloads and likes */}
          <div className="mt-4 flex items-center gap-6 text-sm text-gray-700">
            <span className="inline-flex items-center gap-1">
              <ArrowDownTrayIcon className="h-5 w-5 text-gray-400" />
              {product.downloads.toLocaleString()} downloads
            </span>
            <span aria-hidden className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1">
              <HeartIcon className="h-5 w-5 text-rose-500" />
              {product.likes.toLocaleString()} likes
            </span>
          </div>
        </div>

        {/* Image gallery */}
        <div className="mt-8 lg:col-span-7 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:mt-0">
          <h2 className="sr-only">Images</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-3 lg:gap-8">
            {product.images.map((image) => (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={image.id}
                  alt={image.imageAlt}
                  src={image.imageSrc}
                  className={classNames(image.primary ? 'lg:col-span-2 lg:row-span-2' : 'hidden lg:block', 'rounded-lg')}
                />
              </>
            ))}
          </div>
        </div>

        <div className="mt-8 lg:col-span-5">
          <form>
            {/* Finish picker */}
            <div>
              <h2 className="text-sm font-medium text-gray-900">Finish</h2>
              <fieldset aria-label="Choose a finish" className="mt-2">
                <div className="flex items-center gap-x-3">
                  {product.finishes.map((f, idx) => (
                    <div key={f.id} className="flex rounded-full outline -outline-offset-1 outline-black/10">
                      <input
                        defaultValue={f.id}
                        defaultChecked={idx === 0}
                        name="finish"
                        type="radio"
                        aria-label={f.name}
                        className={classNames(
                          f.classes,
                          'size-8 appearance-none rounded-full forced-color-adjust-none checked:outline-2 checked:outline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-3',
                        )}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Pack picker */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-900">Pack</h2>
                <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Pack details
                </a>
              </div>

              <fieldset aria-label="Choose a pack" className="mt-2">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {product.packs.map((p, idx) => (
                    <label
                      key={p.id}
                      aria-label={p.name}
                      className="group relative flex items-center justify-center rounded-md border border-gray-300 bg-white p-3 has-checked:border-indigo-600 has-checked:bg-indigo-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-indigo-600 has-disabled:border-gray-400 has-disabled:bg-gray-200 has-disabled:opacity-25"
                    >
                      <input
                        defaultValue={p.id}
                        defaultChecked={idx === 1}
                        name="pack"
                        type="radio"
                        disabled={!p.inStock}
                        className="absolute inset-0 appearance-none focus:outline-none disabled:cursor-not-allowed"
                      />
                      <span className="text-sm font-medium text-gray-900 group-has-checked:text-white">{p.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <button
              type="submit"
              className="mt-8 flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden"
            >
              Add to cart
            </button>
          </form>

          {/* Product details */}
          <div className="mt-10">
            <h2 className="text-sm font-medium text-gray-900">Description</h2>
            <div className="mt-4 space-y-4 text-sm/6 text-gray-500" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          </div>

          <div className="mt-8 border-t border-gray-200 pt-8">
            <h2 className="text-sm font-medium text-gray-900">Specs</h2>
            <div className="mt-4">
              <ul role="list" className="list-disc space-y-1 pl-5 text-sm/6 text-gray-500 marker:text-gray-300">
                {product.details.map((d) => (
                  <li key={d} className="pl-2">{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Recent reviews */}
      <section aria-labelledby="reviews-heading" className="mt-16 sm:mt-24">
        <h2 id="reviews-heading" className="text-lg font-medium text-gray-900">
          Recent reviews
        </h2>
        <div className="mt-6 divide-y divide-gray-200 border-t border-b border-gray-200">
          {reviews.map((review) => (
            <div key={review.id} className="py-10 lg:grid lg:grid-cols-12 lg:gap-x-8">
              <div className="lg:col-span-8 lg:col-start-5 xl:col-span-9 xl:col-start-4 xl:grid xl:grid-cols-3 xl:items-start xl:gap-x-8">
                <div className="flex items-center xl:col-span-1">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                    {review.rating.toFixed(1)} / 5
                  </span>
                </div>
                <div className="mt-4 lg:mt-6 xl:col-span-2 xl:mt-0">
                  <h3 className="text-sm font-medium text-gray-900">{review.title}</h3>
                  <div className="mt-3 space-y-6 text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: review.contentHtml }} />
                </div>
              </div>
              <div className="mt-6 flex items-center text-sm lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:flex-col lg:items-start xl:col-span-3">
                <p className="font-medium text-gray-900">{review.author}</p>
                <time dateTime={review.datetime} className="ml-4 border-l border-gray-200 pl-4 text-gray-500 lg:mt-2 lg:ml-0 lg:border-0 lg:pl-0">
                  {review.date}
                </time>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Related products */}
      <section aria-labelledby="related-heading" className="mt-16 sm:mt-24">
        <h2 id="related-heading" className="text-lg font-medium text-gray-900">
          Customers also purchased
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
          {related.map((rp) => (
            <div key={rp.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={rp.imageAlt} src={rp.imageSrc} className="aspect-square w-full rounded-md object-cover group-hover:opacity-75 lg:aspect-auto lg:h-80" />
              <div className="mt-4 flex justify-between">
                <div>
                  <h3 className="text-sm text-gray-700">
                    <a href={rp.href}>
                      {rp.name}
                    </a>
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{rp.color}</p>
                </div>
                <p className="text-sm font-medium text-gray-900">{rp.price}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}