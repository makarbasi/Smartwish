"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface KioskScreenSaverProps {
  isVisible: boolean;
  onExit: () => void;
}

export default function KioskScreenSaver({
  isVisible,
  onExit,
}: KioskScreenSaverProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Welcome to SmartWish Kiosk",
      description: "Create personalized greeting cards in minutes!",
      icon: "🎨",
    },
    {
      title: "Choose from 1000+ Templates",
      description: "Browse our extensive collection of beautiful card designs",
      icon: "📇",
    },
    {
      title: "Customize Your Card",
      description: "Add photos, text, stickers, and make it uniquely yours",
      icon: "✨",
    },
    {
      title: "Print or Send Instantly",
      description: "Print your card on the spot or send it as an e-card",
      icon: "🖨️",
    },
    {
      title: "Perfect for Any Occasion",
      description: "Birthdays, holidays, thank you cards, and more!",
      icon: "🎉",
    },
  ];

  // Auto-rotate slides every 5 seconds
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible, slides.length]);

  const handleInteraction = () => {
    onExit();
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex flex-col items-center justify-center cursor-pointer"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      tabIndex={0}
    >
      {/* Animated background patterns */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-300 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 text-center px-8 max-w-4xl">
        {/* Logo/Branding */}
        <div className="mb-12">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 drop-shadow-lg animate-fadeIn">
            SmartWish
          </h1>
          <p className="text-2xl md:text-3xl text-white/80 font-light">
            Greeting Card Kiosk
          </p>
        </div>

        {/* Animated Slide Content */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-12 mb-8 min-h-[300px] flex flex-col items-center justify-center animate-scaleIn">
          <div className="text-8xl mb-6 animate-bounce">
            {slides[currentSlide].icon}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {slides[currentSlide].title}
          </h2>
          <p className="text-2xl md:text-3xl text-white/90">
            {slides[currentSlide].description}
          </p>
        </div>

        {/* Slide indicators */}
        <div className="flex justify-center gap-3 mb-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-3 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "w-12 bg-white"
                  : "w-3 bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Touch/Click to Start */}
        <div className="animate-pulse">
          <p className="text-3xl text-white font-semibold mb-4">
            👆 Touch anywhere to start
          </p>
          <p className="text-xl text-white/70">
            Create your perfect card in just a few steps
          </p>
        </div>
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-100px) translateX(50px);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 1s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out;
        }

        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

