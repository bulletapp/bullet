import React from 'react';
import { 
  Lock, Unlock, AlertTriangle, Terminal, Layers, Play, 
  Download, Upload, Command, Plus, RefreshCw, CheckCircle2,
  Sun, Moon, Volume2, VolumeX, Crosshair
} from 'lucide-react';
import { Range, Loadout } from '../types/bullet';
import { BulletLogo } from './BulletLogo';
import { isSoundEnabled, setSoundEnabled } from '../utils/audioFx';

interface HeaderProps {
  ranges: Range[];
  selectedRange: Range | null;
  onSelectRange: (range: Range) => void;
  onOpenNewRange: () => void;
  loadouts: Loadout[];
  selectedLoadout: Loadout | null;
  onSelectLoadout: (loadout: Loadout | null) => void;
  onOpenNewShot: () => void;
  onOpenFiringRun: () => void;
  onOpenArmoryTransfer: () => void;
  onOpenCommandPalette: () => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
  consoleLogCount: number;
  onReplayIntro?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  ranges,
  selectedRange,
  onSelectRange,
  onOpenNewRange,
  loadouts,
  selectedLoadout,
  onSelectLoadout,
  onOpenNewShot,
  onOpenFiringRun,
  onOpenArmoryTransfer,
  onOpenCommandPalette,
  consoleOpen,
  onToggleConsole,
  consoleLogCount,
  onReplayIntro,
}) => {
  const [soundActive, setSoundActive] = React.useState<boolean>(isSoundEnabled);

  const toggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
  };

  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('bullet_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('bullet_theme', theme);

    // Notify native host if running in WebView2 desktop window
    try {
      const webview = (window as unknown as { chrome?: { webview?: { postMessage: (msg: string) => void } } })?.chrome?.webview;
      if (webview) {
        webview.postMessage(JSON.stringify({ type: 'THEME_CHANGED', theme }));
      }
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [globalSsl, setGlobalSsl] = React.useState<boolean>(() => {
    return localStorage.getItem('bullet_verify_ssl') !== 'false';
  });

  const toggleGlobalSsl = () => {
    const nextVal = !globalSsl;
    setGlobalSsl(nextVal);
    localStorage.setItem('bullet_verify_ssl', String(nextVal));
    window.dispatchEvent(new CustomEvent('bullet_global_ssl_changed', { detail: nextVal }));
  };

  return (
    <header className="h-12 border-b border-bullet-border bg-bullet-panel flex items-center justify-between px-3 select-none flex-shrink-0 z-20">
      {/* Brand & Wordmark */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BulletLogo size={28} className="drop-shadow-sm flex-shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold tracking-wider text-sm text-slate-100">BULLET</span>
              <span className="text-[10px] uppercase font-mono px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">v1.0</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono tracking-wide">Load. Aim. API.</span>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 bg-bullet-surface border border-bullet-border rounded px-2 py-1 text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-mono text-[11px]">Range:</span>
          <select
            data-testid="header-range-select"
            className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-medium"
            value={selectedRange?.id || ''}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                onOpenNewRange();
              } else {
                const found = ranges.find((r) => r.id === e.target.value);
                if (found) onSelectRange(found);
              }
            }}
          >
            {ranges.map((r) => (
              <option key={r.id} value={r.id} className="bg-slate-900 text-slate-200">
                {r.name}
              </option>
            ))}
            <option value="__new__" className="bg-slate-900 text-amber-400 font-medium">
              + New Range...
            </option>
          </select>
        </div>

        {/* Loadout Selector with Production Indicator */}
        <div className={`flex items-center gap-1.5 border rounded px-2 py-1 text-xs transition-colors ${
          selectedLoadout?.isProduction
            ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-950'
            : 'bg-bullet-surface border-bullet-border text-slate-200'
        }`}>
          {selectedLoadout?.isProduction ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
          <span className="font-mono text-[11px] text-slate-400">Loadout:</span>
          <select
            data-testid="header-loadout-select"
            className="bg-transparent text-xs font-medium outline-none cursor-pointer"
            value={selectedLoadout?.id || 'none'}
            onChange={(e) => {
              if (e.target.value === 'none') {
                onSelectLoadout(null);
              } else {
                const found = loadouts.find((l) => l.id === e.target.value);
                if (found) onSelectLoadout(found);
              }
            }}
          >
            <option value="none" className="bg-slate-900 text-slate-400">
              No Loadout (Shared Only)
            </option>
            {loadouts.map((l) => (
              <option key={l.id} value={l.id} className="bg-slate-900 text-slate-200">
                {l.name} {l.isProduction ? '⚡ [PROD]' : ''}
              </option>
            ))}
          </select>

          {selectedLoadout?.isProduction && (
            <span className="text-[9px] font-mono px-1 rounded bg-amber-500 text-slate-950 font-bold uppercase">
              PROD
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* New Shot */}
        <button
          data-testid="header-new-shot-btn"
          onClick={onOpenNewShot}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          title="Create New Shot"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>New Shot</span>
        </button>

        {/* Firing Run Runner */}
        <button
          data-testid="header-firing-run-btn"
          onClick={onOpenFiringRun}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 transition"
          title="Run Arsenal Firing Run"
        >
          <Play className="w-3 h-3 fill-amber-400" />
          <span className="font-mono font-medium">Firing Run</span>
        </button>

        {/* Import & Export */}
        <button
          data-testid="header-import-btn"
          data-legacy-testid="header-transfer-btn"
          onClick={onOpenArmoryTransfer}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          title="Import (Postman Collection / Environment, OpenAPI, cURL)"
        >
          <Upload className="w-3.5 h-3.5 text-amber-400" />
          <span>Import</span>
        </button>

        {/* Command Palette */}
        <button
          data-testid="header-cmd-palette-btn"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition"
          title="Command Palette (Ctrl+Shift+P)"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px] bg-slate-900 px-1 rounded border border-slate-700">⌘K</span>
        </button>

        {/* Trajectory Console Toggle */}
        <button
          data-testid="header-console-toggle-btn"
          onClick={onToggleConsole}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition ${
            consoleOpen
              ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title="Trajectory Console (Ctrl+J)"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-[11px]">Trajectory</span>
          {consoleLogCount > 0 && (
            <span className="px-1 text-[9px] font-mono rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              {consoleLogCount}
            </span>
          )}
        </button>

        {/* Global SSL Verification Toggle (Postman Parity) */}
        <button
          data-testid="global-ssl-toggle-btn"
          onClick={toggleGlobalSsl}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition cursor-pointer ${
            globalSsl
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              : 'bg-amber-950/50 border-amber-500/60 text-amber-300 hover:bg-amber-950/70 shadow-sm shadow-amber-950/50'
          }`}
          title={globalSsl ? 'SSL Verification: ON (Click to disable and bypass SSL errors globally)' : 'SSL Verification: OFF (Allowing self-signed & untrusted certs)'}
        >
          {globalSsl ? (
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Unlock className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="font-mono text-[10px] font-semibold">{globalSsl ? 'SSL: ON' : 'SSL: OFF'}</span>
        </button>

        {/* Replay Intro Splash Button */}
        {onReplayIntro && (
          <button
            data-testid="header-replay-intro-btn"
            onClick={onReplayIntro}
            className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
            title="Replay Supersonic Launch Sequence"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Sound FX Mute Toggle */}
        <button
          data-testid="header-sound-toggle-btn"
          onClick={toggleSound}
          className={`flex items-center justify-center w-7 h-7 rounded border transition ${
            soundActive
              ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-slate-700'
              : 'bg-slate-800/60 hover:bg-slate-700 text-slate-500 border-slate-800'
          }`}
          title={soundActive ? 'Sound Effects: ON (Click to Mute)' : 'Sound Effects: MUTED (Click to Enable)'}
        >
          {soundActive ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          data-testid="theme-toggle-btn"
          onClick={toggleTheme}
          className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </button>

        {/* Status Indicator */}
        <div className="flex items-center gap-1 pl-2 border-l border-slate-800 text-[10px] text-slate-400 font-mono" title="Bullet Core Connected">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" style={{ animationDuration: '3s' }} />
          <span>LIVE</span>
        </div>
      </div>
    </header>
  );
};
