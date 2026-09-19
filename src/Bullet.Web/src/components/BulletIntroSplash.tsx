import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Zap, Check } from 'lucide-react';
import { playSonicBoom } from '../utils/audioFx';

interface BulletIntroSplashProps {
  onFinish: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export const BulletIntroSplash: React.FC<BulletIntroSplashProps> = ({ onFinish }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stage, setStage] = useState<'aiming' | 'firing' | 'impact' | 'done'>('aiming');
  const [skipOnLaunch, setSkipOnLaunch] = useState<boolean>(() => {
    return localStorage.getItem('bullet_skip_intro') === 'true';
  });
  const [fadingOut, setFadingOut] = useState(false);
  const animFrameRef = useRef<number>(0);

  const handleDismiss = () => {
    if (fadingOut) return;
    setFadingOut(true);
    setTimeout(() => {
      onFinish();
    }, 250);
  };

  const handleToggleSkip = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSkipOnLaunch(checked);
    localStorage.setItem('bullet_skip_intro', checked ? 'true' : 'false');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const centerX = width / 2;
    const centerY = height / 2;

    const particles: Particle[] = [];
    const shockwaves: Shockwave[] = [];

    let bulletX = -80;
    const bulletY = centerY;
    const bulletSpeed = width / 18; // Crosses screen rapidly in ~250ms

    const startTime = performance.now();
    let hasPlayedBoom = false;
    let impactCreated = false;

    const render = (now: number) => {
      const elapsed = now - startTime;

      // Stage management
      if (elapsed < 350) {
        setStage('aiming');
      } else if (elapsed < 750) {
        setStage('firing');
      } else {
        setStage('impact');
      }

      // Auto dismiss after 2.8s
      if (elapsed > 2800 && !fadingOut) {
        handleDismiss();
        return;
      }

      // Clear frame with deep cyber dark background
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, width, height);

      // Draw faint cyber grid
      ctx.strokeStyle = 'rgba(30, 48, 80, 0.25)';
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // PHASE 1: Reticle & HUD Targeting (Aiming)
      if (elapsed < 900) {
        const reticleAlpha = Math.min(1, elapsed / 200);
        ctx.save();
        ctx.strokeStyle = `rgba(245, 158, 11, ${reticleAlpha * 0.7})`;
        ctx.lineWidth = 1.5;

        // Outer reticle circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
        ctx.stroke();

        // Inner reticle circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 35, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(centerX - 90, centerY);
        ctx.lineTo(centerX - 45, centerY);
        ctx.moveTo(centerX + 45, centerY);
        ctx.lineTo(centerX + 90, centerY);
        ctx.moveTo(centerX, centerY - 90);
        ctx.lineTo(centerX, centerY - 45);
        ctx.moveTo(centerX, centerY + 45);
        ctx.lineTo(centerX, centerY + 90);
        ctx.stroke();

        ctx.restore();
      }

