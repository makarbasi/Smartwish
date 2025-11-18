"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

interface KioskScreenSaverProps {
  isVisible: boolean;
  onExit: () => void;
}

type HeroCard = {
  id?: string;
  title: string;
  tagline: string;
  image: string;
  accent: string;
};

const FALLBACK_HERO_CARDS: HeroCard[] = [
  {
    id: "fallback-birthday",
    title: "Birthday Bliss",
    tagline: "Personal photos + confetti overlays",
    image: "/resources/hero/wishcards-1.png",
    accent: "#fbbf24",
  },
  {
    id: "fallback-holiday",
    title: "Holiday Magic",
    tagline: "Foil-stamped greetings in seconds",
    image: "/resources/hero/wishcards-2.png",
    accent: "#38bdf8",
  },
  {
    id: "fallback-thankyou",
    title: "Thank You Love",
    tagline: "Handwritten notes printed perfectly",
    image: "/resources/hero/wishcards-3.png",
    accent: "#f472b6",
  },
];

const ACCENT_COLORS = [
  "#fbbf24",
  "#38bdf8",
  "#f472b6",
  "#34d399",
  "#a78bfa",
  "#f97316",
];

export default function KioskScreenSaver({
  isVisible,
  onExit,
}: KioskScreenSaverProps) {
  const [heroCards, setHeroCards] = useState<HeroCard[]>(FALLBACK_HERO_CARDS);

  const floatingCallouts = useMemo(
    () => [
      {
        title: "Create in 1 Minutes",
        body: "Browse, personalize, and print instantly.",
      },
      {
        title: "Premium Cardstock",
        body: "Museum-quality paper + rich color inks.",
      },
      {
        title: "Over 1,000 Designs",
        body: "Birthday • Holiday • Thank You • Weddings",
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch("/api/templates?limit=6", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load templates (${response.status})`);
        }

        const payload = await response.json();
        const templates = Array.isArray(payload?.data) ? payload.data : [];

        const mappedCards: HeroCard[] = templates
          .filter((template) => template?.image_1 || template?.cover_image)
          .map((template, index) => ({
            id: template?.id ?? `${template?.title}-${index}`,
            title: template?.title ?? `Template ${index + 1}`,
            tagline:
              template?.category_display_name ||
              template?.category_name ||
              template?.language ||
              "SmartWish Studio",
            image: template?.image_1 || template?.cover_image,
            accent: ACCENT_COLORS[index % ACCENT_COLORS.length],
          }));

        if (!cancelled && mappedCards.length > 0) {
          setHeroCards(mappedCards);
        }
      } catch (error) {
        console.error("Failed to load kiosk templates:", error);
      }
    };

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const uniqueCards = useMemo(() => {
    const seen = new Set<string>();
    return heroCards.filter((card) => {
      const key = card.id ?? `${card.title}-${card.image}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [heroCards]);

  const marqueeCards = useMemo(() => uniqueCards, [uniqueCards]);

  const handleInteraction = () => {
    onExit();
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] cursor-pointer select-none"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      tabIndex={0}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A031A] via-[#120B3B] to-[#1F2A69]" />

      {/* Blurred moving cards */}
      <div className="absolute inset-0 overflow-hidden opacity-70">
        {marqueeCards.map((card, index) => {
          const isEven = index % 2 === 0;
          const size = isEven ? 420 : 360;
          const topOffset = isEven
            ? 10 + (index % heroCards.length) * 12
            : 20 + (index % heroCards.length) * 9;
          return (
            <div
              key={`${card.title}-${index}`}
              className="absolute blur-sm lg:blur-[1px]"
              style={{
                width: size,
                height: size * 1.35,
                top: `${topOffset}%`,
                left: isEven ? "-25%" : "65%",
                animation: `${isEven ? "driftRight" : "driftLeft"} ${18 + index * 1.5
                  }s linear infinite`,
              }}
            >
              <div
                className="absolute inset-0 rounded-[32px]"
                style={{
                  background: `radial-gradient(circle at top, ${card.accent}30, transparent 70%)`,
                  filter: "blur(40px)",
                }}
              />
              <div className="relative h-full w-full rounded-[32px] overflow-hidden border border-white/15 shadow-2xl shadow-black/40 bg-white/5 backdrop-blur-3xl">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(max-width: 1024px) 60vw, 35vw"
                  className="object-cover opacity-80"
                  priority={index < 3}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Accent gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -bottom-10 right-0 w-[40vw] h-[40vw] bg-[#7C3AED]/40 blur-[120px]" />
        <div className="absolute -top-32 left-16 w-[25vw] h-[25vw] bg-[#F97316]/30 blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 w-[30vw] h-[30vw] bg-[#06B6D4]/20 blur-[160px]" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center text-white">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm uppercase tracking-[0.4em] text-white/60">
            Greeting Card Experience
          </p>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            SmartWish
          </h1>
          <p className="text-xl md:text-2xl text-white/80 leading-relaxed">
            Design, personalize, and print premium greeting cards while you
            wait. Just tap to wake the screen and start creating.
          </p>
        </div>

        {/* Floating callouts */}
        <div className="mt-12 grid grid-cols-1 gap-6 px-4 md:grid-cols-3 max-w-6xl w-full">
          {floatingCallouts.map((callout, index) => (
            <div
              key={callout.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
              style={{
                animation: `pulseGlow 6s ease-in-out ${index * 1.5}s infinite`,
              }}
            >
              <p className="text-sm uppercase tracking-[0.3em] text-white/40 mb-3">
                {`0${index + 1}`}
              </p>
              <h3 className="text-2xl font-semibold text-white mb-2">
                {callout.title}
              </h3>
              <p className="text-base text-white/80">{callout.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-white/80 text-lg flex flex-col items-center gap-3">
          <span className="px-6 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-md">
            Touch Anywhere to Begin
          </span>
          <p>Fully guided experience · Instant high-quality prints</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes driftRight {
          0% {
            transform: translate3d(-10%, 0, 0) rotate(-4deg) scale(1);
          }
          50% {
            transform: translate3d(40%, -10%, 0) rotate(2deg) scale(1.05);
          }
          100% {
            transform: translate3d(90%, 5%, 0) rotate(-2deg) scale(1);
          }
        }

        @keyframes driftLeft {
          0% {
            transform: translate3d(10%, 0, 0) rotate(5deg) scale(1);
          }
          50% {
            transform: translate3d(-40%, -10%, 0) rotate(-3deg) scale(1.08);
          }
          100% {
            transform: translate3d(-90%, 5%, 0) rotate(2deg) scale(1);
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            transform: translateY(0);
            box-shadow: 0 10px 40px rgba(124, 58, 237, 0.2);
          }
          50% {
            transform: translateY(-6px);
            box-shadow: 0 20px 70px rgba(99, 102, 241, 0.35);
          }
        }
      `}</style>
    </div>
  );
}

