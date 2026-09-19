import React, { useState } from 'react';
import { 
  ShieldAlert, Sparkles, Plus, Trash2, Code2, 
  HelpCircle, Eye, EyeOff, CheckSquare, Square,
  Lock, AlertTriangle, Radio, FileCode, CheckCircle2,
  RefreshCw, Copy, Check, Terminal, Play, X, Zap
} from 'lucide-react';
import { Shot, KeyValuePair, ArmorConfig, PayloadConfig, ShotSettings } from '../types/bullet';
import { bulletApi } from '../api/bulletApi';

interface ShotEditorProps {
  shot: Shot;
  onChange: (updated: Shot) => void;
}

type EditorTab = 'params' | 'headers' | 'armor' | 'payload' | 'triggers' | 'verifiers' | 'settings';

export const ShotEditor: React.FC<ShotEditorProps> = ({ shot, onChange }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>(shot.method === 'GRPC' ? 'payload' : 'params');
  const [bulkMode, setBulkMode] = useState<Record<string, boolean>>({});
  const [bulkText, setBulkText] = useState<Record<string, string>>({});

  // OAuth 2.0 state
  const [isRequestingToken, setIsRequestingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [oauthUsername, setOauthUsername] = useState('');
  const [oauthPassword, setOauthPassword] = useState('');
  const [oauthAuthCode, setOauthAuthCode] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // gRPC state
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const [protoModalOpen, setProtoModalOpen] = useState(false);
  const [protoInput, setProtoInput] = useState(shot.grpcProto || '');
  const [protoParseError, setProtoParseError] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<
    Array<{
      name: string;
      methods: Array<{
        name: string;
        inputType: string;
        outputType: string;
        clientStreaming: boolean;
        serverStreaming: boolean;
        samplePayloadJson?: string;
      }>;
    }>
  >([]);

  // Key-value editor handlers
  const updateKeyValueList = (field: 'parameters' | 'headers', items: KeyValuePair[]) => {
    onChange({ ...shot, [field]: items });
  };

  const addRow = (field: 'parameters' | 'headers') => {
    const list = [...(shot[field] || [])];
    list.push({ key: '', value: '', description: '', enabled: true });
    updateKeyValueList(field, list);
  };

  const removeRow = (field: 'parameters' | 'headers', index: number) => {
    const list = [...(shot[field] || [])];
    list.splice(index, 1);
    updateKeyValueList(field, list);
  };

  const updateRow = (field: 'parameters' | 'headers', index: number, patch: Partial<KeyValuePair>) => {
    const list = [...(shot[field] || [])];
    list[index] = { ...list[index], ...patch };
    updateKeyValueList(field, list);
  };

  // Bulk Edit Toggle
  const toggleBulkMode = (field: 'parameters' | 'headers') => {
    const isBulk = bulkMode[field] ?? false;
    if (!isBulk) {
      const text = (shot[field] || [])
        .map((item) => `${item.key}:${item.value}`)
        .join('\n');
      setBulkText((prev) => ({ ...prev, [field]: text }));
    } else {
      const lines = (bulkText[field] || '').split('\n');
      const parsed: KeyValuePair[] = lines
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          const idx = l.indexOf(':');
          if (idx === -1) return { key: l.trim(), value: '', enabled: true };
          return {
            key: l.slice(0, idx).trim(),
            value: l.slice(idx + 1).trim(),
            enabled: true,
          };
        });
      updateKeyValueList(field, parsed);
    }
    setBulkMode((prev) => ({ ...prev, [field]: !isBulk }));
  };

  // Format JSON payload
  const beautifyPayload = () => {
    const raw = shot.payload.rawText || shot.payload.rawContent;
    if (shot.payload.type === 'json' && raw) {
      try {
        const obj = JSON.parse(raw);
        const formatted = JSON.stringify(obj, null, 2);
        onChange({
          ...shot,
          payload: { ...shot.payload, rawText: formatted, rawContent: formatted },
        });
      } catch {
        // invalid JSON
      }
    }
  };

  // Add Trigger Snippets
  const addTriggerSnippet = (snippet: string) => {
    const current = shot.triggerScript || '';
    onChange({
      ...shot,
      triggerScript: current ? `${current}\n\n${snippet}` : snippet,
    });
  };

  // Add Verifier Snippets
  const addVerifierSnippet = (snippet: string) => {
    const current = shot.verifierScript || '';
    onChange({
      ...shot,
      verifierScript: current ? `${current}\n\n${snippet}` : snippet,
    });
  };

  // OAuth 2.0 handlers
  const handleGetNewAccessToken = async () => {
    setIsRequestingToken(true);
    setTokenError(null);
    setTokenStatus(null);
    try {
      const res = await bulletApi.requestOAuthToken({
        grantType: shot.armor?.grantType || 'client_credentials',
        accessTokenUrl: shot.armor?.accessTokenUrl || '',
        clientId: shot.armor?.clientId || '',
        clientSecret: shot.armor?.clientSecret || '',
        scope: shot.armor?.scope || '',
        state: shot.armor?.state || '',
        redirectUri: shot.armor?.redirectUri || '',
        clientAuthMethod: shot.armor?.clientAuth === 'header' ? 'Header' : 'Body',
        code: oauthAuthCode || '',
        codeVerifier: shot.armor?.codeVerifier || '',
        username: oauthUsername || '',
        password: oauthPassword || '',
        refreshToken: shot.armor?.refreshToken || '',
      });

      if (res.accessToken) {
        onChange({
          ...shot,
          armor: {
            ...shot.armor,
            token: res.accessToken,
            tokenType: res.tokenType || 'Bearer',
            refreshToken: res.refreshToken || shot.armor?.refreshToken,
            expiresAt: res.expiresAtUtc || '',
          },
        });
        setTokenStatus('Access Token acquired successfully!');
      } else {
        setTokenError('No access token returned in response.');
      }
    } catch (err: any) {
      setTokenError(err.message || 'Failed to acquire access token');
    } finally {
      setIsRequestingToken(false);
    }
  };

  const handleGeneratePkce = async () => {
    try {
      const pair = await bulletApi.generatePkce();
      onChange({
        ...shot,
        armor: {
          ...shot.armor,
          usePkce: true,
          codeVerifier: pair.codeVerifier,
          codeChallenge: pair.codeChallenge,
          codeChallengeMethod: pair.codeChallengeMethod,
        },
      });
      setTokenStatus('PKCE Code Verifier and S256 Challenge generated');
    } catch (err: any) {
      setTokenError(err.message || 'Failed to generate PKCE');
    }
  };

  const handleRefreshToken = async () => {
    if (!shot.armor?.refreshToken) return;
    setIsRequestingToken(true);
    setTokenError(null);
    try {
      const res = await bulletApi.requestOAuthToken({
        grantType: 'refresh_token',
        accessTokenUrl: shot.armor?.accessTokenUrl || '',
        clientId: shot.armor?.clientId || '',
        clientSecret: shot.armor?.clientSecret || '',
        refreshToken: shot.armor?.refreshToken,
        clientAuthMethod: shot.armor?.clientAuth === 'header' ? 'Header' : 'Body',
      });
      if (res.accessToken) {
        onChange({
          ...shot,
          armor: {
            ...shot.armor,
            token: res.accessToken,
            tokenType: res.tokenType || 'Bearer',
            refreshToken: res.refreshToken || shot.armor?.refreshToken,
            expiresAt: res.expiresAtUtc || '',
          },
        });
        setTokenStatus('Token refreshed successfully!');
      }
    } catch (err: any) {
      setTokenError(err.message || 'Failed to refresh token');
    } finally {
      setIsRequestingToken(false);
    }
  };

  const handleClearToken = () => {
    onChange({
      ...shot,
      armor: {
        ...shot.armor,
        token: undefined,
        tokenType: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
      },
    });
    setTokenStatus(null);
    setTokenError(null);
  };

  // gRPC handlers
  const handleGrpcReflect = async () => {
    setIsReflecting(true);
    setReflectError(null);
    try {
      const defaultOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:5230';
      const res = await bulletApi.grpcReflect(shot.url || defaultOrigin, shot.grpcUseTls ?? false);
      if (res.isSuccess && res.services?.length) {
        setAvailableServices(res.services);
        if (!shot.grpcService && res.services[0]) {
          const firstService = res.services[0];
          const firstMethod = firstService.methods[0];
          onChange({
            ...shot,
            grpcService: firstService.name,
            grpcMethod: firstMethod?.name,
            payload: firstMethod?.samplePayloadJson ? {
              ...shot.payload,
              type: 'json',
              rawText: firstMethod.samplePayloadJson,
              rawContent: firstMethod.samplePayloadJson,
            } : shot.payload,
          });
        }
      } else {
        setReflectError(res.errorMessage || 'Reflection failed to discover services');
      }
    } catch (err: any) {
      setReflectError(err.message || 'Failed to query Server Reflection');
    } finally {
      setIsReflecting(false);
    }
  };

  const handleParseProto = async () => {
    if (!protoInput.trim()) return;
    setProtoParseError(null);
    try {
      const res = await bulletApi.grpcParseProto(protoInput, 'service.proto');
      if (res.isSuccess && res.services?.length) {
        setAvailableServices(res.services);
        const firstService = res.services[0];
        const firstMethod = firstService.methods[0];
        onChange({
          ...shot,
          grpcProto: protoInput,
          grpcService: firstService.name,
          grpcMethod: firstMethod?.name,
          payload: firstMethod?.samplePayloadJson ? {
            ...shot.payload,
            type: 'json',
            rawText: firstMethod.samplePayloadJson,
            rawContent: firstMethod.samplePayloadJson,
          } : shot.payload,
        });
        setProtoModalOpen(false);
      } else {
        setProtoParseError(res.errorMessage || 'Failed to parse .proto definition');
      }
    } catch (err: any) {
      setProtoParseError(err.message || 'Error parsing proto');
    }
  };

  const handleSelectService = (serviceName: string) => {
    const svc = availableServices.find(s => s.name === serviceName);
    const firstMethod = svc?.methods[0];
    onChange({
      ...shot,
      grpcService: serviceName,
      grpcMethod: firstMethod?.name || shot.grpcMethod,
      payload: firstMethod?.samplePayloadJson ? {
        ...shot.payload,
        type: 'json',
        rawText: firstMethod.samplePayloadJson,
        rawContent: firstMethod.samplePayloadJson,
      } : shot.payload,
    });
  };

  const handleSelectMethod = (methodName: string) => {
    const svc = availableServices.find(s => s.name === shot.grpcService);
    const methodObj = svc?.methods.find(m => m.name === methodName);
    onChange({
      ...shot,
      grpcMethod: methodName,
      payload: methodObj?.samplePayloadJson ? {
        ...shot.payload,
        type: 'json',
        rawText: methodObj.samplePayloadJson,
        rawContent: methodObj.samplePayloadJson,
      } : shot.payload,
    });
  };

  return (
    <div className="flex flex-col h-full bg-bullet-panel select-none overflow-hidden">
      {/* gRPC RPC Cockpit Bar */}
      {shot.method === 'GRPC' && (
        <div className="bg-purple-950/20 border-b border-purple-500/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-400" />
              <span>gRPC RPC</span>
            </span>

            {/* Service selector or input */}
            {availableServices.length > 0 ? (
              <select
                data-testid="grpc-service-select"
                value={shot.grpcService || ''}
                onChange={(e) => handleSelectService(e.target.value)}
                className="bg-bullet-bg border border-bullet-border rounded px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-purple-400 flex-1 min-w-[140px]"
              >
                <option value="">Select Service...</option>
                {availableServices.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                data-testid="grpc-service-input"
                value={shot.grpcService || ''}
                onChange={(e) => onChange({ ...shot, grpcService: e.target.value })}
                placeholder="Service (e.g. bullet.v1.BulletTestService)"
                className="bg-bullet-bg border border-bullet-border rounded px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-purple-400 flex-1 min-w-[140px]"
              />
            )}

            {/* Method selector or input */}
            {availableServices.find((s) => s.name === shot.grpcService)?.methods?.length ? (
              <select
                data-testid="grpc-method-select"
                value={shot.grpcMethod || ''}
                onChange={(e) => handleSelectMethod(e.target.value)}
                className="bg-bullet-bg border border-bullet-border rounded px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-purple-400 flex-1 min-w-[140px]"
              >
                <option value="">Select Method...</option>
                {availableServices
                  .find((s) => s.name === shot.grpcService)!
                  .methods.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.inputType} → {m.outputType})
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                data-testid="grpc-method-input"
                value={shot.grpcMethod || ''}
                onChange={(e) => onChange({ ...shot, grpcMethod: e.target.value })}
                placeholder="Method (e.g. Ping)"
                className="bg-bullet-bg border border-bullet-border rounded px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-purple-400 flex-1 min-w-[140px]"
              />
            )}
          </div>

          {/* Action buttons: Reflection & Proto */}
          <div className="flex items-center gap-1.5">
            <button
              data-testid="grpc-reflect-btn"
              onClick={handleGrpcReflect}
              disabled={isReflecting}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 text-purple-300 hover:text-purple-200 transition cursor-pointer"
              title="Query Server Reflection to auto-discover services and methods"
            >
              <Radio className={`w-3 h-3 ${isReflecting ? 'animate-spin' : ''}`} />
              <span>{isReflecting ? 'Reflecting...' : 'Reflection'}</span>
            </button>

            <button
              data-testid="grpc-proto-btn"
              onClick={() => setProtoModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Import or paste .proto definition"
            >
              <FileCode className="w-3 h-3 text-cyan-400" />
              <span>Proto</span>
            </button>
          </div>
        </div>
      )}

      {/* Reflection Notice Banner */}
      {reflectError && (
        <div className="px-3 py-1 bg-rose-950/40 border-b border-rose-500/20 text-rose-400 text-[11px] font-mono flex items-center justify-between">
          <span>Reflection notice: {reflectError}</span>
          <button onClick={() => setReflectError(null)} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
      )}

      {/* Sub-tab strip */}
      <div className="flex items-center gap-1 px-3 border-b border-bullet-border bg-bullet-bg text-xs">
        {shot.method === 'GRPC' ? (
          <>
            <button
              data-testid="tab-body"
              onClick={() => setActiveTab('payload')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'payload'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="gRPC Message"
            >
              <span>Message</span>
              {shot.payload?.rawText?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              )}
            </button>

            <button
              data-testid="tab-headers"
              onClick={() => setActiveTab('headers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'headers'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Metadata
              {shot.headers?.length > 0 && (
                <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                  {shot.headers.filter((h) => h.enabled && h.key).length}
                </span>
              )}
            </button>

            <button
              data-testid="tab-auth"
              onClick={() => setActiveTab('armor')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'armor'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Authorization"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Auth</span>
              {shot.armor?.type && shot.armor.type !== 'inherit' && shot.armor.type !== 'none' && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              )}
            </button>

            <button
              data-testid="tab-prerequest"
              onClick={() => setActiveTab('triggers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'triggers'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Pre-request Script"
            >
              Pre-request
              {shot.triggerScript?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              data-testid="tab-tests"
              onClick={() => setActiveTab('verifiers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'verifiers'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Post-response Tests"
            >
              Tests
              {shot.verifierScript?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              data-testid="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 border-b-2 font-mono transition ${
                activeTab === 'settings'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Settings
            </button>
          </>
        ) : (
          <>
            <button
              data-testid="tab-params"
              onClick={() => setActiveTab('params')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'params'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Params
              {shot.parameters?.length > 0 && (
                <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                  {shot.parameters.filter((p) => p.enabled && p.key).length}
                </span>
              )}
            </button>

            <button
              data-testid="tab-auth"
              onClick={() => setActiveTab('armor')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'armor'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Authorization"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Auth</span>
              {shot.armor?.type && shot.armor.type !== 'inherit' && shot.armor.type !== 'none' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

            <button
              data-testid="tab-headers"
              onClick={() => setActiveTab('headers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'headers'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Headers
              {shot.headers?.length > 0 && (
                <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                  {shot.headers.filter((h) => h.enabled && h.key).length}
                </span>
              )}
            </button>

            <button
              data-testid="tab-body"
              onClick={() => setActiveTab('payload')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'payload'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Request Body"
            >
              Body
              {shot.payload?.type && shot.payload.type !== 'none' && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>

            <button
              data-testid="tab-prerequest"
              onClick={() => setActiveTab('triggers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'triggers'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Pre-request Script"
            >
              Pre-request
              {shot.triggerScript?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              data-testid="tab-tests"
              onClick={() => setActiveTab('verifiers')}
              className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
                activeTab === 'verifiers'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Post-response Tests"
            >
              Tests
              {shot.verifierScript?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              data-testid="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 border-b-2 font-mono transition ${
                activeTab === 'settings'
                  ? 'border-amber-400 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Settings
            </button>
          </>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* PARAMS / HEADERS VIEW */}
        {(activeTab === 'params' || activeTab === 'headers') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                {activeTab === 'params' ? 'Query Parameters' : 'HTTP Request Headers'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleBulkMode(activeTab === 'params' ? 'parameters' : 'headers')}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition"
                >
                  {bulkMode[activeTab === 'params' ? 'parameters' : 'headers'] ? 'Grid Edit' : 'Bulk Edit'}
                </button>
              </div>
            </div>

            {bulkMode[activeTab === 'params' ? 'parameters' : 'headers'] ? (
              <textarea
                value={bulkText[activeTab === 'params' ? 'parameters' : 'headers'] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const key = activeTab === 'params' ? 'parameters' : 'headers';
                  setBulkText((prev) => ({ ...prev, [key]: val }));
                }}
                placeholder="Key:Value (one per line)"
                className="w-full h-48 bg-bullet-surface border border-bullet-border rounded p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-500"
              />
            ) : (
              <div className="border border-bullet-border rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400 font-mono">
                      <th className="w-8 px-2 py-1.5 text-center">✓</th>
                      <th className="px-3 py-1.5 font-normal">Key</th>
                      <th className="px-3 py-1.5 font-normal">Value</th>
                      <th className="px-3 py-1.5 font-normal">Description</th>
                      <th className="w-8 px-2 py-1.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {((activeTab === 'params' ? shot.parameters : shot.headers) || []).map((row, idx) => (
                      <tr key={idx} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50">
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { enabled: e.target.checked }
                              )
                            }
                            className="rounded bg-slate-900 border-slate-700 text-amber-500"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={row.key}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { key: e.target.value }
                              )
                            }
                            placeholder="Key"
                            className="w-full bg-transparent font-mono text-xs text-slate-200 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { value: e.target.value }
                              )
                            }
                            placeholder="Value"
                            className="w-full bg-transparent font-mono text-xs text-slate-200 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={row.description || ''}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { description: e.target.value }
                              )
                            }
                            placeholder="Optional notes"
                            className="w-full bg-transparent text-xs text-slate-400 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() =>
                              removeRow(activeTab === 'params' ? 'parameters' : 'headers', idx)
                            }
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-1.5 bg-bullet-bg border-t border-bullet-border">
                  <button
                    onClick={() => addRow(activeTab === 'params' ? 'parameters' : 'headers')}
                    className="flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-slate-800"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUTHORIZATION (AUTH) VIEW */}
        {activeTab === 'armor' && (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between border-b border-bullet-border pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Authorization</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Configure authentication credentials to send with this request (Bearer Token, Basic Auth, API Key).
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-mono block mb-1">Type</label>
              <select
                data-testid="auth-type-select"
                value={shot.armor?.type || 'inherit'}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    armor: { ...shot.armor, type: e.target.value as any },
                  })
                }
                className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="inherit">Inherit auth from parent</option>
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apiKey">API Key</option>
                <option value="oauth2">OAuth 2.0</option>
                <option value="awsSigV4">AWS Signature V4</option>
              </select>
            </div>

            {(!shot.armor?.type || shot.armor.type === 'inherit') && (
              <div className="p-3 bg-bullet-surface border border-bullet-border rounded text-xs text-slate-400 font-sans leading-relaxed">
                This request will automatically inherit authentication credentials from its parent collection.
              </div>
            )}

            {shot.armor?.type === 'bearer' && (
              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">
                  Bearer Token (supports <code className="text-amber-400">{'{{round}}'}</code>)
                </label>
                <input
                  type="text"
                  data-testid="bearer-token-input"
                  value={shot.armor.bearerToken || ''}
                  onChange={(e) =>
                    onChange({
                      ...shot,
                      armor: {
                        ...shot.armor,
                        bearerToken: e.target.value,
                        properties: {
                          ...(shot.armor?.properties || {}),
                          token: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="e.g. {{authToken}} or eyJhbGciOi..."
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            )}

            {shot.armor?.type === 'basic' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Username</label>
                  <input
                    type="text"
                    value={shot.armor.basicUsername || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, basicUsername: e.target.value },
                      })
                    }
                    placeholder="Username or {{username}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Password</label>
                  <input
                    type="password"
                    value={shot.armor.basicPassword || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, basicPassword: e.target.value },
                      })
                    }
                    placeholder="Password or {{password}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {shot.armor?.type === 'apiKey' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Key Name</label>
                  <input
                    type="text"
                    value={shot.armor.apiKeyName || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, apiKeyName: e.target.value },
                      })
                    }
                    placeholder="e.g. X-API-Key"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Key Value</label>
                  <input
                    type="text"
                    value={shot.armor.apiKeyValue || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, apiKeyValue: e.target.value },
                      })
                    }
                    placeholder="e.g. {{apiKey}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Add To</label>
                  <select
                    value={shot.armor.apiKeyLocation || 'header'}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, apiKeyLocation: e.target.value as any },
                      })
                    }
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
              </div>
            )}

            {/* OAuth 2.0 Configuration Panel */}
            {shot.armor?.type === 'oauth2' && (
              <div className="space-y-4">
                {/* Feedback notifications */}
                {tokenStatus && (
                  <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs font-mono text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{tokenStatus}</span>
                    </div>
                    <button onClick={() => setTokenStatus(null)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                )}
                {tokenError && (
                  <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/40 flex items-center justify-between text-xs font-mono text-rose-400">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>{tokenError}</span>
                    </div>
                    <button onClick={() => setTokenError(null)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                )}

                {/* Active Token Preview Card */}
                {shot.armor.token && (
                  <div className="p-3 bg-bullet-bg border border-emerald-500/30 rounded-lg space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-400 font-mono">Current Active Access Token</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Type: {shot.armor.tokenType || 'Bearer'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded border border-slate-800 font-mono text-xs">
                      <span className="text-slate-400 flex-1 truncate select-all">{shot.armor.token}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(shot.armor?.token || '');
                          setCopiedToken(true);
                          setTimeout(() => setCopiedToken(false), 2000);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                        title="Copy Token"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {shot.armor.expiresAt && (
                      <div className="text-[10px] font-mono text-slate-400">
                        Expires: <span className="text-slate-200">{new Date(shot.armor.expiresAt).toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                      {shot.armor.refreshToken && (
                        <button
                          type="button"
                          onClick={handleRefreshToken}
                          disabled={isRequestingToken}
                          className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRequestingToken ? 'animate-spin' : ''}`} />
                          <span>Refresh Token</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClearToken}
                        className="px-2.5 py-1 text-xs font-mono rounded bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Token</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grant Type & Placement */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Grant Type</label>
                    <select
                      data-testid="oauth-grant-type"
                      value={shot.armor.grantType || 'client_credentials'}
                      onChange={(e) =>
                        onChange({
                          ...shot,
                          armor: { ...shot.armor, grantType: e.target.value },
                        })
                      }
                      className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                    >
                      <option value="client_credentials">Client Credentials</option>
                      <option value="authorization_code">Authorization Code</option>
                      <option value="password">Password Credentials</option>
                      <option value="refresh_token">Refresh Token</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Add Token To</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={shot.armor.addTo || 'header'}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            armor: { ...shot.armor, addTo: e.target.value as any },
                          })
                        }
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      >
                        <option value="header">Request Headers</option>
                        <option value="query">Query Params</option>
                      </select>
                      <input
                        type="text"
                        value={shot.armor.headerPrefix ?? 'Bearer'}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            armor: { ...shot.armor, headerPrefix: e.target.value },
                          })
                        }
                        placeholder="Prefix (Bearer)"
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Access Token URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-400 font-mono">Access Token URL</label>
                    <button
                      type="button"
                      onClick={() => {
                        const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:5230';
                        onChange({
                          ...shot,
                          armor: {
                            ...shot.armor,
                            accessTokenUrl: `${origin}/api/test-api/oauth/token`,
                            authUrl: `${origin}/api/test-api/oauth/authorize`,
                            clientId: 'test-bullet-client',
                            clientSecret: 'super-secret-bullet-key-123',
                            scope: 'read write offline_access',
                          },
                        });
                      }}
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      Fill Mock Test URL
                    </button>
                  </div>
                  <input
                    type="text"
                    data-testid="oauth-access-token-url"
                    value={shot.armor.accessTokenUrl || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, accessTokenUrl: e.target.value },
                      })
                    }
                    placeholder="https://auth.example.com/oauth/token or {{tokenUrl}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>

                {/* Authorization Code fields */}
                {shot.armor.grantType === 'authorization_code' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 font-mono block mb-1">Auth URL (Authorization Endpoint)</label>
                      <input
                        type="text"
                        value={shot.armor.authUrl || ''}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            armor: { ...shot.armor, authUrl: e.target.value },
                          })
                        }
                        placeholder="https://auth.example.com/oauth/authorize"
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-mono block mb-1">Callback / Redirect URI</label>
                      <input
                        type="text"
                        value={shot.armor.redirectUri || 'http://localhost:5000/api/oauth/callback'}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            armor: { ...shot.armor, redirectUri: e.target.value },
                          })
                        }
                        placeholder="http://localhost:5000/api/oauth/callback"
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-mono block mb-1">Authorization Code</label>
                      <input
                        type="text"
                        value={oauthAuthCode}
                        onChange={(e) => setOauthAuthCode(e.target.value)}
                        placeholder="Enter authorization code from callback"
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* PKCE */}
                    <div className="p-3 bg-bullet-surface border border-bullet-border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-200">
                          <input
                            type="checkbox"
                            checked={shot.armor.usePkce ?? false}
                            onChange={(e) =>
                              onChange({
                                ...shot,
                                armor: { ...shot.armor, usePkce: e.target.checked },
                              })
                            }
                            className="rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
                          />
                          <span>Use PKCE (Proof Key for Code Exchange)</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleGeneratePkce}
                          className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 cursor-pointer"
                        >
                          Generate PKCE Pair (S256)
                        </button>
                      </div>

                      {shot.armor.usePkce && (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Code Verifier</span>
                            <input
                              type="text"
                              value={shot.armor.codeVerifier || ''}
                              onChange={(e) =>
                                onChange({
                                  ...shot,
                                  armor: { ...shot.armor, codeVerifier: e.target.value },
                                })
                              }
                              placeholder="Code verifier"
                              className="w-full p-1.5 bg-bullet-bg border border-bullet-border rounded text-slate-200 text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Code Challenge (S256)</span>
                            <input
                              type="text"
                              value={shot.armor.codeChallenge || ''}
                              onChange={(e) =>
                                onChange({
                                  ...shot,
                                  armor: { ...shot.armor, codeChallenge: e.target.value },
                                })
                              }
                              placeholder="Code challenge"
                              className="w-full p-1.5 bg-bullet-bg border border-bullet-border rounded text-slate-200 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Password Credentials fields */}
                {shot.armor.grantType === 'password' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 font-mono block mb-1">Username</label>
                      <input
                        type="text"
                        value={oauthUsername}
                        onChange={(e) => setOauthUsername(e.target.value)}
                        placeholder="User login"
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-mono block mb-1">Password</label>
                      <input
                        type="password"
                        value={oauthPassword}
                        onChange={(e) => setOauthPassword(e.target.value)}
                        placeholder="User password"
                        className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Refresh Token input if grant type is refresh_token */}
                {shot.armor.grantType === 'refresh_token' && (
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Refresh Token</label>
                    <input
                      type="text"
                      value={shot.armor.refreshToken || ''}
                      onChange={(e) =>
                        onChange({
                          ...shot,
                          armor: { ...shot.armor, refreshToken: e.target.value },
                        })
                      }
                      placeholder="Enter refresh token"
                      className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Client ID & Secret */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Client ID</label>
                    <input
                      type="text"
                      data-testid="oauth-client-id"
                      value={shot.armor.clientId || ''}
                      onChange={(e) =>
                        onChange({
                          ...shot,
                          armor: { ...shot.armor, clientId: e.target.value },
                        })
                      }
                      placeholder="Client Identifier"
                      className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Client Secret</label>
                    <div className="relative">
                      <input
                        type={showClientSecret ? 'text' : 'password'}
                        data-testid="oauth-client-secret"
                        value={shot.armor.clientSecret || ''}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            armor: { ...shot.armor, clientSecret: e.target.value },
                          })
                        }
                        placeholder="Client Secret"
                        className="w-full p-2 pr-8 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showClientSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scope & State & Client Auth Method */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Scope</label>
                    <input
                      type="text"
                      value={shot.armor.scope || ''}
                      onChange={(e) =>
                        onChange({
                          ...shot,
                          armor: { ...shot.armor, scope: e.target.value },
                        })
                      }
                      placeholder="e.g. read write"
                      className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">State</label>
                    <input
                      type="text"
                      value={shot.armor.state || ''}
                      onChange={(e) =>
                        onChange({
                          ...shot,
                          armor: { ...shot.armor, state: e.target.value },
                        })
                      }
                      placeholder="Optional CSRF state"
                      className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-mono block mb-1">Client Authentication</label>
                    <select
                      value={shot.armor.clientAuth || 'header'}
                      onChange={(e) =>
                        onChange({
                          ...shot,
                          armor: { ...shot.armor, clientAuth: e.target.value as any },
                        })
                      }
                      className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="header">Send as Basic Auth</option>
                      <option value="body">Send in Body</option>
                    </select>
                  </div>
                </div>

                {/* Token Acquisition Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    data-testid="get-oauth-token-btn"
                    onClick={handleGetNewAccessToken}
                    disabled={isRequestingToken}
                    className="w-full py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRequestingToken ? 'animate-spin' : ''}`} />
                    <span>{isRequestingToken ? 'Requesting Token...' : 'Get New Access Token'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BODY (PAYLOAD) VIEW */}
        {activeTab === 'payload' && (
          <div className="space-y-3">
            {shot.method === 'GRPC' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-bullet-border/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      <span>gRPC Message Payload</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      (JSON format &bull; serialized to Protobuf framing on execution)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      data-testid="beautify-json-btn"
                      onClick={beautifyPayload}
                      className="flex items-center gap-1 text-[11px] font-mono text-purple-400 hover:text-purple-300 cursor-pointer px-2 py-1 rounded bg-purple-950/30 border border-purple-500/30 transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Beautify JSON</span>
                    </button>
                  </div>
                </div>

                <textarea
                  data-testid="grpc-message-textarea"
                  value={shot.payload?.rawText ?? shot.payload?.rawContent ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...shot,
                      payload: {
                        ...shot.payload,
                        type: 'json',
                        rawText: e.target.value,
                        rawContent: e.target.value,
                      },
                    })
                  }
                  placeholder="{\n  &quot;name&quot;: &quot;BULLET-Client&quot;\n}"
                  className="w-full h-80 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-purple-200 outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Body Format:
                    </span>
                    <div className="flex items-center gap-2">
                      {(['none', 'json', 'formUrlEncoded', 'multipart', 'raw', 'xml', 'graphQl'] as const).map((type) => (
                        <label key={type} className="flex items-center gap-1 cursor-pointer text-xs font-mono">
                          <input
                            type="radio"
                            name="payloadType"
                            value={type}
                            checked={shot.payload?.type === type}
                            onChange={() =>
                              onChange({
                                ...shot,
                                payload: { ...shot.payload, type },
                              })
                            }
                            className="text-amber-500 cursor-pointer"
                          />
                          <span className={shot.payload?.type === type ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                            {type === 'formUrlEncoded' ? 'x-www-form-urlencoded' : type === 'multipart' ? 'form-data' : type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {shot.payload?.type === 'json' && (
                    <button
                      data-testid="beautify-json-btn"
                      onClick={beautifyPayload}
                      className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Beautify JSON</span>
                    </button>
                  )}
                </div>

                {shot.payload?.type === 'none' ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-bullet-border rounded">
                    This request does not have a body.
                  </div>
                ) : shot.payload?.type === 'graphQl' ? (
                  <div className="grid grid-cols-2 gap-2 h-72">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-mono text-slate-400 mb-1">GraphQL Query:</span>
                      <textarea
                        value={shot.payload.graphQlQuery || ''}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            payload: { ...shot.payload, graphQlQuery: e.target.value },
                          })
                        }
                        placeholder="query { users { id name } }"
                        className="w-full flex-1 bg-bullet-surface border border-bullet-border rounded p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-mono text-slate-400 mb-1">GraphQL Variables (JSON):</span>
                      <textarea
                        value={shot.payload.graphQlVariables || ''}
                        onChange={(e) =>
                          onChange({
                            ...shot,
                            payload: { ...shot.payload, graphQlVariables: e.target.value },
                          })
                        }
                        placeholder="{}"
                        className="w-full flex-1 bg-bullet-surface border border-bullet-border rounded p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ) : (
                  <textarea
                    data-testid="payload-raw-textarea"
                    value={shot.payload?.rawText ?? shot.payload?.rawContent ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        payload: {
                          ...shot.payload,
                          rawText: e.target.value,
                          rawContent: e.target.value,
                        },
                      })
                    }
                    placeholder="Enter payload contents (supports {{round}} tokens)..."
                    className="w-full h-72 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-slate-200 outline-none focus:border-amber-500 leading-relaxed"
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* TRIGGERS (PRE-REQUEST) VIEW */}
        {activeTab === 'triggers' && (
          <div className="grid grid-cols-4 gap-3 h-full">
            <div className="col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Pre-Request Script
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Runs before request execution. Use <code className="text-amber-400">bullet.*</code> SDK.
                </span>
              </div>
              <textarea
                value={shot.triggerScript || ''}
                onChange={(e) => onChange({ ...shot, triggerScript: e.target.value })}
                placeholder="// Bullet Pre-Request Script (JavaScript)
// Example:
bullet.rounds.set('reqTimestamp', Date.now().toString());
bullet.request.headers.add('X-Timestamp', bullet.rounds.get('reqTimestamp'));
bullet.console.log('Fired with timestamp');"
                className="w-full h-80 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-emerald-400 outline-none focus:border-amber-500"
              />
            </div>

            {/* Snippet Helper Column */}
            <div className="col-span-1 border-l border-bullet-border pl-3 flex flex-col gap-1.5">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Snippets
              </span>
              <button
                onClick={() => addTriggerSnippet("bullet.rounds.set('key', 'value');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Set variable
              </button>
              <button
                onClick={() => addTriggerSnippet("var val = bullet.rounds.get('key');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Get variable
              </button>
              <button
                onClick={() => addTriggerSnippet("bullet.request.headers.add('X-Custom-Header', 'custom-value');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Add header
              </button>
              <button
                onClick={() => addTriggerSnippet("bullet.console.log('Checkpoint reached');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Log message
              </button>
            </div>
          </div>
        )}

        {/* VERIFIERS (TESTS) VIEW */}
        {activeTab === 'verifiers' && (
          <div className="grid grid-cols-4 gap-3 h-full">
            <div className="col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Tests & Assertions
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Assert HTTP responses. Use <code className="text-amber-400">bullet.test(...)</code> and <code className="text-amber-400">bullet.expect(...)</code>.
                </span>
              </div>
              <textarea
                value={shot.verifierScript || ''}
                onChange={(e) => onChange({ ...shot, verifierScript: e.target.value })}
                placeholder="// Bullet Test Script (API Assertions)
bullet.test('Status code is 200', function() {
    bullet.expect(bullet.response.status).toBe(200);
});

bullet.test('Response time is under 500ms', function() {
    bullet.expect(bullet.response.responseTime).toBeLessThan(500);
});

bullet.test('Body contains token', function() {
    var json = bullet.response.json();
    bullet.expect(json.token).toBeDefined();
    bullet.rounds.set('authToken', json.token);
});"
                data-testid="verifier-script-textarea"
                className="w-full h-80 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-amber-300 outline-none focus:border-amber-500"
              />
            </div>

            {/* Snippet Helper Column */}
            <div className="col-span-1 border-l border-bullet-border pl-3 flex flex-col gap-1.5">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Assertion Snippets
              </span>
              <button
                data-testid="snippet-status-200"
                onClick={() => addVerifierSnippet("bullet.test('Status is 200 OK', function() {\n  bullet.expect(bullet.response.status).toBe(200);\n});")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Status is 200
              </button>
              <button
                onClick={() => addVerifierSnippet("bullet.test('Response time < 200ms', function() {\n  bullet.expect(bullet.response.responseTime).toBeLessThan(200);\n});")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Response time &lt; 200ms
              </button>
              <button
                onClick={() => addVerifierSnippet("bullet.test('JSON field value check', function() {\n  var data = bullet.response.json();\n  bullet.expect(data.status).toBe('active');\n});")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + JSON field check
              </button>
              <button
                onClick={() => addVerifierSnippet("// Extract token to round\nvar data = bullet.response.json();\nbullet.rounds.set('jwtToken', data.token);")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Extract token to round
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-xl">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
              Shot Execution Settings
            </span>

            <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
              <div>
                <div className="text-xs font-medium text-slate-200">Timeout (Milliseconds)</div>
                <div className="text-[11px] text-slate-400">Maximum duration before request aborts</div>
              </div>
              <input
                type="number"
                value={shot.settings?.timeoutMs || 30000}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    settings: { ...shot.settings, timeoutMs: parseInt(e.target.value) || 30000 },
                  })
                }
                className="w-24 p-1.5 bg-bullet-bg border border-bullet-border rounded font-mono text-xs text-slate-200 outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
              <div>
                <div className="text-xs font-medium text-slate-200">Follow HTTP Redirects</div>
                <div className="text-[11px] text-slate-400">Automatically follow 3xx redirect chains</div>
              </div>
              <input
                type="checkbox"
                checked={shot.settings?.followRedirects ?? true}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    settings: { ...shot.settings, followRedirects: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-amber-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
              <div>
                <div className="text-xs font-medium text-slate-200">Verify TLS / SSL Certificate</div>
                <div className="text-[11px] text-slate-400">
                  When enabled, invalid, self-signed, or expired certificates are rejected. Turn off to allow self-signed development certificates (Postman behavior).
                </div>
              </div>
              <input
                type="checkbox"
                data-testid="verify-ssl-toggle"
                checked={(shot.settings?.verifySsl ?? shot.settings?.verifyTls) ?? true}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    settings: { 
                      ...shot.settings, 
                      verifySsl: e.target.checked, 
                      verifyTls: e.target.checked 
                    },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            {/* SSRF Guard Bypass toggle */}
            <div className={`p-3 border rounded transition ${
              shot.settings?.bypassSsrfGuard || shot.settings?.bypassSsrfProtection
                ? 'bg-amber-950/20 border-amber-500/50'
                : 'bg-bullet-surface border-bullet-border'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className={`w-4 h-4 ${(shot.settings?.bypassSsrfGuard || shot.settings?.bypassSsrfProtection) ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-medium text-slate-200">Allow Local Network / Private IPs (SSRF Bypass)</span>
                </div>
                <input
                  type="checkbox"
                  checked={shot.settings?.bypassSsrfGuard ?? shot.settings?.bypassSsrfProtection ?? false}
                  onChange={(e) =>
                    onChange({
                      ...shot,
                      settings: { 
                        ...shot.settings, 
                        bypassSsrfGuard: e.target.checked,
                        bypassSsrfProtection: e.target.checked 
                      },
                    })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Enable this to allow requests to localhost, 127.0.0.1, internal IP addresses (10.x, 192.168.x), or private development servers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Proto Definition Import Modal */}
      {protoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bullet-panel border border-bullet-border rounded-lg max-w-2xl w-full p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-bullet-border pb-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">Protobuf (.proto) Definition</h3>
              </div>
              <button onClick={() => setProtoModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              Paste your proto service schema below to extract services, RPC methods, and sample payloads automatically.
            </p>

            {protoParseError && (
              <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30 text-rose-400 text-xs font-mono">
                {protoParseError}
              </div>
            )}

            <textarea
              data-testid="proto-content-textarea"
              value={protoInput}
              onChange={(e) => setProtoInput(e.target.value)}
              placeholder={`syntax = "proto3";\npackage bullet.v1;\n\nservice BulletTestService {\n  rpc Ping (PingRequest) returns (PingResponse);\n}\n\nmessage PingRequest {\n  string name = 1;\n}\n\nmessage PingResponse {\n  string message = 1;\n}`}
              className="w-full h-64 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500 leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-bullet-border">
              <button
                type="button"
                onClick={() =>
                  setProtoInput(
                    `syntax = "proto3";\npackage bullet.v1;\n\nservice BulletTestService {\n  rpc Ping (PingRequest) returns (PingResponse);\n}\n\nmessage PingRequest {\n  string name = 1;\n}\n\nmessage PingResponse {\n  string message = 1;\n}`
                  )
                }
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Insert Sample Proto
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProtoModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="parse-proto-submit-btn"
                  onClick={handleParseProto}
                  className="px-4 py-1.5 text-xs font-mono font-bold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow-sm transition"
                >
                  Parse &amp; Load Services
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
