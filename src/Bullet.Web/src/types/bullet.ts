export interface Range {
  id: string;
  name: string;
  description?: string;
  createdAtUtc: string;
}

export interface Arsenal {
  id: string;
  rangeId: string;
  name: string;
  description?: string;
  tags?: string[];
  defaultArmor?: ArmorConfig;
  triggerScript?: string;
  verifierScript?: string;
  orderIndex: number;
  squads: Squad[];
  shots: Shot[];
}

export interface Squad {
  id: string;
  arsenalId: string;
  name: string;
  description?: string;
  defaultArmor?: ArmorConfig;
  triggerScript?: string;
  verifierScript?: string;
  orderIndex: number;
  shots: Shot[];
}

export interface Shot {
  id: string;
  arsenalId: string;
  squadId?: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  parameters: KeyValuePair[];
  headers: KeyValuePair[];
  payload: PayloadConfig;
  armor: ArmorConfig;
  triggerScript?: string;
  verifierScript?: string;
  settings: ShotSettings;
  orderIndex: number;
}

export interface KeyValuePair {
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface PayloadConfig {
  type: 'none' | 'json' | 'formUrlEncoded' | 'multipart' | 'raw' | 'xml' | 'graphQl';
  rawText?: string;
  graphQlQuery?: string;
  graphQlVariables?: string;
  formData: KeyValuePair[];
}

export interface ArmorConfig {
  type: 'inherit' | 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'awsSigV4';
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsRegion?: string;
  awsService?: string;
}

export interface ShotSettings {
  timeoutMs: number;
  followRedirects: boolean;
  maxRedirects: number;
  verifyTls: boolean;
  bypassSsrfGuard: boolean;
  tlsProfileId?: string;
}

export interface Loadout {
  id: string;
  rangeId: string;
  name: string;
  isProduction: boolean;
  rounds: Round[];
}

export interface Round {
  id: string;
  loadoutId: string;
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

export interface TLSProfile {
  id: string;
  rangeId: string;
  name: string;
  clientCertificatePem?: string;
  clientKeyPem?: string;
  certificateAuthorityPem?: string;
  minTlsVersion?: string;
  maxTlsVersion?: string;
  cipherSuites?: string[];
  insecureSkipVerify: boolean;
}

export interface TargetRange {
  id: string;
  rangeId: string;
  name: string;
  prefixPath: string;
  port: number;
  enabled: boolean;
  mockRulesJson: string;
}

export interface Sentinel {
  id: string;
  rangeId: string;
  name: string;
  arsenalId?: string;
  loadoutId?: string;
  cronSchedule: string;
  enabled: boolean;
  lastRunUtc?: string;
  lastRunPassed?: boolean;
}

export interface ShotLog {
  id: string;
  rangeId: string;
  shotId?: string;
  shotName: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  isSuccess: boolean;
  executedAtUtc: string;
  responsePreview?: string;
}

export interface ImpactCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

export interface VerificationResult {
  testName: string;
  passed: boolean;
  errorMessage?: string;
  durationMs: number;
}

export interface TrajectoryLogEntry {
  category: string;
  message: string;
  timestampUtc: string;
  level: string;
}

export interface TimingBreakdown {
  dnsLookupMs: number;
  tcpConnectionMs: number;
  tlsHandshakeMs: number;
  ttfbMs: number;
  contentDownloadMs: number;
  totalMs: number;
  tcpConnectMs?: number;
  timeToFirstByteMs?: number;
  cipherSuite?: string;
  tlsProtocol?: string;
}

export interface Impact {
  shotId: string;
  shotName?: string;
  method?: string;
  resolvedUrl: string;
  statusCode: number;
  statusText: string;
  isSuccess: boolean;
  durationMs: number;
  sizeBytes: number;
  contentType?: string;
  responseHeaders: Record<string, string>;
  requestHeadersSent: Record<string, string>;
  cookies: ImpactCookie[];
  bodyPreview?: string;
  isBinary?: boolean;
  timing: TimingBreakdown;
  trajectoryLogs: TrajectoryLogEntry[];
  verifications: VerificationResult[];
  exportedRounds: Record<string, string>;
  errorMessage?: string;

  // Compatibility aliases
  responseSizeBytes?: number;
  bodyText?: string;
  headers?: Record<string, string>;
  telemetry?: TimingBreakdown;
}

export interface FiringRun {
  id: string;
  rangeId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalShots: number;
  passedShots: number;
  failedShots: number;
  durationMs: number;
  iterations: number;
  startedAtUtc: string;
  completedAtUtc?: string;
  results: FiringRunResult[];
}

export interface FiringRunResult {
  id: string;
  firingRunId: string;
  shotId: string;
  shotName: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  passed: boolean;
  iterationIndex: number;
  orderIndex: number;
  assertionResultsJson?: string;
  errorMessage?: string;
}

export interface CookieRecord {
  id: string;
  domain: string;
  name: string;
  value: string;
  path: string;
  isSecure: boolean;
  isHttpOnly: boolean;
  expiresUtc?: string;
}
