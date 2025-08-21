export default function TemplateCardSkeleton() {
  return (
    <div className="group cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200">
      <div className="relative overflow-hidden rounded-t-2xl">
        <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
        <div className="absolute right-3 top-3 flex gap-2">
          <div className="h-8 w-16 bg-gray-300 rounded-lg animate-pulse"></div>
          <div className="h-8 w-8 bg-gray-300 rounded-lg animate-pulse"></div>
        </div>
      </div>
      <div className="px-4 pt-3 pb-5 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <div className="mt-1.5 h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
      </div>
    </div>
  )
}