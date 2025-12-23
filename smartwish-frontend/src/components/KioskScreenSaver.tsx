"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type KioskTheme = "default" | "christmas";

function resolveKioskTheme(): KioskTheme {
  // Allow easy on-device override for demos:
  // localStorage.setItem("kioskTheme", "christmas" | "default")
  try {
    if (typeof window !== "undefined") {
      const override = localStorage.getItem("kioskTheme");
      if (override === "christmas" || override === "default") return override;
    }
  } catch {
    // ignore
  }

  const now = new Date();
  const isDecember = now.getMonth() === 11; // 0-based
  return isDecember ? "christmas" : "default";
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function mulberry32(seed: number) {
  // tiny deterministic PRNG for consistent "hand-drawn" jitter per mount
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScribbleHeartPath(seed: number) {
  // Parametric heart with jitter -> looks more like a human stroke than a perfect bezier.
  // viewBox is 0..240, so we scale/center into that space.
  const rand = mulberry32(seed);
  const pts: Array<{ x: number; y: number }> = [];
  const steps = 96;

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const sx = 16 * Math.pow(Math.sin(t), 3);
    const sy =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    // scale into viewBox
    const x0 = 120 + sx * 5.6;
    const y0 = 128 - sy * 5.2;

    // jitter: subtle (less noisy), more at the top lobes, less near the point
    const topBias = clamp01((y0 - 70) / 90);
    const j = 0.55 + topBias * 0.75; // 0.55..1.30
    const jx = (rand() - 0.5) * 2.1 * j;
    const jy = (rand() - 0.5) * 1.9 * j;

    pts.push({ x: x0 + jx, y: y0 + jy });
  }

  // Convert to a polyline path. With round caps/joins it reads as a single hand stroke.
  const d = pts
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return d;
}

function HandwritingDemo({
  accent,
  phase,
}: {
  accent: string;
  phase: number; // 0..1 looped
}) {
  // phase drives a few synchronized effects: pen movement, stroke reveal, typewriter.
  const heartDraw = clamp01((phase - 0.08) / 0.38); // 0.08..0.46
  const messageType = clamp01((phase - 0.42) / 0.48); // 0.42..0.90
  const showSignature = phase > 0.62;

  const message = "Merry christmas John!";
  const typedCount = Math.round(message.length * messageType);
  const typed = message.slice(0, typedCount);

  // Hand-drawn-ish heart stroke (jittered).
  const HEART_INK = "#EF4444";
  const wobble = Math.sin(phase * Math.PI * 2) * 1.0;
  const heartPath = useMemo(
    () => buildScribbleHeartPath(Math.floor(Math.random() * 1_000_000)),
    []
  );

  // Pen position: wobbly orbit (more "human").
  const penX = 120 + Math.cos((heartDraw * Math.PI) * 1.4) * (50 + wobble * 6);
  const penY = 116 + Math.sin((heartDraw * Math.PI) * 1.2) * (42 + wobble * 5);

  return (
    <div
      className="relative h-full w-full rounded-[28px] overflow-hidden border border-white/25 shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
      style={{
        // Make the demo unmistakably visible (high-contrast "paper" card),
        // even on bright kiosk screens / glare.
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.90))",
      }}
    >
      {/* card paper */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 10%, rgba(255,255,255,0.9), transparent 40%), radial-gradient(circle at 88% 0%, rgba(255,255,255,0.7), transparent 45%), linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))",
          }}
        />
        <div
          className="absolute -right-16 -top-14 h-56 w-56 blur-[70px] opacity-70"
          style={{
            background: `radial-gradient(circle at center, ${accent}55, transparent 65%)`,
          }}
        />
      </div>

      {/* handwriting-only area */}
      <div className="absolute left-7 right-7 bottom-7 top-7 rounded-2xl border border-black/10 bg-white overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 25% 20%, rgba(0,0,0,0.04), transparent 55%), radial-gradient(circle at 75% 70%, rgba(0,0,0,0.03), transparent 60%)",
          }}
        />

        {/* faint writing lines */}
        <div className="absolute inset-0 opacity-[0.22]">
          <div className="absolute left-0 right-0 top-[56%] h-px bg-black/10" />
          <div className="absolute left-0 right-0 top-[68%] h-px bg-black/10" />
          <div className="absolute left-0 right-0 top-[80%] h-px bg-black/10" />
        </div>

        <svg
          className="absolute inset-0"
          viewBox="0 0 240 240"
          aria-hidden
          style={{
            transform: `rotate(${-3 + wobble * 1.2}deg) translate(${wobble * 1.2}px, ${-2 + wobble * 0.7}px)`,
            transformOrigin: "120px 140px",
          }}
        >
          <path
            d={heartPath}
            fill="none"
            stroke="rgba(17,24,39,0.16)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={heartPath}
            fill="none"
            stroke={HEART_INK}
            strokeWidth={12 + wobble * 0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - heartDraw}
            style={{
              filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
              opacity: heartDraw > 0 ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          />

          {/* pen tip */}
          <g
            style={{
              opacity: heartDraw > 0.08 && heartDraw < 0.98 ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          >
            <circle
              cx={penX}
              cy={penY}
              r="7.5"
              fill="rgba(17,24,39,0.92)"
              style={{ filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.45))" }}
            />
            <circle cx={penX} cy={penY} r="3" fill={HEART_INK} />
          </g>
        </svg>

        {/* message */}
        <div className="absolute left-6 right-6 bottom-6">
          <div className="text-[#111827] text-2xl font-semibold tracking-tight">
            {typed}
            <span className="kiosk-caret" aria-hidden>
              ▍
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-black/70">
            <div className="text-sm font-medium">Sign your name, write a personal note</div>
          </div>
        </div>

        {/* signature flourish */}
        <div
          className="absolute right-6 top-5 text-black/65 text-sm italic"
          style={{
            opacity: showSignature ? 1 : 0,
            transform: showSignature ? "translateY(0)" : "translateY(-6px)",
            transition: "opacity 300ms ease-out, transform 300ms ease-out",
          }}
        >
          — Love, Alex
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.12))]" />

    </div>
  );
}

