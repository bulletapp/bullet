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
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="bulletLogoBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="bulletLogoTip" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="bulletLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#131b2e" />
          <stop offset="100%" stopColor="#080c14" />
        </linearGradient>
      </defs>

      {/* Rounded Squircle Container */}
      <rect width="128" height="128" rx="28" fill="url(#bulletLogoBg)" stroke="#f59e0b" strokeWidth="3" strokeOpacity="0.4" />

      {/* Targeting Reticle Rings */}
      <circle cx="64" cy="64" r="46" fill="none" stroke="#23304b" strokeWidth="2" strokeDasharray="6 6" />
      <circle cx="64" cy="64" r="34" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" />

      {/* Crosshair Notches */}
      <line x1="64" y1="12" x2="64" y2="24" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="64" y1="104" x2="64" y2="116" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="64" x2="24" y2="64" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="104" y1="64" x2="116" y2="64" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

      {/* Supersonic shockwaves */}
      <path d="M40 82 L64 56 L88 82" fill="none" stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 92 L64 72 L82 92" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" />

      {/* Bullet Projectile Body */}
      <path
        d="M64 26 C57 38 52 50 52 64 L52 88 C52 90 54 92 56 92 L72 92 C74 92 76 90 76 88 L76 64 C76 50 71 38 64 26 Z"
        fill="url(#bulletLogoBody)"
        stroke="#fef3c7"
        strokeWidth="1"
      />
      {/* Bullet Tip Highlight */}
      <path d="M64 26 C60 33 57 40 56 46 L72 46 C71 40 68 33 64 26 Z" fill="url(#bulletLogoTip)" />

      {/* Kinetic Spine */}
      <line x1="64" y1="30" x2="64" y2="90" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" />

      {/* Primer Grooves */}
      <line x1="53" y1="76" x2="75" y2="76" stroke="#b45309" strokeWidth="1.5" />
      <line x1="53" y1="84" x2="75" y2="84" stroke="#b45309" strokeWidth="1.5" />
    </svg>
  );
};
