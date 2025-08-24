"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  KeyboardEvent,
} from "react";
import Image from "next/image";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { DynamicRouter } from "@/utils/request_utils";

type Template = {
  id: string;
  title: string;
  image_1: string;
  image_2: string;
  image_3: string;
  image_4: string;
};

type ApiResponse = {
  success: boolean;
  data: Template[];
  count: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ImageSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 shadow-sm">
      <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
    </div>
  );
}

export default function MadeWithSmartWish() {
  const [latestTemplates, setLatestTemplates] = useState<Template[]>([]);
  const router = useRouter();

  // Fetch all templates (latest first)
  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR<ApiResponse>(DynamicRouter("api", "simple-templates", undefined, false), fetcher);

  const templates = useMemo(() => apiResponse?.data || [], [apiResponse]);

  // Get latest templates (already sorted by created_at DESC from API)
  useEffect(() => {
    if (templates.length > 0) {
      // Filter out any without a primary image and take the first 8 (latest)
      const withImage = templates.filter((t) => t.image_1);
      setLatestTemplates(withImage.slice(0, 8));
    }
  }, [templates]);

  const openTemplate = useCallback(
    (templateId: string) => {
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("openTemplateId", templateId);
        }
        router.push("/templates");
      } catch (e) {
        console.error("Failed to navigate to template", e);
      }
    },
    [router]
  );

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openTemplate(id);
      }
    },
    [openTemplate]
  );

  return (
    <div>
      <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
        Made with SmartWish
      </h2>
      <p className="mx-auto mt-1 max-w-2xl text-center text-sm text-gray-500">
        Take a look at the latest cards created by our users.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {isLoading ? (
          // Show 8 skeleton loaders
          Array(8)
            .fill(0)
            .map((_, idx) => <ImageSkeleton key={`skeleton-${idx}`} />)
        ) : error ? (
          // Error state - show message
          <div className="col-span-full text-center text-red-600 py-8">
            Failed to load card samples
          </div>
        ) : (
          // Show latest template thumbnails clickable
          latestTemplates.map((t: Template) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => openTemplate(t.id)}
              onKeyDown={(e) => handleKey(e, t.id)}
              className="group relative overflow-hidden rounded-xl ring-1 ring-gray-200/70 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
            >
              <Image
                alt={t.title || "Card sample"}
                src={t.image_1}
                width={640}
                height={989}
                className="aspect-[640/989] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity" />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all p-2 text-center text-xs font-medium text-white bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                {t.title}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
