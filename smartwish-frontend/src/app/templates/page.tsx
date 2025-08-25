"use client";

import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import useSWR from "swr";
import AuthModal from "@/components/AuthModal";
import TemplatePreviewModal from "@/components/TemplatePreviewModal";
import TemplateCard from "@/components/TemplateCard";
import TemplateCardSkeleton from "@/components/TemplateCardSkeleton";
import FloatingSearch from "@/components/FloatingSearch";
import { AuthModalProvider, useAuthModal } from "@/contexts/AuthModalContext";


type ApiTemplate = {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  author_id: string;
  description: string;
  author_name?: { name: string };
  price: string | number;
  language: string;
  region: string;
  status: string;
  popularity: number;
  num_downloads: number;
  cover_image: string;
  current_version: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  image_1: string;
  image_2: string;
  image_3: string;
  image_4: string;
  category_name?: string;
  category_display_name?: string;
  author?: string;
};

type ApiResponse = {
  success: boolean;
  data: ApiTemplate[];
  count?: number;
  total?: number;
};

type Category = {
  id: string;
  name: string;
  description: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

type CategoriesResponse = {
  success: boolean;
  data: Category[];
  count: number;
};

export type TemplateCard = {
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Transform API data to TemplateCard format
function transformApiTemplate(apiTemplate: ApiTemplate): TemplateCard {
  // Handle price field which can be string or number
  const priceValue =
    typeof apiTemplate.price === "string"
      ? parseFloat(apiTemplate.price)
      : apiTemplate.price;
  const formattedPrice = priceValue > 0 ? `$${priceValue.toFixed(2)}` : "$0";

  return {
    id: apiTemplate.id,
    name: apiTemplate.title,
    price: formattedPrice,
    rating: Math.min(5, Math.max(1, Math.round(apiTemplate.popularity / 20))), // Convert popularity to 1-5 rating
    reviewCount: Math.floor(apiTemplate.num_downloads / 10), // Estimate reviews from downloads
    imageSrc: apiTemplate.image_1,
    imageAlt: `${apiTemplate.title} template`,
    publisher: {
      name: apiTemplate.author_name?.name || apiTemplate.author || "SmartWish Studio",
      avatar: "https://i.pravatar.cc/80?img=1",
    },
    downloads: apiTemplate.num_downloads,
    likes: Math.floor(apiTemplate.num_downloads / 10), // Estimate likes from downloads
    pages: [
      apiTemplate.image_1,
      apiTemplate.image_2,
      apiTemplate.image_3,
      apiTemplate.image_4,
    ].filter(Boolean),
  };
}

function TemplatesPageContent() {
  const { data: session, status } = useSession();
  const sp = useSearchParams();
  const q = sp?.get("q") ?? "";
  const region = sp?.get("region") ?? "";
  const language = sp?.get("language") ?? "";
  const author = sp?.get("author") ?? "";
  const category = sp?.get("category") ?? "";
  const pageFromQuery = sp?.get("page") ?? "1";
  const initialPage = Math.max(1, parseInt(pageFromQuery || "1", 10) || 1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<TemplateCard | null>(
    null
  );

  const [page, setPage] = useState<number>(initialPage);
  const [selectedCategory, setSelectedCategory] = useState<string>(category);
  const router = useRouter();
  const pathname = usePathname();
  const { authModalOpen, openAuthModal, closeAuthModal, setRedirectUrl } = useAuthModal();

  // Debug: Track authModalOpen state changes (only when it changes)
  useEffect(() => {
    console.log("🎭 PARENT AuthModal state changed to:", authModalOpen);
    if (authModalOpen) {
      console.log("✅ AuthModal should now be visible!");
    }
  }, [authModalOpen]);

  // Debug: Track auth state changes (only when status changes)
  useEffect(() => {
    console.log("🔒 Auth state changed:", {
      session: !!session,
      status,
      user: session?.user?.email,
    });
  }, [session, status]);

  // Fetch categories
  const { data: categoriesResponse } = useSWR<CategoriesResponse>(
    "/api/categories",
    fetcher
  );
  const categories = categoriesResponse?.data || [];

  // Build API URL with query parameters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (region && region !== "Any region") params.set("region", region);
    if (language && language !== "Any language")
      params.set("language", language);
    if (author && author !== "Any author") params.set("author", author);
    if (selectedCategory) params.set("category_id", selectedCategory);
    const queryString = params.toString();
    return `/api/templates${queryString ? `?${queryString}` : ""}`;
  }, [q, region, language, author, selectedCategory]);

  // Fetch data using SWR
  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR<ApiResponse>(apiUrl, fetcher);

  const products = useMemo(() => {
    if (!apiResponse?.data) return [];
    return apiResponse.data.map(transformApiTemplate);
  }, [apiResponse]);

  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return products.slice(start, start + pageSize);
  }, [products, safePage]);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  // Sync selectedCategory with URL parameter
  useEffect(() => {
    setSelectedCategory(category);
  }, [category]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, region, language, author, selectedCategory]);

  // Check for template to auto-open from landing page
  useEffect(() => {
    const openTemplateId = sessionStorage.getItem("openTemplateId");
    if (openTemplateId && products.length > 0) {
      // Find the template in the current products
      const template = products.find((p) => p.id === openTemplateId);
      if (template) {
        setPreviewProduct(template);
        setPreviewOpen(true);
        // Clear the stored ID
        sessionStorage.removeItem("openTemplateId");
      }
    }
  }, [products]);

  const goToPage = (next: number) => {
    const target = Math.min(Math.max(1, next), totalPages);
    setPage(target);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("page", String(target));
    router.push(`/templates?${params.toString()}`);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEditor = useCallback(
    async (product: TemplateCard) => {
      console.log("🚀 openEditor function called!");
      console.log("🎭 Product:", product);
      console.log("🔒 Session:", session);
      console.log("📊 Status:", status);

      // Always close preview modal first
      setPreviewOpen(false);

      // Check authentication
      if (!session || status !== "authenticated") {
        console.log("❌ User not authenticated, opening auth modal");
        console.log("🔍 Session:", session);
        console.log("🔍 Status:", status);
        // When using a template, redirect to the template editor after sign-in
        const editorUrl = `/my-cards/template-editor?templateId=${product.id}&templateName=${encodeURIComponent(product.name)}`;
        setRedirectUrl(editorUrl);
        openAuthModal();
        return;
      }

      console.log("✅ User is authenticated, redirecting to editor mode");

      try {
        console.log("🎨 Opening template in editor mode");
        console.log("🔍 Template product data:", product);
        console.log("🔍 Template ID:", product.id);

        // Store template data temporarily for editor access
        sessionStorage.setItem('templateForEditor', JSON.stringify({
          id: product.id,
          name: product.name,
          pages: product.pages || [product.imageSrc]
        }));

        // Redirect directly to editor mode without copying to saved_designs yet
        // The editor will handle copying to saved_designs only when user saves
        router.push(`/my-cards/template-editor?templateId=${product.id}&templateName=${encodeURIComponent(product.name)}`);

      } catch (error) {
        console.error("❌ Error opening template editor:", error);
        alert(`Failed to open template editor: ${error.message}`);
      }
    },
    [session, status, openAuthModal, setRedirectUrl, pathname, router]
  );

  // Handle successful authentication - close auth modal and redirect to redirect URL or default
  useEffect(() => {
    // Only run this effect when user becomes authenticated AND auth modal is open
    if (
      session &&
      status === "authenticated" &&
      authModalOpen
    ) {
      console.log(
        "🎉 User authenticated successfully, closing auth modal"
      );
      closeAuthModal();
      // Don't redirect here - let the sign-in page handle the redirect
    }
  }, [
    session,
    status,
    authModalOpen,
    closeAuthModal,
  ]);


  const handlePreviewTemplate = (template: TemplateCard) => {
    console.log("🎬 handlePreviewTemplate called with:", template.name);
    setPreviewProduct(template);

    // Small delay to prevent immediate outside click detection
    setTimeout(() => {
      setPreviewOpen(true);
      console.log("✅ Preview modal should now be open");
    }, 50);
  };

  const handleAuthRequired = useCallback(() => {
    console.log("🚨🚨🚨 HANDLE AUTH REQUIRED CALLED 🚨🚨🚨");
    setRedirectUrl(pathname + (typeof window !== "undefined" ? window.location.search : ""));
    openAuthModal();
  }, [openAuthModal, setRedirectUrl, pathname]);

  return (
    <main className="pb-24">
      <div className="px-4 pt-6 sm:px-6 lg:px-8" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* sticky show-on-scroll-up search */}
        <FloatingSearch
          initialQuery={q}
          categories={categories}
          selectedCategory={selectedCategory}
        />

        <section>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-3">
              {Array(9)
                .fill(0)
                .map((_, i) => (
                  <TemplateCardSkeleton key={`skeleton-${i}`} />
                ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center text-red-600">
              Failed to load templates. Please try again later.
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-gray-200 p-12 text-center text-gray-600">
              No templates found.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-3">
                {pagedProducts.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    onPreview={handlePreviewTemplate}
                    onAuthRequired={handleAuthRequired}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav
                  className="mt-10 flex justify-center"
                  aria-label="Pagination"
                >
                  <div className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-1 shadow-sm ring-1 ring-gray-300">
                    <button
                      onClick={() => goToPage(safePage - 1)}
                      disabled={safePage === 1}
                      title="Previous"
                      className="flex size-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <button
                          key={p}
                          onClick={() => goToPage(p)}
                          className={`flex size-9 items-center justify-center rounded-full text-sm ring-1 ring-transparent ${p === safePage
                              ? "bg-indigo-600 text-white ring-indigo-600"
                              : "text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => goToPage(safePage + 1)}
                      disabled={safePage === totalPages}
                      title="Next"
                      className="flex size-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {/* Template Preview Modal */}
      {previewProduct && (
        <TemplatePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          product={previewProduct}
          onCustomize={openEditor}
        />
      )}

      {/* Auth Modal - shared for both main page and preview modal */}
      <AuthModal open={authModalOpen} onClose={closeAuthModal} />
    </main>
  );
}

// Add global styles for flipbook
const FlipbookStyles = () => (
  <style jsx global>{`
    .flipbook-shadow {
      filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
    }

    .flipbook-container-desktop {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0;
    }

    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }

    .page-hard {
      width: 100%;
      height: 100%;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transform: translateZ(0);
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
    }
  `}</style>
);

export default function TemplatesPage() {
  return (
    <>
      <FlipbookStyles />
      <AuthModalProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <TemplatesPageContent />
        </Suspense>
      </AuthModalProvider>
    </>
  );
}
