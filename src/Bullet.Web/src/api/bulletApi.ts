import * as signalR from '@microsoft/signalr';
import {
  Range, Arsenal, Squad, Shot, Loadout, Round, TLSProfile,
  TargetRange, Sentinel, ShotLog, Impact, FiringRun, CookieRecord
} from '../types/bullet';

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errObj = await res.json();
      if (errObj.error) errMsg = errObj.error;
      else if (errObj.title) errMsg = errObj.title;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const bulletApi = {
  // Ranges
  getRanges: () => request<Range[]>('/ranges'),
  createRange: (name: string, description?: string) =>
    request<Range>('/ranges', { method: 'POST', body: JSON.stringify({ name, description }) }),
  deleteRange: (id: string) => request<void>(`/ranges/${id}`, { method: 'DELETE' }),

  // Arsenals
  getArsenals: (rangeId: string) => request<Arsenal[]>(`/arsenals?rangeId=${rangeId}`),
  getArsenal: (id: string) => request<Arsenal>(`/arsenals/${id}`),
  createArsenal: (data: Partial<Arsenal>) =>
    request<Arsenal>('/arsenals', { method: 'POST', body: JSON.stringify(data) }),
  updateArsenal: (id: string, data: Partial<Arsenal>) =>
    request<Arsenal>(`/arsenals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArsenal: (id: string) => request<void>(`/arsenals/${id}`, { method: 'DELETE' }),

  // Squads
  createSquad: (arsenalId: string, name: string, description?: string) =>
    request<Squad>('/squads', { method: 'POST', body: JSON.stringify({ arsenalId, name, description }) }),
  updateSquad: (id: string, data: Partial<Squad>) =>
    request<Squad>(`/squads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSquad: (id: string) => request<void>(`/squads/${id}`, { method: 'DELETE' }),

  // Shots
  getShot: (id: string) => request<Shot>(`/shots/${id}`),
  createShot: async (data: Partial<Shot>): Promise<Shot> => {
    const raw: any = await request<any>('/shots', { method: 'POST', body: JSON.stringify(data) });
    return {
      ...raw,
      id: raw.id || raw.Id,
      arsenalId: raw.arsenalId || raw.ArsenalId,
      squadId: raw.squadId || raw.SquadId,
      name: raw.name || raw.Name,
      method: raw.method || raw.Method,
      url: raw.url || raw.Url,
      settings: raw.settings || raw.Settings,
      parameters: raw.parameters || raw.Parameters || [],
      headers: raw.headers || raw.Headers || [],
      payload: raw.payload || raw.Payload || { type: 'none' },
      armor: raw.armor || raw.Armor || { type: 'inherit' },
      triggerScript: raw.triggerScript || raw.TriggerScript,
      verifierScript: raw.verifierScript || raw.VerifierScript,
      orderIndex: raw.orderIndex ?? raw.OrderIndex ?? 0,
    };
  },
  updateShot: async (id: string, data: Partial<Shot>): Promise<Shot> => {
    const raw: any = await request<any>(`/shots/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return {
      ...raw,
      id: raw.id || raw.Id || id,
      arsenalId: raw.arsenalId || raw.ArsenalId,
      squadId: raw.squadId || raw.SquadId,
      name: raw.name || raw.Name,
      method: raw.method || raw.Method,
      url: raw.url || raw.Url,
      settings: raw.settings || raw.Settings,
      parameters: raw.parameters || raw.Parameters || [],
      headers: raw.headers || raw.Headers || [],
      payload: raw.payload || raw.Payload || { type: 'none' },
      armor: raw.armor || raw.Armor || { type: 'inherit' },
      triggerScript: raw.triggerScript || raw.TriggerScript,
      verifierScript: raw.verifierScript || raw.VerifierScript,
      orderIndex: raw.orderIndex ?? raw.OrderIndex ?? 0,
    };
  },
  deleteShot: (id: string) => request<void>(`/shots/${id}`, { method: 'DELETE' }),
  moveShot: (id: string, squadId: string | null, arsenalId?: string, orderIndex?: number) =>
    request<Shot>(`/shots/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ squadId, arsenalId, orderIndex }),
    }),
  fireShot: (
    id: string,
    options?: {
      loadoutId?: string;
      tlsProfileId?: string;
      method?: string;
      url?: string;
      parameters?: any[];
      headers?: any[];
      payload?: any;
      armor?: any;
      settings?: any;
      triggerScript?: string;
      verifierScript?: string;
      grpcService?: string;
      grpcMethod?: string;
      grpcProto?: string;
      grpcUseTls?: boolean;
    }
  ) => {
    const validId = id && id !== 'undefined' ? id : (options as any)?.id;
    if (!validId || validId === 'undefined') {
      throw new Error(`Cannot fire shot: invalid or missing Shot ID '${id}'`);
    }
    return request<Impact>(`/shots/${validId}/fire`, { method: 'POST', body: JSON.stringify(options ?? {}) });
  },
  fireAdHoc: (shot: Shot, loadoutId?: string, tlsProfileId?: string) =>
    request<Impact>('/shots/fire-ad-hoc', { method: 'POST', body: JSON.stringify({ shot, loadoutId, tlsProfileId }) }),

  // Loadouts & Rounds
  getLoadouts: (rangeId: string) => request<Loadout[]>(`/loadouts?rangeId=${rangeId}`),
  createLoadout: (rangeId: string, name: string, isProduction: boolean = false) =>
    request<Loadout>('/loadouts', { method: 'POST', body: JSON.stringify({ rangeId, name, isProduction }) }),
  updateLoadout: (id: string, data: Partial<Loadout>) =>
    request<Loadout>(`/loadouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLoadout: (id: string) => request<void>(`/loadouts/${id}`, { method: 'DELETE' }),
  addRound: (loadoutId: string, round: Partial<Round>) =>
    request<Round>(`/loadouts/${loadoutId}/rounds`, { method: 'POST', body: JSON.stringify(round) }),
  updateRound: (roundId: string, round: Partial<Round>) =>
    request<Round>(`/loadouts/rounds/${roundId}`, { method: 'PUT', body: JSON.stringify(round) }),
  deleteRound: (roundId: string) => request<void>(`/loadouts/rounds/${roundId}`, { method: 'DELETE' }),

  // TLS Profiles
  getTlsProfiles: (rangeId: string) => request<TLSProfile[]>(`/tls-profiles?rangeId=${rangeId}`),
  createTlsProfile: (profile: Partial<TLSProfile>) =>
    request<TLSProfile>('/tls-profiles', { method: 'POST', body: JSON.stringify(profile) }),
  deleteTlsProfile: (id: string) => request<void>(`/tls-profiles/${id}`, { method: 'DELETE' }),

  // Sentinels
  getSentinels: (rangeId: string) => request<Sentinel[]>(`/sentinels?rangeId=${rangeId}`),
  createSentinel: (sentinel: Partial<Sentinel>) =>
    request<Sentinel>('/sentinels', { method: 'POST', body: JSON.stringify(sentinel) }),
  runSentinel: (id: string) => request<any>(`/sentinels/${id}/run`, { method: 'POST' }),
  deleteSentinel: (id: string) => request<void>(`/sentinels/${id}`, { method: 'DELETE' }),

  // Target Range (Mocks)
  getTargetRanges: (rangeId: string) => request<TargetRange[]>(`/target-ranges?rangeId=${rangeId}`),
  createTargetRange: (mock: Partial<TargetRange>) =>
    request<TargetRange>('/target-ranges', { method: 'POST', body: JSON.stringify(mock) }),
  deleteTargetRange: (id: string) => request<void>(`/target-ranges/${id}`, { method: 'DELETE' }),

  // Shot Logs
  getShotLogs: (rangeId: string, limit: number = 50) =>
    request<ShotLog[]>(`/shot-logs?rangeId=${rangeId}&limit=${limit}`),
  clearShotLogs: (rangeId: string) => request<void>(`/shot-logs?rangeId=${rangeId}`, { method: 'DELETE' }),

  // Firing Runs
  getFiringRuns: (rangeId: string) => request<FiringRun[]>(`/firing-runs?rangeId=${rangeId}`),
  getFiringRun: (id: string) => request<FiringRun>(`/firing-runs/${id}`),
  startFiringRun: (data: {
    rangeId: string;
    name?: string;
    arsenalId?: string;
    squadId?: string;
    shotIds?: string[];
    loadoutId?: string;
    tlsProfileId?: string;
    iterations?: number;
    delayMs?: number;
    stopOnError?: boolean;
    dataRows?: Array<Record<string, string>>;
  }) => request<FiringRun>('/firing-runs', { method: 'POST', body: JSON.stringify(data) }),
  getJunitXmlUrl: (runId: string) => `${BASE_URL}/firing-runs/${runId}/junit`,

  // Armory Transfer
  exportNative: async (arsenalId: string, includeSecrets: boolean = false) => {
    const res = await fetch(`${BASE_URL}/armory-transfer/export-native/${arsenalId}?includeSecrets=${includeSecrets}`);
    return res.text();
  },
  exportOpenApi: async (arsenalId: string) => {
    const res = await fetch(`${BASE_URL}/armory-transfer/export-openapi/${arsenalId}`);
    return res.text();
  },
  importNative: (rangeId: string, json: string) =>
    request<Arsenal>(`/armory-transfer/import-native?rangeId=${rangeId}`, { method: 'POST', body: JSON.stringify({ content: json }) }),
  importPostman: (rangeId: string, json: string) =>
    request<Arsenal>(`/armory-transfer/import-postman?rangeId=${rangeId}`, { method: 'POST', body: JSON.stringify({ content: json }) }),
  importPostmanEnvironment: (rangeId: string, json: string) =>
    request<Loadout>(`/armory-transfer/import-postman-environment?rangeId=${rangeId}`, { method: 'POST', body: JSON.stringify({ content: json }) }),
  importOpenApi: (rangeId: string, json: string) =>
    request<Arsenal>(`/armory-transfer/import-openapi?rangeId=${rangeId}`, { method: 'POST', body: JSON.stringify({ content: json }) }),
  importCurl: (arsenalId: string, curl: string) =>
    request<Shot>(`/armory-transfer/import-curl?arsenalId=${arsenalId}`, { method: 'POST', body: JSON.stringify({ content: curl }) }),

  // Code Shot
  generateCode: (shot: Shot, language: string) =>
    request<{ language: string; code: string }>(`/code-shot/generate-ad-hoc?language=${language}`, {
      method: 'POST',
      body: JSON.stringify(shot),
    }),

  // Cookie Locker
  getCookies: (domain?: string) => request<CookieRecord[]>(`/cookies${domain ? `?domain=${domain}` : ''}`),
  clearCookies: (domain?: string) => request<void>(`/cookies/clear${domain ? `?domain=${domain}` : ''}`, { method: 'POST' }),
  deleteCookie: (id: string) => request<void>(`/cookies/${id}`, { method: 'DELETE' }),

  // OAuth 2.0
  requestOAuthToken: (data: any) =>
    request<any>('/oauth/token', { method: 'POST', body: JSON.stringify(data) }),
  generatePkce: () =>
    request<{ codeVerifier: string; codeChallenge: string; codeChallengeMethod: string }>('/oauth/pkce', { method: 'POST' }),

  // gRPC
  grpcReflect: async (serverUrl: string, useTls: boolean = false) => {
    const raw = await request<any>('/grpc/reflect', {
      method: 'POST',
      body: JSON.stringify({ serverUrl, useTls }),
    });
    return {
      success: raw.success ?? true,
      isSuccess: raw.success ?? true,
      services: (raw.services || []).map((s: any) => ({
        name: s.serviceName || s.name || '',
        serviceName: s.serviceName || s.name || '',
        methods: (s.methods || []).map((m: any) => ({
          name: m.methodName || m.name || '',
          methodName: m.methodName || m.name || '',
          fullPath: m.fullPath || '',
          callType: m.callType || 'Unary',
          inputType: m.inputType || '',
          outputType: m.outputType || '',
          samplePayloadJson: m.samplePayloadJson || '{}',
        })),
      })),
      errorMessage: raw.errorMessage,
    };
  },
  grpcParseProto: async (protoContent: string, fileName?: string) => {
    const raw = await request<any>('/grpc/parse-proto', {
      method: 'POST',
      body: JSON.stringify({ protoContent, fileName }),
    });
    return {
      success: raw.success ?? true,
      isSuccess: raw.success ?? true,
      services: (raw.services || []).map((s: any) => ({
        name: s.serviceName || s.name || '',
        serviceName: s.serviceName || s.name || '',
        methods: (s.methods || []).map((m: any) => ({
          name: m.methodName || m.name || '',
          methodName: m.methodName || m.name || '',
          fullPath: m.fullPath || '',
          callType: m.callType || 'Unary',
          inputType: m.inputType || '',
          outputType: m.outputType || '',
          samplePayloadJson: m.samplePayloadJson || '{}',
        })),
      })),
      errorMessage: raw.errorMessage,
    };
  },
};

// SignalR Hub Connection helpers
export function createExecutionHubConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl('/hubs/execution')
    .withAutomaticReconnect()
    .build();
}

export function createFiringRunHubConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl('/hubs/firing-run')
    .withAutomaticReconnect()
    .build();
}