export default function KioskScreenSaver({
  isVisible,
  onExit,
}: KioskScreenSaverProps) {
  const [heroCards, setHeroCards] = useState<HeroCard[]>(FALLBACK_HERO_CARDS);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0); // 0: showcase, 1: personalization demo
  const [themeStage, setThemeStage] = useState(0);
  const [kioskTheme, setKioskTheme] = useState<KioskTheme>("default");
  const [demoPhase, setDemoPhase] = useState(0);

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

  const isChristmas = kioskTheme === "christmas";

  const rotatingMessages = useMemo(() => {
    return isChristmas
      ? [
          {
            eyebrow: "Christmas",
            headline: "Print a beautiful card in minutes.",
            sub: "Choose a design, add a message (or handwriting), and print instantly.",
          },
          {
            eyebrow: "Make it personal",
            headline: "Handwriting makes it feel real.",
            sub: "Draw a heart, sign your name, or write a note right on the card.",
          },
          {
            eyebrow: "Fast & vivid",
            headline: "Bright designs that pop.",
            sub: "Premium paper + vivid color + instant printing — tap to start.",
          },
        ]
      : [
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
        ];
  }, [isChristmas]);

  const sparkles = useMemo(() => {
    // Lightweight twinkle layer (pure CSS) to make the screen feel alive.
    // Keep count low to avoid perf issues on kiosk hardware.
    const count = 26;
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

  const snow = useMemo(() => {
    const count = 18;
    return Array.from({ length: count }).map((_, i) => {
      const r1 = Math.random();
      const r2 = Math.random();
      const r3 = Math.random();
      const r4 = Math.random();
      return {
        id: i,
        left: `${Math.round(r1 * 100)}%`,
        top: `${Math.round(r2 * 30)}%`,
        size: Math.round(6 + r3 * 14), // 6-20px
        drift: Math.round(12 + r4 * 28), // 12-40px
        delay: `${(i % 9) * 0.7}s`,
        duration: `${10 + (i % 9) * 1.4}s`,
        opacity: 0.25 + (i % 5) * 0.12,
      };
    });
  }, []);

  const ornaments = useMemo(() => {
    const count = 10;
    const colors = ["#EF4444", "#22C55E", "#F59E0B", "#60A5FA", "#A78BFA"];
    return Array.from({ length: count }).map((_, i) => {
      const r1 = Math.random();
      const r2 = Math.random();
      const r3 = Math.random();
      const r4 = Math.random();
      return {
        id: i,
        left: `${Math.round(r1 * 100)}%`,
        top: `${Math.round(10 + r2 * 70)}%`,
        size: Math.round(14 + r3 * 30), // 14-44px
        color: colors[i % colors.length],
        delay: `${(i % 7) * 0.8}s`,
        duration: `${7 + (i % 6) * 1.2}s`,
        blur: `${Math.round(r4 * 2)}px`,
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

    // Determine theme only when the screen saver becomes visible.
    setKioskTheme(resolveKioskTheme());
    setFeaturedIndex(0);
    setMessageIndex(0);
    setSceneIndex(0);
    setThemeStage(0);
    setDemoPhase(0);

    const t1 = window.setInterval(() => {
      setFeaturedIndex((prev) => prev + 1);
    }, 9500);

    const t2 = window.setInterval(() => {
      setMessageIndex((prev) => prev + 1);
    }, 6500);

    const t3 = window.setInterval(() => {
      // Alternate between "showcase" and "personalization" scenes.
      setSceneIndex((prev) => (prev + 1) % 2);
    }, 28000);

    const t4 = window.setInterval(() => {
      // Sub-theme palette cycling keeps the screen feeling alive and more colorful.
      setThemeStage((prev) => prev + 1);
    }, 16000);

    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
      window.clearInterval(t3);
      window.clearInterval(t4);
    };
  }, [isVisible]);

  // Keep handwriting animation smooth while the personalization scene is visible.
  useEffect(() => {
    if (!isVisible) return;
    if (sceneIndex % 2 === 0) return;

    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      setDemoPhase((elapsedSeconds % 8) / 8);
    }, 90);

    return () => window.clearInterval(interval);
  }, [isVisible, sceneIndex]);

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
  const stage = themeStage % 3;

  const DEFAULT_STAGE_PALETTES: Array<[string, string, string]> = [
    ["#38bdf8", "#a78bfa", "#f97316"],
    ["#34d399", "#f472b6", "#fbbf24"],
    ["#a78bfa", "#38bdf8", "#34d399"],
  ];

  const accentA = isChristmas
    ? ["#EF4444", "#22C55E", "#60A5FA"][stage]
    : DEFAULT_STAGE_PALETTES[stage][0];
  const accentB = isChristmas
    ? ["#F59E0B", "#A78BFA", "#F472B6"][stage]
    : DEFAULT_STAGE_PALETTES[stage][1];
  const accentC = isChristmas
    ? ["#34D399", "#F97316", "#38BDF8"][stage]
    : DEFAULT_STAGE_PALETTES[stage][2];

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
      <div
        className="absolute inset-0"
        style={{
          background: isChristmas
            ? "radial-gradient(circle at 20% 20%, rgba(239,68,68,0.25), transparent 45%), radial-gradient(circle at 80% 10%, rgba(34,197,94,0.22), transparent 45%), radial-gradient(circle at 60% 70%, rgba(96,165,250,0.18), transparent 50%), linear-gradient(135deg, #070312, #120B3B 40%, #0B1B4D)"
            : "linear-gradient(135deg, #0A031A, #120B3B 55%, #1F2A69)",
        }}
      />

      {/* Vivid animated glow wash */}
      <div className="absolute inset-0 pointer-events-none kiosk-huewash" />

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

      {/* Christmas snow + ornaments */}
      {isChristmas ? (
        <>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {snow.map((f) => (
              <span
                key={f.id}
                className="kiosk-snow"
                style={{
                  left: f.left,
                  top: f.top,
                  width: `${f.size}px`,
                  height: `${f.size}px`,
                  opacity: f.opacity,
                  animationDelay: f.delay,
                  animationDuration: f.duration,
                  ["--drift" as any]: `${f.drift}px`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none">
            {ornaments.map((o) => (
              <span
                key={o.id}
                className="kiosk-ornament"
                style={{
                  left: o.left,
                  top: o.top,
                  width: `${o.size}px`,
                  height: `${o.size}px`,
                  background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), transparent 35%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.18), transparent 48%), ${o.color}`,
                  filter: `blur(${o.blur})`,
                  animationDelay: o.delay,
                  animationDuration: o.duration,
                }}
              />
            ))}
          </div>
        </>
      ) : null}

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
        <div
          className="absolute -bottom-10 right-0 w-[44vw] h-[44vw] blur-[120px]"
          style={{ background: `${accentB}55` }}
        />
        <div
          className="absolute -top-32 left-16 w-[30vw] h-[30vw] blur-[120px]"
          style={{ background: `${accentA}45` }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-[34vw] h-[34vw] blur-[160px]"
          style={{ background: `${accentC}35` }}
        />
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

        {/* Featured spotlight card / personalization demo */}
        <div className="mt-10 w-full flex items-center justify-center px-4">
          <div className="relative w-[min(380px,82vw)] aspect-[3/4]">
            <div
              className="absolute -inset-4 rounded-[36px] opacity-80"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${accentA}60, transparent 70%)`,
                filter: "blur(28px)",
              }}
            />

            {sceneIndex % 2 === 0 ? (
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
                      style={{ backgroundColor: accentA }}
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
            ) : (
              <div className="relative h-full w-full rounded-[28px] kiosk-featured">
                <HandwritingDemo
                  accent={accentA}
                  phase={demoPhase}
                />
              </div>
            )}
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
            1) Choose a card · 2) Personalize (photo + handwriting) · 3) Print instantly
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

        .kiosk-huewash {
          opacity: 0.7;
          background: radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.10), transparent 40%),
            radial-gradient(circle at 80% 10%, rgba(255, 255, 255, 0.08), transparent 45%),
            radial-gradient(circle at 65% 80%, rgba(255, 255, 255, 0.06), transparent 55%);
          mix-blend-mode: screen;
          animation: hueShift 8.5s ease-in-out infinite;
        }

        @keyframes hueShift {
          0% {
            filter: hue-rotate(0deg) saturate(1.15);
            transform: scale(1);
          }
          50% {
            filter: hue-rotate(45deg) saturate(1.45);
            transform: scale(1.04);
          }
          100% {
            filter: hue-rotate(0deg) saturate(1.15);
            transform: scale(1);
          }
        }

        .kiosk-snow {
          position: absolute;
          border-radius: 9999px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.25));
          box-shadow: 0 0 18px rgba(255, 255, 255, 0.18);
          animation-name: snowFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes snowFall {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(var(--drift), 110vh, 0);
          }
        }

        .kiosk-ornament {
          position: absolute;
          border-radius: 9999px;
          opacity: 0.6;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
          animation-name: ornamentFloat;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        @keyframes ornamentFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translate3d(0, -14px, 0) scale(1.05);
            opacity: 0.78;
          }
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

        .kiosk-caret {
          display: inline-block;
          margin-left: 2px;
          opacity: 0.8;
          animation: caretBlink 1s step-end infinite;
        }

        @keyframes caretBlink {
          0%,
          100% {
            opacity: 0;
          }
          50% {
            opacity: 0.85;
          }
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

