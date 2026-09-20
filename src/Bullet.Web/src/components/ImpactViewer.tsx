import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Database, Copy, 
  Activity, Lock, AlertTriangle, RefreshCw, Info,
  Search, Download, Check, Zap
} from 'lucide-react';
import { Impact } from '../types/bullet';

interface ImpactViewerProps {
  impact: Impact | null;
  isFiring: boolean;
  onRetry?: () => void;
}

type ImpactTab = 'pretty' | 'raw' | 'preview' | 'headers' | 'cookies' | 'timing' | 'verifiers' | 'trailers';

const renderHighlightedJson = (jsonStr: string, searchTerm: string) => {
  if (!jsonStr) return null;
  const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;

  const highlightSearch = (text: string, keyPrefix: string) => {
    if (!searchTerm.trim()) return text;
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark
            key={`${keyPrefix}-${i}`}
            data-testid="json-search-highlight"
            className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded shadow-sm"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(jsonStr)) !== null) {
    if (match.index > lastIndex) {
      elements.push(jsonStr.substring(lastIndex, match.index));
    }
    const token = match[0];
    const key = `tok-${match.index}`;

    if (/^"/.test(token)) {
      if (/:$/.test(token)) {
        const keyName = token.slice(0, -1);
        elements.push(
          <span key={key} className="text-sky-400 font-semibold">
            {highlightSearch(keyName, key)}
            <span className="text-slate-400">:</span>
          </span>
        );
      } else {
        elements.push(
          <span key={key} className="text-emerald-400">
            {highlightSearch(token, key)}
          </span>
        );
      }
    } else if (/true|false/.test(token)) {
      elements.push(
        <span key={key} className="text-purple-400 font-bold">
          {highlightSearch(token, key)}
        </span>
      );
    } else if (/null/.test(token)) {
      elements.push(
        <span key={key} className="text-rose-400 italic font-bold">
          {highlightSearch(token, key)}
        </span>
      );
    } else if (/^-?\d/.test(token)) {
      elements.push(
        <span key={key} className="text-amber-400 font-semibold">
          {highlightSearch(token, key)}
        </span>
      );
    } else {
      elements.push(
        <span key={key} className="text-slate-500">
          {token}
        </span>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < jsonStr.length) {
    elements.push(jsonStr.substring(lastIndex));
  }

  return elements;
};

export const ImpactViewer: React.FC<ImpactViewerProps> = ({ 
  impact, 
  isFiring, 
  onRetry 
}) => {
  const [activeTab, setActiveTab] = useState<ImpactTab>('pretty');
  const [copied, setCopied] = useState(false);
  const [jsonSearch, setJsonSearch] = useState('');
  const [headerFilter, setHeaderFilter] = useState('');

  if (isFiring) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bullet-panel p-8 select-none relative overflow-hidden">
        {/* Supersonic laser blast indicator in background */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin mb-4 shadow-[0_0_20px_rgba(245,158,11,0.25)]" />
        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold tracking-widest">
          <Zap className="w-4 h-4 animate-bounce text-cyan-400" />
          <span>EXECUTING SHOT...</span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 mt-1">Resolving trajectory & awaiting target impact</span>
      </div>
    );
  }

  if (!impact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bullet-panel p-8 text-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
          <Activity className="w-5 h-5 text-slate-400" />
        </div>
        <span className="font-mono text-xs text-slate-300 font-medium">Ready for Impact</span>
        <span className="font-mono text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
          Hit <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 font-bold">FIRE</kbd> or press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Ctrl+Enter</kbd> to execute this shot.
        </span>
      </div>
    );
  }

  const bodyContent = impact.bodyPreview ?? impact.bodyText ?? '';
  const isExecutionError = impact.statusCode === 0 || (!impact.isSuccess && !bodyContent && Boolean(impact.errorMessage));

  const isGrpc = Boolean(impact.grpcDetails);
  const grpcCode = impact.grpcDetails?.statusCode ?? 0;
  const isGrpcSuccess = isGrpc && grpcCode === 0;

  const isSslError = Boolean(
    impact.statusText === 'SSL Error' ||
    impact.errorMessage?.toLowerCase().includes('ssl') ||
    impact.errorMessage?.toLowerCase().includes('tls') ||
    impact.errorMessage?.toLowerCase().includes('certificate') ||
    impact.errorMessage?.toLowerCase().includes('handshake') ||
    impact.errorMessage?.toLowerCase().includes('untrusted') ||
    impact.errorMessage?.toLowerCase().includes('chain') ||
    impact.errorMessage?.toLowerCase().includes('namemismatch') ||
    (impact.tlsDiagnostics?.potentialIssues && impact.tlsDiagnostics.potentialIssues.length > 0)
  );

  const isSuccess = impact.statusCode >= 200 && impact.statusCode < 300;
  const isRedirect = impact.statusCode >= 300 && impact.statusCode < 400;
  const isClientError = impact.statusCode >= 400 && impact.statusCode < 500;

  const statusColor = isGrpc
    ? (isGrpcSuccess
        ? 'text-purple-400 bg-purple-500/10 border-purple-500/30 shadow-purple-950/20'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-950/20')
    : isExecutionError
    ? 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-950/20'
    : isSuccess
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-950/20'
    : isRedirect
    ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30 shadow-cyan-950/20'
    : isClientError
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30 shadow-amber-950/20'
    : 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-950/20';

  const formatSize = (bytes?: number) => {
    if (bytes == null || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const responseSize = impact.sizeBytes ?? impact.responseSizeBytes ?? bodyContent.length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([bodyContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Count matches in JSON
  let jsonMatchCount = 0;
  if (jsonSearch.trim() && formattedJson) {
    try {
      const regex = new RegExp(jsonSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      jsonMatchCount = (formattedJson.match(regex) || []).length;
    } catch {
      jsonMatchCount = 0;
    }
  }

  const verifications = impact.verifications || [];
  const passedTests = verifications.filter((v: any) => v.passed).length;
  const totalTests = verifications.length;

  const responseHeadersDict: Record<string, any> = impact.responseHeaders || impact.headers || {};
  const responseHeaderCount = Object.keys(responseHeadersDict).length;

  const filteredResponseHeaders = Object.entries(responseHeadersDict).filter(([key, val]) => {
    if (!headerFilter.trim()) return true;
    const term = headerFilter.toLowerCase();
    return key.toLowerCase().includes(term) || String(val).toLowerCase().includes(term);
  });

  const requestHeadersDict: Record<string, string> = impact.requestHeadersSent || {};
  const requestHeaderCount = Object.keys(requestHeadersDict).length;

  const cookieEntries: { name: string; value: string; domain?: string }[] = Array.isArray(impact.cookies)
    ? impact.cookies.map((c: any) => ({ name: c.name || '', value: c.value || '', domain: c.domain }))
    : Object.entries((impact.cookies as any) || {}).map(([k, v]) => ({ name: k, value: String(v) }));

  const timing = impact.timing || (impact as any).telemetry || {};
  const totalMs = Math.max(1, impact.durationMs || 1);

  // Speed rating calculation
  const getSpeedPill = (ms: number) => {
    if (ms <= 120) {
      return {
        label: 'SUPERSONIC',
        icon: '⚡',
        className: 'text-amber-300 bg-amber-500/10 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
      };
    }
    if (ms <= 400) {
      return {
        label: 'FAST',
        icon: '🚀',
        className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
      };
    }
    if (ms <= 1000) {
      return {
        label: 'NORMAL',
        icon: '⏱️',
        className: 'text-slate-300 bg-slate-800 border-slate-700',
      };
    }
    return {
      label: 'SLOW',
      icon: '🐢',
      className: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
    };
  };

  const speedInfo = getSpeedPill(impact.durationMs ?? 0);

  // Waterfall segment percentages
  const dnsMs = timing.dnsLookupMs || 0;
  const tcpMs = timing.tcpConnectionMs || timing.tcpConnectMs || 0;
  const tlsMs = timing.tlsHandshakeMs || 0;
  const ttfbMs = timing.ttfbMs || timing.timeToFirstByteMs || 0;
  const dlMs = timing.contentDownloadMs || 0;

  const dnsPct = Math.max(2, (dnsMs / totalMs) * 100);
  const tcpPct = Math.max(2, (tcpMs / totalMs) * 100);
  const tlsPct = Math.max(2, (tlsMs / totalMs) * 100);
  const ttfbPct = Math.max(10, (ttfbMs / totalMs) * 100);
  const dlPct = Math.max(2, (dlMs / totalMs) * 100);

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden">
      {/* Top Impact Telemetry Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bullet-border bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Status Pill */}
          <div data-testid="status-pill" className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs font-black shadow-sm ${statusColor}`}>
            {isGrpc ? (
              <>
                {isGrpcSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                <span data-testid="status-code">gRPC: {grpcCode}</span>
                <span data-testid="status-text">{impact.grpcDetails?.statusMessage || (grpcCode === 0 ? 'OK' : 'ERROR')}</span>
              </>
            ) : (
              <>
                {isExecutionError && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span data-testid="status-code">{impact.statusCode > 0 ? impact.statusCode : (isSslError ? 'SSL Error' : 'Error')}</span>
                <span data-testid="status-text">{impact.statusCode > 0 ? impact.statusText : (isSslError ? 'Certificate Invalid' : 'Could not get response')}</span>
              </>
            )}
          </div>

          {/* gRPC Badge */}
          {isGrpc && (
            <div className="flex items-center gap-1 text-purple-400 font-mono text-xs bg-purple-950/30 px-2 py-0.5 rounded border border-purple-500/20">
              <span className="font-bold">gRPC HTTP/2</span>
            </div>
          )}

          {/* Timing + Supersonic Speed Pill */}
          <div
            data-testid="impact-timing"
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-xs font-semibold ${speedInfo.className}`}
            title={`Roundtrip Duration: ${(impact.durationMs ?? 0).toFixed(1)} ms`}
          >
            <span>{speedInfo.icon}</span>
            <span>{(impact.durationMs ?? 0).toFixed(0)} ms</span>
            <span className="text-[10px] opacity-75">({speedInfo.label})</span>
          </div>

          {/* Size */}
          <div data-testid="impact-size" className="flex items-center gap-1 text-slate-400 font-mono text-xs">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatSize(responseSize)}</span>
          </div>

          {/* TLS Protocol Indicator */}
          {impact.telemetry?.tlsProtocol && (
            <div className="flex items-center gap-1 text-cyan-400 font-mono text-xs bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/20">
              <Lock className="w-3 h-3" />
              <span>{impact.telemetry.tlsProtocol}</span>
            </div>
          )}

          {/* Verification Counter */}
          {totalTests > 0 && (
            <div className={`flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded border ${
              passedTests === totalTests ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
            }`}>
              {passedTests === totalTests ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <XCircle className="w-3 h-3 text-rose-400" />
              )}
              <span>Tests: {passedTests}/{totalTests} Passed</span>
            </div>
          )}
        </div>

        {/* Retry Button if Error */}
        {isExecutionError && onRetry && (
          <button
            onClick={() => onRetry()}
            className="flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer shadow-sm transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>

      {/* Impact Tabs */}
      <div className="flex items-center justify-between px-3 border-b border-bullet-border bg-bullet-panel text-xs flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('pretty')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'pretty'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isExecutionError ? 'Overview' : 'Pretty'}
          </button>

          {!isExecutionError && (
            <>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-3 py-2 border-b-2 font-mono transition ${
                  activeTab === 'raw'
                    ? 'border-amber-400 text-amber-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Raw
              </button>

              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-2 border-b-2 font-mono transition ${
                  activeTab === 'preview'
                    ? 'border-amber-400 text-amber-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Preview
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'headers'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Headers ({responseHeaderCount > 0 ? responseHeaderCount : requestHeaderCount})
          </button>

          <button
            onClick={() => setActiveTab('cookies')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'cookies'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cookies ({cookieEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('timing')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'timing'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Timing
          </button>

          {(isGrpc || (impact.grpcDetails?.trailers && Object.keys(impact.grpcDetails.trailers).length > 0)) && (
            <button
              data-testid="tab-trailers"
              onClick={() => setActiveTab('trailers')}
              className={`px-3 py-2 border-b-2 font-mono transition ${
                activeTab === 'trailers'
                  ? 'border-purple-400 text-purple-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Trailers ({Object.keys(impact.grpcDetails?.trailers || {}).length})
            </button>
          )}

          {totalTests > 0 && (
            <button
              data-testid="tab-test-results"
              onClick={() => setActiveTab('verifiers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'verifiers'
                  ? 'border-amber-400 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Test Results</span>
              <span className={`text-[10px] px-1 rounded font-bold ${
                passedTests === totalTests ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {passedTests}/{totalTests}
              </span>
            </button>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5 py-1">
          {isJson && activeTab === 'pretty' && (
            <button
              onClick={downloadJson}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-800 transition"
              title="Download Response as JSON"
            >
              <Download className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}

          <button
            onClick={() => copyToClipboard(bodyContent || impact.errorMessage || '')}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition"
            title="Copy Details"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {/* ERROR SCREEN */}
        {isExecutionError && (activeTab === 'pretty' || activeTab === 'raw' || activeTab === 'preview') && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto my-2 select-none">
            {/* Header Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              isSslError 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}>
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Error Title & Subtitle */}
            <h2 className="text-base font-bold text-slate-100 mb-1 font-sans">
              {isSslError ? 'Could not get response: SSL Certificate Verification Failed' : 'Could not get response'}
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mb-4 leading-relaxed font-sans">
              {isSslError
                ? 'The SSL certificate presented by the remote server could not be verified. This happens when testing with self-signed certificates, internal development environments, or expired certificates.'
                : 'BULLET was unable to connect to the target address or receive a response. Check network reachability and URL validity.'}
            </p>

            {/* Error Detail Card */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded p-3 mb-4 text-left font-mono text-xs text-rose-300 break-words select-text shadow-inner">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5 border-b border-slate-800 pb-1">
                <span>Error Diagnostics</span>
                <span className="text-slate-600 font-mono">{impact.resolvedUrl}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {impact.errorMessage || impact.statusText || 'An unexpected execution error occurred.'}
              </div>
            </div>

            {/* Guidance / Troubleshooting Card */}
            <div className="w-full bg-bullet-surface border border-bullet-border rounded p-4 text-left text-xs font-sans">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2.5">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>Troubleshooting & Guidance:</span>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-400 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-200">Global SSL Verification Bypass:</strong> Toggle the <span className="text-amber-400 font-bold font-mono">SSL: ON / SSL: OFF</span> switch in the top header bar to disable certificate validation across all requests.
                </li>
                <li>
                  <strong className="text-slate-200">Shot-Specific Settings:</strong> Toggle off <span className="text-amber-400 font-semibold">Verify TLS / SSL Certificate</span> in the Shot Settings tab.
                </li>
                <li>
                  <strong className="text-slate-200">Hostname Mismatch:</strong> Verify that the Shot URL hostname matches the certificate's Common Name (CN) or Subject Alternative Names (SAN).
                </li>
                <li>
                  <strong className="text-slate-200">Custom Certificate Authority:</strong> If testing against an enterprise or private CA, create a Bulletproof TLS Profile with your root CA bundle (<code className="text-slate-300 font-mono">.pem</code>).
                </li>
                <li>
                  <strong className="text-slate-200">Outgoing Request Telemetry:</strong> Check the <span className="text-cyan-400 font-mono">Headers</span> tab above to verify headers sent to the remote host.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* PRETTY TAB */}
        {!isExecutionError && activeTab === 'pretty' && (
          <div className="space-y-3">
            {/* JSON Quick Search Bar */}
            {isJson && (
              <div className="flex items-center justify-between pb-2 border-b border-bullet-border/60">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    data-testid="json-search-input"
                    value={jsonSearch}
                    onChange={(e) => setJsonSearch(e.target.value)}
                    placeholder="Find in response JSON..."
                    className="w-full pl-8 pr-3 py-1 bg-bullet-surface border border-bullet-border rounded text-slate-200 text-xs font-mono outline-none focus:border-amber-500 transition"
                  />
                </div>
                {jsonSearch && (
                  <span data-testid="json-match-count" className="text-[11px] font-mono text-amber-400 ml-2">
                    {jsonMatchCount} {jsonMatchCount === 1 ? 'match' : 'matches'}
                  </span>
                )}
              </div>
            )}

            <pre
              data-testid="json-pretty-output"
              className="leading-relaxed overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-500/30 font-mono text-xs"
            >
              {isJson ? renderHighlightedJson(formattedJson, jsonSearch) : formattedJson}
            </pre>
          </div>
        )}

        {/* RAW TAB */}
        {!isExecutionError && activeTab === 'raw' && (
          <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-500/30">
            {bodyContent}
          </pre>
        )}

        {/* PREVIEW TAB */}
        {!isExecutionError && activeTab === 'preview' && (
          <div className="w-full h-full border border-bullet-border rounded bg-white overflow-hidden">
            <iframe
              title="Response Preview"
              srcDoc={bodyContent}
              className="w-full h-full border-none min-h-[400px]"
              sandbox=""
            />
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-4">
            {/* Header Search Box */}
            <div className="relative max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                data-testid="header-filter-input"
                value={headerFilter}
                onChange={(e) => setHeaderFilter(e.target.value)}
                placeholder="Filter headers by key or value..."
                className="w-full pl-8 pr-3 py-1 bg-bullet-surface border border-bullet-border rounded text-slate-200 text-xs font-mono outline-none focus:border-amber-500 transition"
              />
            </div>

            {/* Response Headers */}
            <div className="border border-bullet-border rounded overflow-hidden">
              <div className="bg-bullet-bg px-3 py-1.5 border-b border-bullet-border text-slate-400 font-mono font-medium flex items-center justify-between">
                <span>Response Headers ({filteredResponseHeaders.length})</span>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  {filteredResponseHeaders.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-500 font-mono text-xs">
                        {isExecutionError ? 'No response headers received.' : 'No matching headers found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredResponseHeaders.map(([key, vals]) => {
                      const displayVal = Array.isArray(vals) ? vals.join(', ') : String(vals ?? '');
                      return (
                        <tr key={key} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50 font-mono">
                          <td className="px-3 py-1 text-amber-400 font-medium w-1/3">{key}</td>
                          <td className="px-3 py-1 text-slate-200 select-text break-all">{displayVal}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Outgoing Request Headers Sent */}
            {requestHeaderCount > 0 && (
              <div className="border border-bullet-border rounded overflow-hidden">
                <div className="bg-bullet-bg px-3 py-1.5 border-b border-bullet-border text-slate-400 font-mono font-medium">
                  <span>Request Headers Sent ({requestHeaderCount})</span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <tbody>
                    {Object.entries(requestHeadersDict).map(([key, val]) => (
                      <tr key={key} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50 font-mono">
                        <td className="px-3 py-1 text-cyan-400 font-medium w-1/3">{key}</td>
                        <td className="px-3 py-1 text-slate-300 select-text break-all">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                      <td className="px-3 py-1 text-slate-200 select-text break-all">{cookie.value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TIMING TAB WITH NETWORK WATERFALL VISUALIZER */}
        {activeTab === 'timing' && (
          <div className="space-y-6 max-w-xl">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2 font-bold">
                Network Waterfall Breakdown
              </span>

              {/* Visual Stacked Horizontal Waterfall Bar */}
              <div className="h-6 w-full rounded-md bg-slate-900 border border-bullet-border overflow-hidden flex shadow-inner">
                {dnsMs > 0 && (
                  <div
                    style={{ width: `${dnsPct}%` }}
                    className="h-full bg-purple-500 hover:opacity-85 transition"
                    title={`DNS Lookup: ${dnsMs.toFixed(1)} ms`}
                  />
                )}
                {tcpMs > 0 && (
                  <div
                    style={{ width: `${tcpPct}%` }}
                    className="h-full bg-blue-500 hover:opacity-85 transition"
                    title={`TCP Connect: ${tcpMs.toFixed(1)} ms`}
                  />
                )}
                {tlsMs > 0 && (
                  <div
                    style={{ width: `${tlsPct}%` }}
                    className="h-full bg-cyan-500 hover:opacity-85 transition"
                    title={`TLS Handshake: ${tlsMs.toFixed(1)} ms`}
                  />
                )}
                {ttfbMs > 0 && (
                  <div
                    style={{ width: `${ttfbPct}%` }}
                    className="h-full bg-amber-500 hover:opacity-85 transition"
                    title={`Waiting (TTFB): ${ttfbMs.toFixed(1)} ms`}
                  />
                )}
                {dlMs > 0 && (
                  <div
                    style={{ width: `${dlPct}%` }}
                    className="h-full bg-emerald-500 hover:opacity-85 transition"
                    title={`Content Download: ${dlMs.toFixed(1)} ms`}
                  />
                )}
              </div>

              {/* Waterfall Legend */}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500" /> DNS</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> TCP</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-500" /> TLS</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500" /> TTFB</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Download</span>
              </div>
            </div>

            {/* Timing Metric Rows */}
            <div className="space-y-2 border-t border-bullet-border pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-400 font-medium">DNS Resolution</span>
                <span className="text-slate-200 font-mono">{dnsMs.toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-400 font-medium">TCP Handshake</span>
                <span className="text-slate-200 font-mono">{tcpMs.toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-400 font-medium">TLS Handshake</span>
                <span className="text-slate-200 font-mono">{tlsMs.toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-medium">Time to First Byte (TTFB)</span>
                <span className="text-slate-200 font-mono">{ttfbMs.toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">Content Download</span>
                <span className="text-slate-200 font-mono">{dlMs.toFixed(1)} ms</span>
              </div>
              <div className="border-t border-bullet-border pt-2 flex items-center justify-between text-xs font-bold">
                <span className="text-amber-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  Total Round-Trip Duration
                </span>
                <span className="text-amber-400 font-mono font-black">{(impact.durationMs ?? 0).toFixed(1)} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* VERIFICATIONS TAB */}
        {activeTab === 'verifiers' && (
          <div className="space-y-3">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block font-bold">
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
                    className={`flex items-center justify-between p-2.5 rounded border font-mono text-xs shadow-sm ${
                      v.passed
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {v.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      <span className="font-semibold">{v.testName || v.name}</span>
                    </div>
                    {v.errorMessage && (
                      <span className="text-rose-400 text-[11px] truncate max-w-sm font-mono">
                        {v.errorMessage}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRAILERS TAB (gRPC) */}
        {activeTab === 'trailers' && (
          <div className="space-y-4">
            <div className="border border-bullet-border rounded overflow-hidden">
              <div className="bg-bullet-bg px-3 py-1.5 border-b border-bullet-border text-slate-400 font-mono font-medium flex items-center justify-between">
                <span className="text-purple-400 font-bold flex items-center gap-1.5">
                  <span>gRPC Status & Trailers</span>
                </span>
                <span className="text-xs font-mono text-slate-300">
                  Status: <code className="text-purple-400 font-bold">{grpcCode} ({impact.grpcDetails?.statusMessage || 'OK'})</code>
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400 font-mono">
                    <th className="px-3 py-1.5 font-normal w-1/3">Trailer Name</th>
                    <th className="px-3 py-1.5 font-normal">Trailer Value</th>
                  </tr>
                </thead>
                <tbody>
                  {!impact.grpcDetails?.trailers || Object.keys(impact.grpcDetails.trailers).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-500 font-mono text-xs">
                        No gRPC trailers received.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(impact.grpcDetails.trailers).map(([key, val]) => (
                      <tr key={key} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50 font-mono">
                        <td className="px-3 py-1 text-purple-400 font-medium">{key}</td>
                        <td className="px-3 py-1 text-slate-200 select-text break-all">{val}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
