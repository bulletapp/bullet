import React, { useState, useEffect } from 'react';
import { Crosshair, Play, Square, Save, Code, Copy, Info } from 'lucide-react';
import { Shot, Loadout } from '../types/bullet';

interface UrlBarProps {
  shot: Shot;
  onChange: (updated: Shot) => void;
  onFire: () => void;
  onCancel: () => void;
  isFiring: boolean;
  onSave: () => void;
  onOpenCodeShot: () => void;
  activeLoadout: Loadout | null;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const UrlBar: React.FC<UrlBarProps> = ({
  shot,
  onChange,
  onFire,
  onCancel,
  isFiring,
  onSave,
  onOpenCodeShot,
  activeLoadout,
}) => {
  const [resolvedPreview, setResolvedPreview] = useState<string>('');
  const [showTooltip, setShowTooltip] = useState(false);

  // Compute resolved preview from Loadout rounds
  useEffect(() => {
    if (!shot.url) {
      setResolvedPreview('');
      return;
    }

    let url = shot.url;
    if (activeLoadout) {
      for (const round of activeLoadout.rounds) {
        url = url.replaceAll(`{{${round.key}}}`, round.value);
      }
    }
    setResolvedPreview(url);
  }, [shot.url, activeLoadout]);

  const hasTokens = /\{\{([^}]+)\}\}/.test(shot.url);

  return (
    <div className="flex items-center gap-2 p-2 bg-bullet-panel border-b border-bullet-border flex-shrink-0">
      {/* Method Dropdown */}
      <div className="relative">
        <select
          data-testid="method-select"
          value={shot.method}
          onChange={(e) => onChange({ ...shot, method: e.target.value })}
          className="h-9 px-3 bg-bullet-surface border border-bullet-border rounded text-xs font-mono font-bold text-amber-400 outline-none cursor-pointer hover:border-amber-500/50"
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m} className="bg-slate-900 text-slate-200">
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* URL Input Bar */}
      <div className="relative flex-1 flex items-center">
        <input
          type="text"
          data-testid="url-input"
          value={shot.url}
          onChange={(e) => onChange({ ...shot, url: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onFire();
            }
          }}
          placeholder="Enter request URL or {{round}} token..."
          className="w-full h-9 bg-bullet-surface border border-bullet-border rounded px-3 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 transition shadow-inner"
        />

        {/* Live Token Preview Pill / Tooltip Trigger */}
        {hasTokens && (
          <div
            className="absolute right-2.5 flex items-center gap-1 cursor-pointer select-none"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
              <Info className="w-2.5 h-2.5" />
              <span>Resolved Preview</span>
            </span>

            {showTooltip && (
              <div className="absolute right-0 top-7 z-50 p-2 bg-slate-900 border border-cyan-500/50 rounded shadow-xl max-w-md break-all font-mono text-[11px] text-cyan-200">
                <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1">
                  Active Loadout Resolution:
                </div>
                <div>{resolvedPreview || shot.url}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FIRE Button */}
      {isFiring ? (
        <button
          data-testid="abort-btn"
          onClick={onCancel}
          className="h-9 px-4 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-md transition"
        >
          <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
          <span>ABORT</span>
        </button>
      ) : (
        <button
          data-testid="fire-btn"
          onClick={onFire}
          className="h-9 px-5 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 transition"
          title="Fire Shot (Ctrl+Enter)"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>FIRE</span>
          <span className="text-[10px] font-mono opacity-60 ml-0.5 font-normal">↵</span>
        </button>
      )}

      {/* Save Button */}
      <button
        data-testid="save-shot-btn"
        onClick={onSave}
        className="h-9 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs flex items-center gap-1.5 transition"
        title="Save Shot (Ctrl+S)"
      >
        <Save className="w-3.5 h-3.5 text-slate-400" />
        <span>Save</span>
      </button>

      {/* Code Shot Button */}
      <button
        data-testid="code-shot-btn"
        onClick={onOpenCodeShot}
        className="h-9 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs flex items-center gap-1.5 transition"
        title="Generate Code Shot (cURL, Python, C#, etc.)"
      >
        <Code className="w-3.5 h-3.5 text-cyan-400" />
        <span>Code</span>
      </button>
    </div>
  );
};
