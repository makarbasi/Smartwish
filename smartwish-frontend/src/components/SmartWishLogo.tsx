import React from 'react';

interface SmartWishLogoProps {
  className?: string;
  variant?: 'icon' | 'full';
}

export const SmartWishLogo: React.FC<SmartWishLogoProps> = ({ 
  className = "h-8 w-auto", 
  variant = 'icon' 
}) => {
  const iconSvg = (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Card Background */}
      <rect x="20" y="30" width="120" height="140" rx="12" fill="#2D9F91" stroke="#2D9F91" strokeWidth="3"/>
      <rect x="30" y="40" width="100" height="120" rx="8" fill="white"/>
      
      {/* Star */}
      <path d="M90 60L95 75L110 75L98 85L103 100L90 90L77 100L82 85L70 75L85 75Z" fill="#2D9F91"/>
      
      {/* Motion lines */}
      <path d="M50 90C55 88 60 86 65 85" stroke="#2D9F91" strokeWidth="3" strokeLinecap="round"/>
      <path d="M50 100C58 98 66 96 74 95" stroke="#2D9F91" strokeWidth="3" strokeLinecap="round"/>
      <path d="M50 110C60 108 70 106 80 105" stroke="#2D9F91" strokeWidth="3" strokeLinecap="round"/>
      
      {/* Small sparkles */}
      <circle cx="55" cy="70" r="2" fill="#2D9F91"/>
      <path d="M115 95L118 98L115 101L112 98Z" fill="#2D9F91"/>
      <circle cx="120" cy="110" r="1.5" fill="#2D9F91"/>
    </svg>
  );

  const fullLogo = (
    <div className="flex items-center gap-2">
      {iconSvg}
      <span className="text-2xl font-bold text-[#2D9F91]">SmartWish</span>
    </div>
  );

  return variant === 'icon' ? iconSvg : fullLogo;
};

export default SmartWishLogo;