      // PHASE 2: Supersonic Bullet Streak (Firing)
      if (elapsed >= 300 && bulletX < centerX + 20) {
        bulletX += bulletSpeed;

        // Spawn ember particle trail
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: bulletX - Math.random() * 25,
            y: bulletY + (Math.random() - 0.5) * 12,
            vx: -Math.random() * 10 - 4,
            vy: (Math.random() - 0.5) * 4,
            size: Math.random() * 3.5 + 1.5,
            color: Math.random() > 0.4 ? '#f59e0b' : '#38bdf8',
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 25 + 15,
          });
        }

        // Draw supersonic Mach cone / shockwave behind bullet
        ctx.save();
        const machGradient = ctx.createLinearGradient(bulletX - 180, bulletY, bulletX, bulletY);
        machGradient.addColorStop(0, 'rgba(245, 158, 11, 0)');
        machGradient.addColorStop(0.7, 'rgba(245, 158, 11, 0.4)');
        machGradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)');

        ctx.fillStyle = machGradient;
        ctx.beginPath();
        ctx.moveTo(bulletX, bulletY);
        ctx.lineTo(bulletX - 140, bulletY - 24);
        ctx.lineTo(bulletX - 160, bulletY);
        ctx.lineTo(bulletX - 140, bulletY + 24);
        ctx.closePath();
        ctx.fill();

        // Draw Bullet Projectile
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(bulletX, bulletY, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // PHASE 3: Center Impact Explosion & Shockwave
      if (bulletX >= centerX && !impactCreated) {
        impactCreated = true;

        if (!hasPlayedBoom) {
          hasPlayedBoom = true;
          playSonicBoom();
        }

        // Primary shockwaves
        shockwaves.push({
          x: centerX,
          y: centerY,
          radius: 10,
          maxRadius: Math.max(width, height) * 0.65,
          alpha: 1,
          color: 'rgba(245, 158, 11, ',
        });
        shockwaves.push({
          x: centerX,
          y: centerY,
          radius: 5,
          maxRadius: Math.max(width, height) * 0.5,
          alpha: 0.9,
          color: 'rgba(56, 189, 248, ',
        });

        // 60 radiant sparks
        for (let i = 0; i < 70; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 16 + 4;
          particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 4 + 1.5,
            color: i % 3 === 0 ? '#38bdf8' : '#f59e0b',
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 40 + 20,
          });
        }
      }

      // Render & update shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += 24;
        sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);

        ctx.save();
        ctx.strokeStyle = `${sw.color}${sw.alpha})`;
        ctx.lineWidth = Math.max(1, 4 * sw.alpha);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (sw.alpha <= 0.01) {
          shockwaves.splice(i, 1);
        }
      }

      // Render & update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.alpha <= 0.02) {
          particles.splice(i, 1);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      data-testid="bullet-intro-splash"
      onClick={handleDismiss}
      className={`fixed inset-0 z-[9999] bg-[#050811] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Canvas for 60FPS Particles & Shockwave */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Foreground HUD / Branding Overlay */}
      <div className="relative z-10 flex flex-col items-center text-center pointer-events-none px-6">
        {stage === 'aiming' && (
          <div className="flex flex-col items-center space-y-2 animate-in fade-in zoom-in duration-200 font-mono">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <Crosshair className="w-4 h-4 animate-spin text-amber-400" />
              <span>LOCKING TARGET COORDINATES...</span>
            </div>
            <div className="text-[10px] text-slate-500 tracking-wider uppercase">
              CHAMBERING 7.62mm API PAYLOAD • STATUS: READY
            </div>
          </div>
        )}

        {stage === 'firing' && (
          <div className="flex flex-col items-center space-y-1 animate-in fade-in duration-100 font-mono">
            <div className="text-amber-400 text-sm font-bold tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 animate-bounce" />
              <span>SUPERSONIC DISCHARGE • MACH 3.2</span>
            </div>
          </div>
        )}

        {stage === 'impact' && (
          <div className="flex flex-col items-center animate-in zoom-in-95 fade-in duration-300">
            {/* Illuminated Bullet Logo Badge */}
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-amber-500/50 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/40">
                <svg viewBox="0 0 32 32" className="w-10 h-10 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                  <path
                    d="M16 2 C18.5 6 22 12 22 20 C22 25 19.3 29 16 29 C12.7 29 10 25 10 20 C10 12 13.5 6 16 2 Z"
                    fill="#f59e0b"
                  />
                  <path
                    d="M16 4 C17.8 7.5 20.5 12.5 20.5 19 C20.5 21 20 23 19 24.5 C17.5 21 16 15 16 4 Z"
                    fill="#fef08a"
                    opacity="0.85"
                  />
                </svg>
              </div>
            </div>

            {/* Wordmark */}
            <h1 className="text-4xl font-extrabold tracking-wider font-mono text-slate-100 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
              BULLET
            </h1>
            <p className="text-xs font-mono text-amber-400 font-semibold tracking-widest uppercase mt-1">
              Load. Aim. API.
            </p>

            {/* Sub-telemetry Pill */}
            <div className="mt-4 flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400 shadow-xl">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ENGINES ONLINE
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">ZERO LATENCY CORE</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-bold">READY</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dismiss / Skip Toolbar */}
      <div
        className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-between px-8 text-xs font-mono text-slate-500 select-none pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-2 cursor-pointer hover:text-slate-400 transition">
          <input
            type="checkbox"
            checked={skipOnLaunch}
            onChange={handleToggleSkip}
            className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
          />
          <span>Don't show on startup</span>
        </label>

        <button
          data-testid="dismiss-intro-btn"
          onClick={handleDismiss}
          className="px-3 py-1 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition flex items-center gap-1.5 shadow-lg"
        >
          <span>Press Any Key or Click to Skip</span>
          <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-amber-400">
            Esc
          </kbd>
        </button>
      </div>
    </div>
  );
};
