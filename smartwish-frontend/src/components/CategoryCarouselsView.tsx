"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import CategoryCarousel, { CarouselCard } from "./CategoryCarousel";
import TemplatePreviewModal from "./TemplatePreviewModal";
import AuthModal from "./AuthModal";
import { useSession } from "next-auth/react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { FeaturedCategoryConfig } from "@/contexts/KioskContext";

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function transformApiTemplate(apiTemplate: ApiTemplate): TemplateCard {
  const priceValue =
    typeof apiTemplate.price === "string"
      ? parseFloat(apiTemplate.price)
      : apiTemplate.price;
  const formattedPrice = priceValue > 0 ? `$${priceValue.toFixed(2)}` : "$0";

  return {
    id: apiTemplate.id,
    name: apiTemplate.title,
    price: formattedPrice,
    rating: Math.min(5, Math.max(1, Math.round(apiTemplate.popularity / 20))),
    reviewCount: Math.floor(apiTemplate.num_downloads / 10),
    imageSrc: apiTemplate.image_1,
    imageAlt: `${apiTemplate.title} template`,
    publisher: {
      name: apiTemplate.author_name?.name || apiTemplate.author || "SmartWish Studio",
      avatar: "https://i.pravatar.cc/80?img=1",
    },
    downloads: apiTemplate.num_downloads,
    category_id: apiTemplate.category_id,
    category_name: apiTemplate.category_name,
    category_display_name: apiTemplate.category_display_name,
    likes: apiTemplate.popularity,
    pages: [
      apiTemplate.image_1,
      apiTemplate.image_2,
      apiTemplate.image_3,
      apiTemplate.image_4,
    ].filter(Boolean),
    metadata: {
      slug: apiTemplate.slug,
      description: apiTemplate.description,
      message: apiTemplate.message,
      card_message: apiTemplate.card_message,
      text: apiTemplate.text,
      cover_image: apiTemplate.cover_image,
      coverImage: apiTemplate.cover_image,
      image_1: apiTemplate.image_1,
      image_2: apiTemplate.image_2,
      image_3: apiTemplate.image_3,
      image_4: apiTemplate.image_4,
      tags: apiTemplate.tags,
      language: apiTemplate.language,
      region: apiTemplate.region,
      priceValue,
      title: apiTemplate.title,
    },
  };
}

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
        params.set("limit", "20"); // Fetch more cards for carousel
        params.set("sort", "popularity"); // Sort by popularity
        
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

    // Fetch cards for all categories
    sortedCategories.forEach((category) => {
      if (!categoryCards[category.categoryId]) {
        fetchCategoryCards(category);
      }
    });
  }, [sortedCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle card click - show preview modal
  const handleCardClick = useCallback((card: CarouselCard) => {
    // Find full template data from the API response
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
      // Always close preview modal first
      setPreviewOpen(false);

      // Check authentication
      if (!session || status !== "authenticated") {
        const editorUrl = `/my-cards/template-editor?templateId=${product.id}&templateName=${encodeURIComponent(product.name)}`;
        setRedirectUrl(editorUrl);
        openAuthModal();
        return;
      }

      // Generate a temporary ID for optimistic navigation
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Store template data in sessionStorage for immediate editor access
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
      
      // Navigate immediately to editor
      router.push(`/my-cards/${tempId}?mode=template`);

      // Start background save
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
    <div className="space-y-6">
      {/* Category Carousels */}
      {sortedCategories.map((category) => (
        <CategoryCarousel
          key={category.categoryId}
          categoryId={category.categoryId}
          categoryName={category.categoryName}
          cards={categoryCards[category.categoryId] || []}
          onCardClick={handleCardClick}
          onCategoryClick={handleCategoryClick}
          isLoading={loadingCategories.has(category.categoryId)}
        />
      ))}

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
