"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  HeartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import HTMLFlipBook from "react-pageflip";

type TemplateCard = {
  id: string;
  name: string;
  price: string;
  rating: number;
  reviewCount: number;
  imageSrc: string;
  imageAlt: string;
  publisher: { name: string; avatar: string };
  downloads: number;
  likes: number;
  pages?: string[];
};

interface TemplatePreviewModalProps {
  open: boolean;
  onClose: () => void;
  product: TemplateCard | null;
  onCustomize: (product: TemplateCard) => Promise<void>;
}

export default function TemplatePreviewModal({
  open,
  onClose,
  product,
  onCustomize,
}: TemplatePreviewModalProps) {
  console.log(
    "🎭 TemplatePreviewModal render - open:",
    open,
    "product:",
    !!product
  );
  const [currentPage, setCurrentPage] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset to first page when modal opens
  useEffect(() => {
    if (open) {
      setCurrentPage(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ left: 0 });
      }
    }
  }, [open]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [open, onClose]);

  if (!product) return null;

  const templatePages = product.pages || [product.imageSrc];
  const totalPages = templatePages.length;

  const handleNextPage = () => {
    // Check if we're on desktop (flipbook is visible)
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage < totalPages - 1) {
        flipBookRef.current.pageFlip().flipNext();
      }
    } else {
      // Tablet/Mobile: use scroll navigation
      if (currentPage < totalPages - 1) {
        scrollToPage(currentPage + 1);
      }
    }
  };

  const handlePrevPage = () => {
    // Check if we're on desktop (flipbook is visible)
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage > 0) {
        flipBookRef.current.pageFlip().flipPrev();
      }
    } else {
      // Tablet/Mobile: use scroll navigation
      if (currentPage > 0) {
        scrollToPage(currentPage - 1);
      }
    }
  };

  const handlePageFlip = (e: { data: number }) => {
    setCurrentPage(e.data);
  };

  // Handle scroll to update current page indicator
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const newPage = Math.round(scrollLeft / containerWidth);

    if (newPage !== currentPage && newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Scroll to specific page
  const scrollToPage = (pageIndex: number) => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    const scrollLeft = pageIndex * containerWidth;

    container.scrollTo({
      left: scrollLeft,
      behavior: "smooth",
    });
    setCurrentPage(pageIndex);
  };

  return (
    <Dialog open={open} onClose={() => {}} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div
        className="fixed inset-0 overflow-y-auto p-4 sm:p-8"
        onClick={(e) => {
          console.log("🌍 Background container clicked!");
          console.log("🎯 Click target:", e.target);
          console.log("🎯 Current target:", e.currentTarget);
          console.log("🔍 Are they the same?", e.target === e.currentTarget);
          // Only close if clicking the backdrop, not the content areas
          if (e.target === e.currentTarget) {
            console.log("✅ Closing modal - clicked on backdrop");
            onClose();
          } else {
            console.log("❌ Not closing - clicked on content");
          }
        }}
        style={{ touchAction: 'manipulation' }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 sm:grid-cols-[2fr_1fr]">
          <DialogPanel className="col-span-1 rounded-2xl bg-transparent">
            <div
              className="relative overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Desktop: Flipbook View */}
              <div className="hidden lg:flex items-center justify-center relative">
                {/* Previous Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPage();
                  }}
                  disabled={currentPage === 0}
                  className="absolute left-8 top-1/2 z-20 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>

                {/* Flipbook Container */}
                <div className="flipbook-container-desktop">
                  <HTMLFlipBook
                    ref={flipBookRef}
                    width={400}
                    height={550}
                    size="fixed"
                    startPage={0}
                    minWidth={200}
                    maxWidth={1000}
                    minHeight={200}
                    maxHeight={1000}
                    style={{}}
                    maxShadowOpacity={0.8}
                    showCover={true}
                    mobileScrollSupport={false}
                    onFlip={handlePageFlip}
                    className="flipbook-shadow"
                    flippingTime={800}
                    usePortrait={false}
                    startZIndex={10}
                    autoSize={false}
                    clickEventForward={true}
                    useMouseEvents={true}
                    swipeDistance={30}
                    showPageCorners={true}
                    disableFlipByClick={false}
                    drawShadow={true}
                  >
                    {templatePages.map((page, index) => (
                      <div key={index} className="page-hard">
                        <div className="page-content">
                          <Image
                            src={page}
                            alt={`${product.imageAlt} - Page ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="400px"
                          />
                        </div>
                      </div>
                    ))}
                  </HTMLFlipBook>
                </div>

                {/* Next Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPage();
                  }}
                  disabled={currentPage === totalPages - 1}
                  className="absolute right-8 top-1/2 z-20 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>

                {/* Page indicator */}
                <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                  {currentPage + 1} / {totalPages}
                </div>
              </div>

              {/* Tablet & Mobile: Scrollable Pages View */}
              <div className="lg:hidden relative">
                {/* Previous Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPage();
                  }}
                  disabled={currentPage === 0}
                  className="absolute left-4 top-1/2 z-30 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>

                <div
                  ref={scrollContainerRef}
                  className="overflow-x-auto scrollbar-hide"
                  onScroll={handleScroll}
                >
                  <div className="flex snap-x snap-mandatory">
                    {templatePages.map((page, index) => (
                      <div key={index} className="flex-none w-full snap-center">
                        <Image
                          src={page}
                          alt={`${product.imageAlt} - Page ${index + 1}`}
                          width={600}
                          height={800}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Page Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPage();
                  }}
                  disabled={currentPage === totalPages - 1}
                  className="absolute right-4 top-1/2 z-30 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>

                {/* Page indicator dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {templatePages.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToPage(index);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentPage ? "bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>

                {/* Page counter */}
                <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded-full text-xs backdrop-blur-sm">
                  {currentPage + 1}/{totalPages}
                </div>
              </div>
            </div>
          </DialogPanel>

          {/* Desktop Sidebar */}
          <div
            className="relative z-30 rounded-xl bg-white p-6 text-gray-900 shadow-2xl ring-1 ring-gray-100 touch-auto min-h-fit"
            onClick={(e) => {
              console.log("📦 Sidebar container clicked!");
              e.stopPropagation();
            }}
            onTouchStart={() => {
              console.log("👆 Sidebar touch start detected!");
            }}
            onTouchEnd={() => {
              console.log("👆 Sidebar touch end detected!");
            }}
            style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
          >
            <button
              onClick={(e) => {
                console.log("🚀 Close button clicked!");
                console.log("📱 Event details:", { type: e.type, target: e.target });
                e.stopPropagation();
                e.preventDefault();
                console.log("🚀 About to call onClose()");
                onClose();
                console.log("✅ onClose() called successfully");
              }}
              onTouchStart={() => {
                console.log("👆 Close button touch start!");
              }}
              onTouchEnd={(e) => {
                console.log("👆 Close button touch end!");
                e.preventDefault();
                e.stopPropagation();
                console.log("🚀 Touch end - calling onClose()");
                onClose();
                console.log("✅ onClose() called from touch end");
              }}
              className="absolute right-3 top-3 z-40 rounded-md p-2 text-gray-500 hover:bg-gray-100 touch-auto min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold leading-snug">{product.name}</h2>
            <div className="mt-2 text-sm text-gray-600">
              By {product.publisher.name}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Document (A4 Portrait) • 21 × 29.7 cm • {totalPages} pages
            </div>

            <button
              onClick={(e) => {
                console.log("🚀 Use this template button clicked!");
                console.log("� Event details:", { type: e.type, target: e.target });
                console.log("�📦 Product data:", product);
                console.log("🔧 onCustomize function:", typeof onCustomize);
                e.stopPropagation();
                e.preventDefault();
                try {
                  console.log("🎯 About to call onCustomize...");
                  onCustomize(product);
                  console.log("✅ onCustomize called successfully");
                } catch (error) {
                  console.error("❌ Error calling onCustomize:", error);
                  alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              onTouchStart={() => {
                console.log("👆 Use template button touch start!");
              }}
              onTouchEnd={(e) => {
                console.log("👆 Use template button touch end!");
                e.preventDefault();
                e.stopPropagation();
                console.log("🚀 Touch end - calling onCustomize()");
                try {
                  console.log("🎯 About to call onCustomize from touch...");
                  onCustomize(product);
                  console.log("✅ onCustomize called successfully from touch");
                } catch (error) {
                  console.error("❌ Error calling onCustomize from touch:", error);
                  alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="relative z-30 mt-5 w-full inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 touch-auto min-h-[48px]"
              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
            >
              Use this template
            </button>
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <button
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 hover:bg-gray-200 touch-auto"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("❤️ Like button clicked!");
                  // Handle like action - could implement later
                }}
              >
                <HeartIcon className="h-4 w-4 text-rose-500" />
                {product.likes.toLocaleString()}
              </button>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              This template may contain paid elements
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .flipbook-shadow {
          filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
          transition: transform 0.3s ease, filter 0.3s ease;
        }

        .flipbook-shadow:hover {
          transform: scale(1.02);
          filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.4));
        }

        .flipbook-container-desktop {
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 600px;
        }

        .page-hard {
          width: 100%;
          height: 100%;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15),
            0 2px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          transition: box-shadow 0.3s ease;
          cursor: grab;
        }

        .page-hard:active {
          cursor: grabbing;
        }

        .page-content {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          position: relative;
        }

        /* Page corner hint animation */
        .page-hard::before {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 30px;
          height: 30px;
          background: linear-gradient(
            -45deg,
            transparent 0%,
            transparent 48%,
            rgba(0, 0, 0, 0.1) 49%,
            rgba(0, 0, 0, 0.1) 51%,
            transparent 52%,
            transparent 100%
          );
          z-index: 10;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .page-hard:hover::before {
          opacity: 1;
        }

        /* Hide scrollbar for mobile view */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </Dialog>
  );
}
