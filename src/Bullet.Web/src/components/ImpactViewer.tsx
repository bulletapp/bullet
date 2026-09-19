import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Database, Copy, 
  ExternalLink, FileText, Activity, Eye,
  Lock, Unlock, AlertTriangle, RefreshCw, Terminal, Info 
} from 'lucide-react';
import { Impact } from '../types/bullet';

interface ImpactViewerProps {
  impact: Impact | null;
  isFiring: boolean;
  onDisableSslAndRetry?: () => void;
  onRetry?: () => void;
}

type ImpactTab = 'pretty' | 'raw' | 'preview' | 'headers' | 'cookies' | 'timing' | 'verifiers';

export const ImpactViewer: React.FC<ImpactViewerProps> = ({ 
  impact, 
  isFiring, 
  onDisableSslAndRetry,
  onRetry 
}) => {
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

  const bodyContent = impact.bodyPreview ?? impact.bodyText ?? '';
  const isExecutionError = impact.statusCode === 0 || (!impact.isSuccess && !bodyContent && Boolean(impact.errorMessage));

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
  const isServerError = impact.statusCode >= 500;

  const statusColor = isExecutionError
    ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
    : isSuccess
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

  const responseHeadersDict: Record<string, any> = impact.responseHeaders || impact.headers || {};
  const responseHeaderCount = Object.keys(responseHeadersDict).length;

  const requestHeadersDict: Record<string, string> = impact.requestHeadersSent || {};
  const requestHeaderCount = Object.keys(requestHeadersDict).length;

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
            {isExecutionError && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
            {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span data-testid="status-code">{impact.statusCode > 0 ? impact.statusCode : (isSslError ? 'SSL Error' : 'Error')}</span>
            <span data-testid="status-text">{impact.statusCode > 0 ? impact.statusText : (isSslError ? 'Certificate Invalid' : 'Could not get response')}</span>
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
            onClick={onRetry}
            className="flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
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
                ? 'border-amber-400 text-amber-400 font-semibold'
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
            </>
          )}

          <button
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-2 border-b-2 font-mono transition ${
              activeTab === 'headers'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Headers ({responseHeaderCount > 0 ? responseHeaderCount : requestHeaderCount})
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

          {totalTests > 0 && (
            <button
              onClick={() => setActiveTab('verifiers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'verifiers'
                  ? 'border-amber-400 text-amber-400 font-semibold'
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

        {/* Copy Response Body or Error */}
        <button
          onClick={() => copyToClipboard(bodyContent || impact.errorMessage || '')}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800"
          title="Copy Details"
        >
          <Copy className="w-3 h-3" />
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {/* ERROR SCREEN (Matches Postman Behavior) */}
        {isExecutionError && (activeTab === 'pretty' || activeTab === 'raw' || activeTab === 'preview') && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto my-2 select-none">
            {/* Header Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              isSslError 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
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
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded p-3 mb-4 text-left font-mono text-xs text-rose-300 break-words select-text">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5 border-b border-slate-800 pb-1">
                <span>Error Diagnostics</span>
                <span className="text-slate-600 font-mono">{impact.resolvedUrl}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {impact.errorMessage || impact.statusText || 'An unexpected execution error occurred.'}
              </div>
            </div>

            {/* Actionable Button: Disable SSL Verification & Retry (Postman 1-Click Action) */}
            {isSslError && onDisableSslAndRetry && (
              <div className="flex flex-col items-center gap-2 mb-6">
                <button
                  onClick={onDisableSslAndRetry}
                  data-testid="disable-ssl-retry-btn"
                  className="flex items-center gap-2 px-5 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/40 transition-all cursor-pointer font-sans"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Disable SSL Verification & Retry</span>
                </button>
                <span className="text-[11px] text-slate-400 font-sans">
                  Automatically turns off certificate validation for this shot (matching Postman behavior)
                </span>
              </div>
            )}

            {/* Postman-style Guidance / Troubleshooting Card */}
            <div className="w-full bg-bullet-surface border border-bullet-border rounded p-4 text-left text-xs font-sans">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2.5">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>Troubleshooting & Guidance:</span>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-400 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-200">Self-Signed / Local Certificates:</strong> Toggle off <span className="text-amber-400 font-semibold">Verify TLS / SSL Certificate</span> in the Shot Settings tab.
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

        {/* PRETTY TAB (When response received) */}
        {!isExecutionError && activeTab === 'pretty' && (
          <pre className="text-slate-200 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-500/30">
            {formattedJson}
          </pre>
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
              className="w-full h-full border-none"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-4">
            {/* Response Headers */}
            <div className="border border-bullet-border rounded overflow-hidden">
              <div className="bg-bullet-bg px-3 py-1.5 border-b border-bullet-border text-slate-400 font-mono font-medium flex items-center justify-between">
                <span>Response Headers ({responseHeaderCount})</span>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  {responseHeaderCount === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-500 font-mono text-xs">
                        {isExecutionError ? 'No response headers received (request did not complete).' : 'No response headers returned.'}
                      </td>
                    </tr>
                  ) : (
                    Object.entries(responseHeadersDict).map(([key, vals]) => {
                      const displayVal = Array.isArray(vals) ? vals.join(', ') : String(vals ?? '');
                      return (
                        <tr key={key} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50 font-mono">
                          <td className="px-3 py-1 text-amber-400 font-medium w-1/3">{key}</td>
                          <td className="px-3 py-1 text-slate-200 select-text">{displayVal}</td>
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
                        <td className="px-3 py-1 text-slate-300 select-text">{val}</td>
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
