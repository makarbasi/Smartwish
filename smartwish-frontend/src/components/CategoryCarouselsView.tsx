"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import CategoryCarousel, { CarouselCard } from "./CategoryCarousel";
import TemplatePreviewModal from "./TemplatePreviewModal";
import AuthModal from "./AuthModal";
import { useSession } from "next-auth/react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { FeaturedCategoryConfig } from "@/contexts/KioskContext";
import { SparklesIcon, Squares2X2Icon } from "@heroicons/react/24/outline";

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
  message?: string;
  card_message?: string;
  text?: string;
  tags?: string[];
};

type ApiResponse = {
  success: boolean;
  data: ApiTemplate[];
  count?: number;
  total?: number;
};

// Transform for preview modal compatibility
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
  category_id?: string;
  category_name?: string;
  category_display_name?: string;
  isLiked?: boolean;
  metadata?: {
    slug?: string;
    description?: string;
    message?: string;
    card_message?: string;
    text?: string;
    cover_image?: string;
    coverImage?: string;
    image_1?: string;
    image_2?: string;
    image_3?: string;
    image_4?: string;
    tags?: string[];
    language?: string;
    region?: string;
    priceValue?: number;
    title?: string;
  };
};

interface CategoryCarouselsViewProps {
  featuredCategories: FeaturedCategoryConfig[];
  onSwitchToGridView: (categoryId?: string, categoryName?: string) => void;
}

