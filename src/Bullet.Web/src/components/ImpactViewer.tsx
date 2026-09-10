import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Database, Copy, 
  ExternalLink, FileText, Activity, ShieldCheck, Eye 
} from 'lucide-react';
import { Impact } from '../types/bullet';

interface ImpactViewerProps {
  impact: Impact | null;
  isFiring: boolean;
}

type ImpactTab = 'pretty' | 'raw' | 'preview' | 'headers' | 'cookies' | 'timing' | 'verifiers';

export const ImpactViewer: React.FC<ImpactViewerProps> = ({ impact, isFiring }) => {
  const [activeTab, setActiveTab] = useState<ImpactTab>('pretty');
  const [copied, setCopied] = useState(false);

  if (isFiring) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bullet-panel p-8 select-none">
        <div className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin mb-4" />
        <span className="font-mono text-xs text-amber-400 tracking-wider">FIRING SHOT...</span>
        <span className="font-mono text-[11px] text-slate-500 mt-1">Resolving trajectory & waiting for impact</span>
      </div>
    );
  }

  if (!impact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bullet-panel p-8 text-center select-none">
        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
          <Activity className="w-5 h-5" />
        </div>
        <span className="font-mono text-xs text-slate-400 font-medium">Ready for Impact</span>
        <span className="font-mono text-[11px] text-slate-500 mt-1 max-w-xs">
          Hit <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">FIRE</kbd> or press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Ctrl+Enter</kbd> to execute this shot.
        </span>
      </div>
    );
  }

  const isSuccess = impact.statusCode >= 200 && impact.statusCode < 300;
  const isRedirect = impact.statusCode >= 300 && impact.statusCode < 400;
  const isClientError = impact.statusCode >= 400 && impact.statusCode < 500;
  const isServerError = impact.statusCode >= 500;

  const statusColor = isSuccess
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : isRedirect
    ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    : isClientError
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

  const formatSize = (bytes?: number) => {
    if (bytes == null || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const bodyContent = impact.bodyPreview ?? impact.bodyText ?? '';
  const responseSize = impact.sizeBytes ?? impact.responseSizeBytes ?? bodyContent.length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format Pretty JSON if possible
  let formattedJson = '';
  let isJson = false;
  try {
    const parsed = JSON.parse(bodyContent);
    formattedJson = JSON.stringify(parsed, null, 2);
    isJson = true;
  } catch {
    formattedJson = bodyContent;
  }

  const verifications = impact.verifications || [];
  const passedTests = verifications.filter((v: any) => v.passed).length;
  const totalTests = verifications.length;

  const headersDict: Record<string, any> = impact.responseHeaders || impact.headers || {};
  const headerCount = Object.keys(headersDict).length;

  const cookieEntries: { name: string; value: string; domain?: string }[] = Array.isArray(impact.cookies)
    ? impact.cookies.map((c: any) => ({ name: c.name || '', value: c.value || '', domain: c.domain }))
    : Object.entries((impact.cookies as any) || {}).map(([k, v]) => ({ name: k, value: String(v) }));

  const timing = impact.timing || (impact as any).telemetry || {};

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden">
      {/* Top Impact Telemetry Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bullet-border bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Status Pill */}
          <div data-testid="status-pill" className={`flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-xs font-bold ${statusColor}`}>
            <span data-testid="status-code">{impact.statusCode}</span>
            <span data-testid="status-text">{impact.statusText}</span>
          </div>

          {/* Timing */}
          <div data-testid="impact-timing" className="flex items-center gap-1 text-slate-400 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{(impact.durationMs ?? 0).toFixed(0)} ms</span>
          </div>

          {/* Size */}
          <div data-testid="impact-size" className="flex items-center gap-1 text-slate-400 font-mono text-xs">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatSize(responseSize)}</span>
          </div>

          {/* TLS Version Pill */}
          {impact.telemetry?.tlsProtocol && (
            <div className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>{impact.telemetry.tlsProtocol}</span>
            </div>
          )}
        </div>

        {/* Verifications Count Indicator */}
        {totalTests > 0 && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs border ${
            passedTests === totalTests
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
              : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
          }`}>
            {passedTests === totalTests ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <XCircle className="w-3 h-3 text-rose-400" />
            )}
            <span>Verifications: {passedTests}/{totalTests} Passed</span>
          </div>
        )}
      </div>

      {/* Impact Tabs */}
      <div className="flex items-center justify-between px-3 border-b border-bullet-border bg-bullet-panel text-xs flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('pretty')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'pretty'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pretty
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'raw'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Raw
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'preview'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Preview
          </button>

          <button
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'headers'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Headers ({headerCount})
          </button>

          <button
            onClick={() => setActiveTab('cookies')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'cookies'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cookies ({cookieEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('timing')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'timing'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Timing
          </button>

          <button
            onClick={() => setActiveTab('verifiers')}
            className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
              activeTab === 'verifiers'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Verifications</span>
            {totalTests > 0 && (
              <span className={`text-[10px] px-1 rounded font-bold ${
                passedTests === totalTests ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {passedTests}/{totalTests}
              </span>
            )}
          </button>
        </div>

        {/* Copy Response Body */}
        <button
          onClick={() => copyToClipboard(bodyContent)}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800"
          title="Copy Response Body"
        >
          <Copy className="w-3 h-3" />
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {/* PRETTY TAB */}
        {activeTab === 'pretty' && (
          <pre className="text-slate-200 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-500/30">
            {formattedJson}
          </pre>
        )}

        {/* RAW TAB */}
        {activeTab === 'raw' && (
          <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-500/30">
            {bodyContent}
          </pre>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className="w-full h-full border border-bullet-border rounded bg-white overflow-hidden">
            <iframe
              title="Response Preview"
              srcDoc={bodyContent}
              className="w-full h-full border-none"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="border border-bullet-border rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400 font-mono">
                  <th className="px-3 py-1.5 font-normal w-1/3">Header Name</th>
                  <th className="px-3 py-1.5 font-normal">Header Value</th>
                </tr>
              </thead>
              <tbody>
                {headerCount === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-slate-500 font-mono text-xs">
                      No response headers received.
                    </td>
                  </tr>
                ) : (
                  Object.entries(headersDict).map(([key, vals]) => {
                    const displayVal = Array.isArray(vals) ? vals.join(', ') : String(vals ?? '');
                    return (
                      <tr key={key} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50 font-mono">
                        <td className="px-3 py-1 text-amber-400 font-medium">{key}</td>
                        <td className="px-3 py-1 text-slate-200 select-text">{displayVal}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* COOKIES TAB */}
        {activeTab === 'cookies' && (
          <div className="border border-bullet-border rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400 font-mono">
                  <th className="px-3 py-1.5 font-normal w-1/3">Cookie Name</th>
                  <th className="px-3 py-1.5 font-normal">Cookie Value</th>
                </tr>
              </thead>
              <tbody>
                {cookieEntries.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-slate-500 font-mono text-xs">
                      No cookies received in this response.
                    </td>
                  </tr>
                ) : (
                  cookieEntries.map((cookie, idx) => (
                    <tr key={idx} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50 font-mono">
                      <td className="px-3 py-1 text-cyan-400 font-medium">{cookie.name}</td>
                      <td className="px-3 py-1 text-slate-200 select-text">{cookie.value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TIMING TAB */}
        {activeTab === 'timing' && (
          <div className="space-y-4 max-w-xl">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
              Execution Timing Breakdown
            </span>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">DNS Resolution</span>
                <span className="text-slate-200">{(timing.dnsLookupMs ?? 0).toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">TCP Handshake</span>
                <span className="text-slate-200">{(timing.tcpConnectionMs ?? timing.tcpConnectMs ?? 0).toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">TLS Handshake</span>
                <span className="text-slate-200">{(timing.tlsHandshakeMs ?? 0).toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Time to First Byte (TTFB)</span>
                <span className="text-slate-200">{(timing.ttfbMs ?? timing.timeToFirstByteMs ?? 0).toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Content Download</span>
                <span className="text-slate-200">{(timing.contentDownloadMs ?? 0).toFixed(1)} ms</span>
              </div>
              <div className="border-t border-bullet-border pt-2 flex items-center justify-between text-xs font-bold">
                <span className="text-amber-400">Total Round-Trip Duration</span>
                <span className="text-amber-400">{(impact.durationMs ?? 0).toFixed(1)} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* VERIFICATIONS TAB */}
        {activeTab === 'verifiers' && (
          <div className="space-y-3">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
              Verification Test Results ({passedTests}/{totalTests} Passed)
            </span>

            {verifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 font-mono text-xs">
                No verifier assertions defined for this shot.
              </div>
            ) : (
              <div className="space-y-1.5">
                {verifications.map((v: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded border font-mono text-xs ${
                      v.passed
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {v.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      )}
                      <span className="font-medium">{v.testName || v.name}</span>
                    </div>
                    {v.errorMessage && (
                      <span className="text-rose-400 text-[11px] truncate max-w-sm">
                        {v.errorMessage}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
