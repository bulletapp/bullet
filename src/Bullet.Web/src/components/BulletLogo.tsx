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
      data-testid="bullet-brand-logo"
    >
      <defs>
        {/* Projectile (Copper / Gold Ogive) */}
        <linearGradient id="bulletProjectileGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="25%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#fef08a" />
          <stop offset="75%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Cartridge Case (Polished Brass) */}
        <linearGradient id="bulletCaseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a16207" />
          <stop offset="25%" stopColor="#ca8a04" />
          <stop offset="50%" stopColor="#fef08a" />
          <stop offset="75%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>

        {/* Extractor Groove Shadow */}
        <linearGradient id="grooveShadow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#451a03" />
          <stop offset="50%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>

        {/* Panel Background Squircle */}
        <linearGradient id="bulletLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#080c14" />
        </linearGradient>
      </defs>

      {/* Rounded Squircle Container */}
      <rect width="128" height="128" rx="26" fill="url(#bulletLogoBg)" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />

      {/* Tactical Targeting Crosshair Elements */}
      <circle cx="64" cy="64" r="50" fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.6" />
      <circle cx="64" cy="64" r="32" fill="none" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.25" />

      {/* Crosshair Ticks */}
      <line x1="64" y1="6" x2="64" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="64" y1="114" x2="64" y2="122" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="6" y1="64" x2="14" y2="64" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="114" y1="64" x2="122" y2="64" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />

      {/* Supersonic Mach Shockwaves (Left and Right) */}
      <path d="M38 52 L28 64 L38 76" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
      <path d="M90 52 L100 64 L90 76" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />

      {/* 1. EXTRACTOR RIM (BASE) - y=106 to y=112 */}
      <rect x="47" y="106" width="34" height="6" rx="1.5" fill="url(#bulletCaseGrad)" stroke="#ca8a04" strokeWidth="0.8" />
      <line x1="56" y1="112" x2="72" y2="112" stroke="#451a03" strokeWidth="1.5" strokeLinecap="round" />

      {/* 2. EXTRACTOR GROOVE (REDUCED WAIST) - y=101 to y=106 */}
      <rect x="51" y="101" width="26" height="5" fill="url(#grooveShadow)" />

      {/* 3. CARTRIDGE MAIN BODY (BRASS CYLINDER) - y=64 to y=101 */}
      <path d="M47 64 L81 64 L81 101 L47 101 Z" fill="url(#bulletCaseGrad)" stroke="#ca8a04" strokeWidth="0.8" />

      {/* 4. CARTRIDGE SHOULDER (ANGLED TAPER) - y=54 to y=64 */}
      <path d="M56 54 L72 54 L81 64 L47 64 Z" fill="url(#bulletCaseGrad)" stroke="#ca8a04" strokeWidth="0.8" />

      {/* 5. CARTRIDGE NECK - y=44 to y=54 */}
      <rect x="56" y="44" width="16" height="10" fill="url(#bulletCaseGrad)" stroke="#ca8a04" strokeWidth="0.8" />
      <line x1="55" y1="44" x2="73" y2="44" stroke="#78350f" strokeWidth="1.2" />

      {/* 6. BULLET PROJECTILE (COPPER OGIVE & POINTED SPITZER TIP) - y=16 to y=44 */}
      <path d="M64 16 C61 24 57 34 56 44 L72 44 C71 34 67 24 64 16 Z" fill="url(#bulletProjectileGrad)" stroke="#d97706" strokeWidth="0.8" />
      <path d="M64 16 C63 19 62 23 60 26 L68 26 C66 23 65 19 64 16 Z" fill="#fef9c3" />
      <line x1="57" y1="36" x2="71" y2="36" stroke="#92400e" strokeWidth="1" strokeDasharray="2 1" />

      {/* Specular Highlight Streak */}
      <line x1="61" y1="20" x2="61" y2="42" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.75" strokeLinecap="round" />
      <line x1="60" y1="46" x2="60" y2="100" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
    </svg>
  );
};
