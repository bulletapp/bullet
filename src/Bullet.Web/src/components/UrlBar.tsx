import React, { useState, useEffect } from 'react';
import { Crosshair, Play, Square, Save, Code, Copy, Info, Check, Sparkles } from 'lucide-react';
import { Shot, Loadout, KeyValuePair } from '../types/bullet';

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

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-rose-400',
  HEAD: 'text-slate-400',
  OPTIONS: 'text-cyan-400',
};

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
  const [curlBanner, setCurlBanner] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

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

  // Parse cURL command on paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const trimmed = pastedText.trim();
    if (trimmed.startsWith('curl ') || trimmed.startsWith('curl\n') || trimmed.startsWith('curl\r\n')) {
      e.preventDefault();
      try {
        let method = 'GET';
        let url = '';
        const headers: KeyValuePair[] = [...(shot.headers || [])];
        let payloadRaw = '';

        // Extract Method
        const methodMatch = trimmed.match(/-X\s+([A-Z]+)/i) || trimmed.match(/--request\s+([A-Z]+)/i);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }

        // Extract URL
        const urlMatch = trimmed.match(/(?:'|")?(https?:\/\/[^\s'"]+)(?:'|")?/i);
        if (urlMatch) {
          url = urlMatch[1];
        }

        // Extract Headers
        const headerMatches = trimmed.matchAll(/(?:-H|--header)\s+['"]([^'"]+)['"]/gi);
        for (const m of headerMatches) {
          const headerStr = m[1];
          const colonIdx = headerStr.indexOf(':');
          if (colonIdx > 0) {
            const key = headerStr.substring(0, colonIdx).trim();
            const value = headerStr.substring(colonIdx + 1).trim();
            if (key && !headers.some((h) => h.key.toLowerCase() === key.toLowerCase())) {
              headers.push({ key, value, enabled: true });
            }
          }
        }

        // Extract Body
        const dataMatch = trimmed.match(/(?:-d|--data|--data-raw)\s+['"]([\s\S]*?)['"](?:\s+|$)/i);
        if (dataMatch) {
          payloadRaw = dataMatch[1];
          if (!methodMatch) method = 'POST';
        }

        const updatedShot: Shot = {
          ...shot,
          method,
          url: url || shot.url,
          headers,
          payload: payloadRaw
            ? { type: 'json', rawText: payloadRaw, formData: [] }
            : shot.payload,
        };

        onChange(updatedShot);
        setCurlBanner(`Parsed cURL command: ${method} ${url || ''}`);
        setTimeout(() => setCurlBanner(null), 3500);
      } catch (err) {
        console.error('Failed to parse cURL command:', err);
      }
    }
  };

  // Generate and copy as cURL
  const handleCopyAsCurl = () => {
    let targetUrl = shot.url;
    if (activeLoadout) {
      for (const round of activeLoadout.rounds) {
        targetUrl = targetUrl.replaceAll(`{{${round.key}}}`, round.value);
      }
    }

    let curl = `curl -X ${shot.method} "${targetUrl}"`;

    // Headers
    const activeHeaders = shot.headers?.filter((h) => h.enabled && h.key) || [];
    for (const h of activeHeaders) {
      curl += ` \\\n  -H "${h.key}: ${h.value}"`;
    }

    // Body
    if (shot.method !== 'GET' && shot.method !== 'HEAD' && shot.payload?.rawText) {
      const escapedBody = shot.payload.rawText.replaceAll('"', '\\"');
      curl += ` \\\n  -d "${escapedBody}"`;
    }

    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="relative flex flex-col bg-bullet-panel border-b border-bullet-border flex-shrink-0">
      {/* Laser firing beam indicator */}
      {isFiring && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-cyan-400 to-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)] z-30" />
      )}

      {/* cURL Parsed Toast Banner */}
      {curlBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-3 py-1 text-[11px] font-mono text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="font-bold">cURL Command Auto-Detected:</span>
            <span className="truncate max-w-lg text-slate-300">{curlBanner}</span>
          </div>
          <button
            onClick={() => setCurlBanner(null)}
            className="text-amber-400 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 p-2">
        {/* Method Dropdown */}
        <div className="relative">
          <select
            data-testid="method-select"
            value={shot.method}
            onChange={(e) => onChange({ ...shot, method: e.target.value })}
            className={`h-9 px-3 bg-bullet-surface border border-bullet-border rounded text-xs font-mono font-extrabold outline-none cursor-pointer hover:border-amber-500/50 shadow-inner ${
              methodColors[shot.method] || 'text-amber-400'
            }`}
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
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onFire();
              }
            }}
            placeholder="Enter request URL, {{round}} token, or paste cURL command..."
            className="w-full h-9 bg-bullet-surface border border-bullet-border rounded px-3 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 transition shadow-inner pr-24"
          />

          {/* Live Token Preview Pill / Tooltip Trigger */}
          {hasTokens && (
            <div
              className="absolute right-2.5 flex items-center gap-1 cursor-pointer select-none"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 shadow-sm">
                <Info className="w-2.5 h-2.5" />
                <span>Resolved</span>
              </span>

              {showTooltip && (
                <div className="absolute right-0 top-7 z-50 p-2.5 bg-slate-900 border border-cyan-500/50 rounded shadow-2xl max-w-md break-all font-mono text-[11px] text-cyan-200">
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
            className="h-9 px-4 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition"
          >
            <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
            <span>ABORT</span>
          </button>
        ) : (
          <button
            data-testid="fire-btn"
            onClick={onFire}
            className="h-9 px-5 rounded bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:from-amber-600 active:to-amber-500 text-slate-950 font-mono font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
            title="Fire Shot (Ctrl+Enter)"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>FIRE</span>
            <kbd className="px-1 py-0.5 rounded bg-amber-600/30 text-[9px] font-mono text-slate-950/80 font-bold ml-1">
              Ctrl+↵
            </kbd>
          </button>
        )}

        {/* Copy as cURL Button */}
        <button
          onClick={handleCopyAsCurl}
          className="h-9 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs flex items-center gap-1.5 transition"
          title="Copy current request as executable cURL command"
        >
          {copiedCurl ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>cURL</span>
            </>
          )}
        </button>

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
          title="Generate Code Shot (Python, C#, JavaScript, Go, etc.)"
        >
          <Code className="w-3.5 h-3.5 text-cyan-400" />
          <span>Code</span>
        </button>
      </div>
    </div>
  );
};
