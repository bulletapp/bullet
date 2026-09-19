import React from 'react';

interface BulletLogoProps {
  className?: string;
  size?: number;
}

export const BulletLogo: React.FC<BulletLogoProps> = ({ className = '', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-testid="bullet-brand-logo"
    >
      <defs>
        {/* Bullet Gold Gradient */}
        <linearGradient id="bulletGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="20%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Squircle Background Gradient */}
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c121e" />
          <stop offset="100%" stopColor="#080c14" />
        </linearGradient>
      </defs>

      {/* Squircle Container */}
      <rect x="3" y="3" width="250" height="250" rx="56" fill="url(#bgGrad)" stroke="#23304b" strokeWidth="5" />

      {/* Circular Reticle */}
      <circle cx="128" cy="128" r="88" fill="none" stroke="#b45309" strokeWidth="5" />

      {/* Crosshair Ticks */}
      <line x1="128" y1="0" x2="128" y2="28" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
      <line x1="128" y1="228" x2="128" y2="256" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
      <line x1="0" y1="128" x2="28" y2="128" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
      <line x1="228" y1="128" x2="256" y2="128" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />

      {/* Bullet Projectile */}
      <path d="M 128 64 C 114 64 92 88 92 128 L 92 202 L 164 202 L 164 128 C 164 88 142 64 128 64 Z" fill="url(#bulletGoldGrad)" />

      {/* Specular Center Reflection Line */}
      <line x1="128" y1="78" x2="128" y2="182" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
};
