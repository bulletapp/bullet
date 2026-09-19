export interface Range {
  id: string;
  name: string;
  description?: string;
  createdAtUtc: string;
  arsenals?: Arsenal[];
  loadouts?: Loadout[];
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
  grpcService?: string;
  grpcMethod?: string;
  grpcProto?: string;
  grpcUseReflection?: boolean;
  grpcUseTls?: boolean;
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
  rawContent?: string;
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
  
  // OAuth 2.0 properties
  grantType?: string;
  accessTokenUrl?: string;
  authUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  state?: string;
  redirectUri?: string;
  clientAuth?: 'header' | 'body';
  usePkce?: boolean;
  codeVerifier?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  token?: string;
  tokenType?: string;
  refreshToken?: string;
  expiresAt?: string;
  autoRefresh?: boolean;
  headerPrefix?: string;
  addTo?: 'header' | 'query';
  
  properties?: Record<string, string>;
}

export interface ShotSettings {
  timeoutMs: number;
  followRedirects: boolean;
  maxRedirects: number;
  verifyTls?: boolean;
  verifySsl?: boolean;
  bypassSsrfGuard: boolean;
  bypassSsrfProtection?: boolean;
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
  name?: string;
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

export interface TlsDiagnosticReport {
  handshakeSuccessful: boolean;
  tlsVersion?: string;
  cipherSuite?: string;
  serverCertificateSubject?: string;
  serverCertificateIssuer?: string;
  serverCertificateExpiration?: string;
  potentialIssues: string[];
  recommendation: string;
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
  tlsDiagnostics?: TlsDiagnosticReport;
  grpcDetails?: GrpcImpactDetails;

  // Compatibility aliases
  responseSizeBytes?: number;
  bodyText?: string;
  headers?: Record<string, string>;
  telemetry?: TimingBreakdown;
}

export interface GrpcImpactDetails {
  statusCode: number;
  statusText: string;
  statusMessage?: string;
  service?: string;
  method?: string;
  initialMetadata?: Record<string, string>;
  trailers?: Record<string, string>;
  isStreaming?: boolean;
  streamMessages?: string[];
}

export interface GrpcServiceInfo {
  serviceName: string;
  packageName?: string;
  methods: GrpcMethodInfo[];
}

export interface GrpcMethodInfo {
  methodName: string;
  fullPath: string;
  callType: string;
  inputType: string;
  outputType: string;
  samplePayloadJson: string;
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

// === Mesh WiFi Collaboration ===
export interface MeshStatus {
  machineName: string;
  osPlatform: string;
  localIpAddresses: string[];
  port: number;
  activeShares: ActiveShareInfo[];
}

export interface ActiveShareInfo {
  rangeId: string;
  rangeName: string;
  isPasswordProtected: boolean;
  accessMode: string;
  connectedPeers: number;
  sharedAtUtc: string;
  peers: MeshPeerInfo[];
}

export interface MeshPeerInfo {
  connectionId: string;
  peerId: string;
  peerName: string;
  osPlatform: string;
  ipAddress: string;
  connectedAtUtc: string;
}

export interface DiscoveredRange {
  peerId: string;
  machineName: string;
  osPlatform: string;
  rangeId: string;
  rangeName: string;
  hostIp: string;
  hostPort: number;
  endpoint: string;
  isPasswordProtected: boolean;
  accessMode: string;
  activePeers: number;
  lastSeenUtc: string;
}

export interface MeshJoinResponse {
  success: boolean;
  ticket?: string;
  rangeId?: string;
  rangeName?: string;
  accessMode?: string;
  rangeSnapshot?: Range;
  errorMessage?: string;
}

export interface MeshSyncEvent {
  rangeId: string;
  eventType: string;
  authorPeerName: string;
  payloadJson: string;
  timestampUtc: string;
}
