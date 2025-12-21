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
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const floatingCallouts = useMemo(
    () => [
      {
        title: "Create in 60 Seconds",
        body: "Pick a design, add a message, print on premium cardstock.",
      },
      {
        title: "Instant Printing",
        body: "Walk away with a beautiful card — no waiting days for shipping.",
      },
      {
        title: "Popular Designs",
        body: "Birthday • Holiday • Thank You • Love • Congrats",
      },
    ],
    []
  );

  const rotatingMessages = useMemo(
    () => [
      {
        eyebrow: "Welcome",
        headline: "Make someone smile — right now.",
        sub: "Tap to browse popular cards, personalize in seconds, and print instantly.",
      },
      {
        eyebrow: "Try it",
        headline: "Add a photo. Add your message.",
        sub: "It’s fast, fun, and looks amazing on premium paper.",
      },
      {
        eyebrow: "Surprise",
        headline: "A card they’ll actually keep.",
        sub: "Choose a design, personalize, and print — all on this kiosk.",
      },
    ],
    []
  );

  const sparkles = useMemo(() => {
    // Lightweight twinkle layer (pure CSS) to make the screen feel alive.
    // Keep count low to avoid perf issues on kiosk hardware.
    const count = 22;
    return Array.from({ length: count }).map((_, i) => {
      const r1 = Math.random();
      const r2 = Math.random();
      const r3 = Math.random();
      return {
        id: i,
        left: `${Math.round(r1 * 100)}%`,
        top: `${Math.round(r2 * 100)}%`,
        size: Math.round(2 + r3 * 4), // 2-6px
        delay: `${(i % 8) * 0.6}s`,
        duration: `${6 + (i % 7)}s`,
      };
    });
  }, []);

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

  // Rotate the featured spotlight card + message to add an “attraction / surprise” element.
  useEffect(() => {
    if (!isVisible) return;

    setFeaturedIndex(0);
    setMessageIndex(0);

    const t1 = window.setInterval(() => {
      setFeaturedIndex((prev) => prev + 1);
    }, 4500);

    const t2 = window.setInterval(() => {
      setMessageIndex((prev) => prev + 1);
    }, 6500);

    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, [isVisible]);

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
  const featuredCard = useMemo(() => {
    if (uniqueCards.length === 0) return FALLBACK_HERO_CARDS[0];
    return uniqueCards[featuredIndex % uniqueCards.length];
  }, [uniqueCards, featuredIndex]);

  const activeMessage = rotatingMessages[messageIndex % rotatingMessages.length];

  const handleInteraction = () => {
    onExit();
  };

  if (!isVisible) return null;

  return (
    <div
      // Must sit above everything (Pintura modal + virtual keyboard use very high z-index values)
      className="fixed inset-0 z-[2147483647] cursor-pointer select-none"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") handleInteraction();
      }}
      tabIndex={0}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A031A] via-[#120B3B] to-[#1F2A69]" />

      {/* Sparkles / twinkle layer */}
      <div className="absolute inset-0 pointer-events-none">
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="kiosk-sparkle"
            style={{
              left: s.left,
              top: s.top,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: s.delay,
              animationDuration: s.duration,
            }}
          />
        ))}
      </div>

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
            {activeMessage.eyebrow}
          </p>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            {activeMessage.headline}
          </h1>
          <p className="text-xl md:text-2xl text-white/80 leading-relaxed">
            {activeMessage.sub}
          </p>
        </div>

        {/* Featured spotlight card */}
        <div className="mt-10 w-full flex items-center justify-center px-4">
          <div className="relative w-[min(380px,82vw)] aspect-[3/4]">
            <div
              className="absolute -inset-4 rounded-[36px] opacity-80"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${featuredCard.accent}55, transparent 70%)`,
                filter: "blur(28px)",
              }}
            />
            <div className="relative h-full w-full rounded-[28px] overflow-hidden border border-white/20 bg-white/5 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.55)] kiosk-featured">
              <Image
                src={featuredCard.image}
                alt={featuredCard.title}
                fill
                sizes="(max-width: 1024px) 80vw, 420px"
                className="object-cover"
                priority
              />
              {/* subtle shine sweep */}
              <div className="absolute inset-0 kiosk-shine" />

              <div className="absolute bottom-0 left-0 right-0 p-5 text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: featuredCard.accent }}
                  />
                  <span className="text-sm tracking-wide text-white/90">
                    Featured now
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold leading-tight">
                  {featuredCard.title}
                </h2>
                <p className="mt-1 text-white/75">{featuredCard.tagline}</p>
              </div>
            </div>
          </div>
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
          <div className="relative">
            <span className="px-7 py-3 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xl font-semibold kiosk-cta">
              Tap Anywhere to Start
            </span>
            <span className="absolute inset-0 rounded-full kiosk-cta-ring" aria-hidden />
          </div>
          <p className="text-white/70">
            1) Choose a card · 2) Personalize · 3) Print instantly
          </p>
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

        .kiosk-sparkle {
          position: absolute;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.35);
          opacity: 0.1;
          animation-name: twinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        @keyframes twinkle {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(0.7);
            opacity: 0.08;
          }
          50% {
            transform: translate3d(0, -10px, 0) scale(1);
            opacity: 0.45;
          }
        }

        .kiosk-featured {
          animation: featuredFloat 6s ease-in-out infinite;
          transform-origin: center;
        }

        @keyframes featuredFloat {
          0%,
          100% {
            transform: translateY(0) rotate(-0.35deg);
          }
          50% {
            transform: translateY(-10px) rotate(0.35deg);
          }
        }

        .kiosk-shine {
          background: linear-gradient(
            110deg,
            transparent 0%,
            rgba(255, 255, 255, 0.06) 35%,
            rgba(255, 255, 255, 0.22) 50%,
            rgba(255, 255, 255, 0.06) 65%,
            transparent 100%
          );
          transform: translateX(-140%);
          animation: shineSweep 4.8s ease-in-out infinite;
          mix-blend-mode: screen;
        }

        @keyframes shineSweep {
          0% {
            transform: translateX(-140%);
            opacity: 0.0;
          }
          15% {
            opacity: 0.9;
          }
          50% {
            transform: translateX(140%);
            opacity: 0.35;
          }
          100% {
            transform: translateX(140%);
            opacity: 0.0;
          }
        }

        .kiosk-cta {
          animation: ctaPulse 2.4s ease-in-out infinite;
        }

        .kiosk-cta-ring {
          border: 2px solid rgba(255, 255, 255, 0.18);
          transform: scale(1);
          opacity: 0.9;
          animation: ringPulse 2.4s ease-in-out infinite;
        }

        @keyframes ctaPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }

        @keyframes ringPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.65;
          }
          50% {
            transform: scale(1.12);
            opacity: 0.25;
          }
        }
      `}</style>
    </div>
  );
}