export default function CategoryCarouselsView({
  featuredCategories,
  onSwitchToGridView,
}: CategoryCarouselsViewProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { authModalOpen, openAuthModal, closeAuthModal, setRedirectUrl } = useAuthModal();
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<TemplateCard | null>(null);
  const [categoryCards, setCategoryCards] = useState<Record<string, CarouselCard[]>>({});
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set());
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);

  // Animate header on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsHeaderVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Sort categories by displayOrder
  const sortedCategories = useMemo(() => 
    [...featuredCategories].sort((a, b) => a.displayOrder - b.displayOrder),
    [featuredCategories]
  );

  // Fetch cards for each category
  useEffect(() => {
    const fetchCategoryCards = async (category: FeaturedCategoryConfig) => {
      setLoadingCategories(prev => new Set(prev).add(category.categoryId));
      
      try {
        const params = new URLSearchParams();
        params.set("category_id", category.categoryId);
        params.set("limit", "20");
        params.set("sort", "popularity");
        
        const response = await fetch(`/api/templates?${params.toString()}`);
        const data: ApiResponse = await response.json();
        
        if (data.success && data.data) {
          const cards: CarouselCard[] = data.data.map((template) => ({
            id: template.id,
            name: template.title,
            imageSrc: template.image_1,
            popularity: template.popularity,
            pages: [
              template.image_1,
              template.image_2,
              template.image_3,
              template.image_4,
            ].filter(Boolean),
            category_id: template.category_id,
            category_name: template.category_name || template.category_display_name,
            metadata: {
              slug: template.slug,
              description: template.description,
              message: template.message,
              card_message: template.card_message,
              text: template.text,
              cover_image: template.cover_image,
              image_1: template.image_1,
              image_2: template.image_2,
              image_3: template.image_3,
              image_4: template.image_4,
              tags: template.tags,
              language: template.language,
              region: template.region,
              price: template.price,
              title: template.title,
              author: template.author,
            },
          }));
          
          setCategoryCards(prev => ({
            ...prev,
            [category.categoryId]: cards,
          }));
        }
      } catch (error) {
        console.error(`Error fetching cards for category ${category.categoryName}:`, error);
      } finally {
        setLoadingCategories(prev => {
          const next = new Set(prev);
          next.delete(category.categoryId);
          return next;
        });
      }
    };

    sortedCategories.forEach((category) => {
      if (!categoryCards[category.categoryId]) {
        fetchCategoryCards(category);
      }
    });
  }, [sortedCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate total cards
  const totalCards = useMemo(() => {
    return Object.values(categoryCards).reduce((sum, cards) => sum + cards.length, 0);
  }, [categoryCards]);

  // Handle card click - show preview modal
  const handleCardClick = useCallback((card: CarouselCard) => {
    const fullCard: TemplateCard = {
      id: card.id,
      name: card.name,
      price: "$0",
      rating: Math.min(5, Math.max(1, Math.round((card.popularity || 0) / 20))),
      reviewCount: 0,
      imageSrc: card.imageSrc,
      imageAlt: `${card.name} template`,
      publisher: {
        name: "SmartWish Studio",
        avatar: "https://i.pravatar.cc/80?img=1",
      },
      downloads: 0,
      likes: card.popularity || 0,
      pages: card.pages,
      category_id: card.category_id,
      category_name: card.category_name,
      metadata: card.metadata as TemplateCard["metadata"],
    };
    
    setPreviewProduct(fullCard);
    setTimeout(() => setPreviewOpen(true), 50);
  }, []);

  // Handle category name click - switch to grid view with filter
  const handleCategoryClick = useCallback((categoryId: string, categoryName: string) => {
    onSwitchToGridView(categoryId, categoryName);
  }, [onSwitchToGridView]);

  // Handle customize/use template from preview modal
  const openEditor = useCallback(
    async (product: TemplateCard) => {
      setPreviewOpen(false);

      if (!session || status !== "authenticated") {
        const editorUrl = `/my-cards/template-editor?templateId=${product.id}&templateName=${encodeURIComponent(product.name)}`;
        setRedirectUrl(editorUrl);
        openAuthModal();
        return;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const templateData = {
        id: tempId,
        templateId: product.id,
        name: product.name,
        pages: product.pages || [],
        categoryId: product.category_id || '1',
        categoryName: product.category_display_name || product.category_name || 'General',
        metadata: product.metadata,
        isTemporary: true,
      };
      
      sessionStorage.setItem(`pendingTemplate_${tempId}`, JSON.stringify(templateData));
      router.push(`/my-cards/${tempId}?mode=template`);

      const priceValue = product.metadata?.priceValue 
        || (typeof product.price === 'string' ? parseFloat(product.price.replace('$', '')) : product.price)
        || 1.99;
      
      const copyPayload = {
        title: product.name,
        categoryId: product.category_id || '1',
        categoryName: product.category_display_name || product.category_name || 'General',
        price: priceValue,
        templateMeta: product.metadata
          ? {
              ...product.metadata,
              id: product.id,
              title: product.metadata.title || product.name,
              price: priceValue,
            }
          : undefined,
        fallbackImages: product.pages,
      };

      fetch(`/api/templates/${product.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(copyPayload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to copy template (${response.status})`);
          }

          const savedDesignResult = await response.json();
          if (savedDesignResult.success && savedDesignResult.data) {
            const savedDesignId = savedDesignResult.data.id;
            sessionStorage.setItem(`tempIdMap_${tempId}`, savedDesignId);
            window.dispatchEvent(new CustomEvent('templateSaved', {
              detail: { tempId, savedDesignId, savedDesign: savedDesignResult.data }
            }));
          }
        })
        .catch((error) => {
          console.error("Background copy failed:", error);
          window.dispatchEvent(new CustomEvent('templateSaveFailed', {
            detail: { tempId, error: error.message }
          }));
        });
    },
    [session, status, openAuthModal, setRedirectUrl, router]
  );

  // Handle auth modal success
  useEffect(() => {
    if (session && status === "authenticated" && authModalOpen) {
      closeAuthModal();
    }
  }, [session, status, authModalOpen, closeAuthModal]);

  if (sortedCategories.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-30" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-100 rounded-full blur-3xl opacity-30" />
      </div>

      {/* Header Section */}
      <div className={`mb-10 transition-all duration-700 ease-out ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                <SparklesIcon className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 blur-lg opacity-40" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                Browse by Category
              </h1>
              <p className="text-gray-500 mt-1">
                Discover {totalCards}+ beautiful greeting card designs
              </p>
            </div>
          </div>

          {/* View All Button */}
          <button
            onClick={() => onSwitchToGridView()}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-300"
          >
            <Squares2X2Icon className="w-5 h-5 text-gray-500 group-hover:text-indigo-600 transition-colors" />
            <span className="font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
              View All Cards
            </span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {sortedCategories.map((category, index) => (
            <button
              key={category.categoryId}
              onClick={() => onSwitchToGridView(category.categoryId, category.categoryName)}
              className="group px-4 py-2 rounded-full bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
                {category.categoryName}
              </span>
              <span className="ml-2 text-xs text-gray-400 group-hover:text-indigo-400 transition-colors">
                {categoryCards[category.categoryId]?.length || '...'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <div className="bg-white px-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <div className="w-2 h-2 rounded-full bg-pink-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Carousels */}
      <div className="space-y-4">
        {sortedCategories.map((category, index) => (
          <CategoryCarousel
            key={category.categoryId}
            categoryId={category.categoryId}
            categoryName={category.categoryName}
            cards={categoryCards[category.categoryId] || []}
            onCardClick={handleCardClick}
            onCategoryClick={handleCategoryClick}
            isLoading={loadingCategories.has(category.categoryId)}
            index={index}
          />
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <div className="inline-flex flex-col items-center gap-4 px-8 py-6 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 border border-indigo-100 shadow-lg">
          <p className="text-gray-600">
            Can&apos;t find what you&apos;re looking for?
          </p>
          <button
            onClick={() => onSwitchToGridView()}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-300"
          >
            <Squares2X2Icon className="w-5 h-5" />
            <span>Browse All {totalCards}+ Cards</span>
          </button>
        </div>
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

      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
