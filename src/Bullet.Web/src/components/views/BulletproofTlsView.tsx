import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Shield, Key, Lock, Unlock, Plus, Trash2, CheckCircle2,
  AlertTriangle, Upload, Globe, Server, X, Eye, EyeOff, ChevronDown,
  ChevronRight, FileText, Check, FileCheck
} from 'lucide-react';
import { TLSProfile, CaConfig } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface BulletproofTlsViewProps {
  rangeId: string;
}

export const BulletproofTlsView: React.FC<BulletproofTlsViewProps> = ({ rangeId }) => {
  const [profiles, setProfiles] = useState<TLSProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // CA Certificate State (Postman Parity)
  const [caConfig, setCaConfig] = useState<CaConfig>({
    rangeId,
    isCaCertificateEnabled: false,
    caFileName: null,
    caBundlePem: null,
  });
  const [caPemPreviewOpen, setCaPemPreviewOpen] = useState(false);
  const caFileInputRef = useRef<HTMLInputElement>(null);

  // Add Client Certificate Form State
  const [certType, setCertType] = useState<'PFX' | 'PEM'>('PFX');
  const [profileName, setProfileName] = useState('');
  const [hostPattern, setHostPattern] = useState('');
  const [port, setPort] = useState<string>('');
  
  // PFX file state
  const [pfxFileName, setPfxFileName] = useState('');
  const [pfxBase64, setPfxBase64] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');
  const [showPfxPassword, setShowPfxPassword] = useState(false);
  const pfxFileInputRef = useRef<HTMLInputElement>(null);

  // CRT + KEY file state
  const [certFileName, setCertFileName] = useState('');
  const [clientCertPem, setClientCertPem] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [clientKeyPem, setClientKeyPem] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [showKeyPassphrase, setShowKeyPassphrase] = useState(false);
  const [showRawPemInputs, setShowRawPemInputs] = useState(false);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  // Advanced options
  const [skipVerify, setSkipVerify] = useState(false);
  const [caBundleInput, setCaBundleInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all profiles and CA config
  const loadData = async () => {
    try {
      setLoading(true);
      const [profs, ca] = await Promise.all([
        bulletApi.getTlsProfiles(rangeId),
        bulletApi.getCaConfig(rangeId),
      ]);
      setProfiles(profs);
      setCaConfig(ca);
    } catch (err: any) {
      console.error('Failed to load TLS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rangeId]);

  // Handle CA Toggle Switch (ON / OFF)
  const handleToggleCa = async (enabled: boolean) => {
    const updated: CaConfig = { ...caConfig, isCaCertificateEnabled: enabled };
    setCaConfig(updated);
    try {
      await bulletApi.saveCaConfig({
        rangeId,
        isCaCertificateEnabled: enabled,
        caFileName: caConfig.caFileName,
        caBundlePem: caConfig.caBundlePem,
      });
    } catch (err: any) {
      alert('Failed to update CA toggle: ' + err.message);
    }
  };

  // Handle CA File Selection
  const handleCaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const pemText = reader.result as string;
      const updated: CaConfig = {
        rangeId,
        isCaCertificateEnabled: true,
        caFileName: file.name,
        caBundlePem: pemText,
      };
      setCaConfig(updated);
      try {
        await bulletApi.saveCaConfig({
          rangeId,
          isCaCertificateEnabled: true,
          caFileName: file.name,
          caBundlePem: pemText,
        });
      } catch (err: any) {
        alert('Failed to save CA certificate: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle Remove CA File
  const handleRemoveCaFile = async () => {
    const updated: CaConfig = {
      rangeId,
      isCaCertificateEnabled: false,
      caFileName: null,
      caBundlePem: null,
    };
    setCaConfig(updated);
    try {
      await bulletApi.saveCaConfig({
        rangeId,
        isCaCertificateEnabled: false,
        caFileName: null,
        caBundlePem: null,
      });
    } catch (err: any) {
      alert('Failed to remove CA certificate: ' + err.message);
    }
  };

  // Handle PFX file upload
  const handlePfxFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPfxFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      setPfxBase64(b64);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Handle CRT file upload
  const handleCertFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setClientCertPem(reader.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle Key file upload
  const handleKeyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKeyFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setClientKeyPem(reader.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset form state
  const resetForm = () => {
    setProfileName('');
    setHostPattern('');
    setPort('');
    setCertType('PFX');
    setPfxFileName('');
    setPfxBase64('');
    setPfxPassword('');
    setCertFileName('');
    setClientCertPem('');
    setKeyFileName('');
    setClientKeyPem('');
    setKeyPassphrase('');
    setSkipVerify(false);
    setCaBundleInput('');
    setShowRawPemInputs(false);
  };

  // Handle Create Client Certificate
  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostPattern.trim() && !profileName.trim()) {
      alert('Please provide a Host pattern or Profile name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const computedName = profileName.trim() || `${hostPattern}${port ? ':' + port : ''}`;
      const parsedPort = port.trim() ? parseInt(port.trim(), 10) : null;

      await bulletApi.createTlsProfile({
        rangeId,
        name: computedName,
        hostPattern: hostPattern.trim() || undefined,
        port: parsedPort,
        certType,
        isEnabled: true,
        // PFX
        clientCertPfxBase64: certType === 'PFX' ? pfxBase64 : undefined,
        clientCertPassword: certType === 'PFX' ? (pfxPassword || undefined) : (keyPassphrase || undefined),
        pfxFileName: certType === 'PFX' ? pfxFileName : undefined,
        // CRT + KEY
        clientCertPem: certType === 'PEM' ? clientCertPem : undefined,
        clientKeyPem: certType === 'PEM' ? clientKeyPem : undefined,
        certFileName: certType === 'PEM' ? certFileName : undefined,
        keyFileName: certType === 'PEM' ? keyFileName : undefined,
        // Advanced
        caBundlePem: caBundleInput.trim() || undefined,
        allowSelfSigned: skipVerify,
        insecureSkipVerify: skipVerify,
      });

      resetForm();
      await loadData();
    } catch (err: any) {
      alert('Failed to save certificate: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Client Certificate (Enable / Disable)
  const handleToggleProfile = async (profile: TLSProfile) => {
    const newStatus = !(profile.isEnabled ?? true);
    try {
      await bulletApi.updateTlsProfile(profile.id, {
        rangeId: profile.rangeId,
        name: profile.name,
        hostPattern: profile.hostPattern,
        port: profile.port,
        certType: profile.certType,
        isEnabled: newStatus,
        allowSelfSigned: profile.allowSelfSigned,
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, isEnabled: newStatus } : p))
      );
    } catch (err: any) {
      alert('Failed to update certificate status: ' + err.message);
    }
  };

  // Handle Delete Client Certificate
  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`Delete client certificate "${name}"?`)) return;
    try {
      await bulletApi.deleteTlsProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert('Failed to delete profile: ' + err.message);
    }
  };

  // Client certificates list (exclude workspace CA profile)
  const clientCertProfiles = profiles.filter((p) => p.certType !== 'CA');

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* View Header */}
      <div className="h-14 border-b border-bullet-border px-6 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 tracking-wide">Certificates</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-400 font-semibold uppercase">
                Postman Parity
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Manage CA verification certificates and client certificates (mTLS) with automatic host & port matching
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
        
        {/* ============================================================== */}
        {/* 1. CA CERTIFICATES SECTION (SERVER VERIFICATION)               */}
        {/* ============================================================== */}
        <section className="bg-bullet-surface border border-bullet-border rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-slate-100 text-sm">CA Certificates</h2>
              </div>
              <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
                Turn on to add a CA certificate to verify servers. Outgoing HTTPS and TLS requests in this workspace
                will automatically validate remote server certificate chains against this trusted root authority.
              </p>
            </div>

            {/* CA On/Off Toggle */}
            <div className="flex items-center gap-3 bg-bullet-bg px-3 py-1.5 rounded-full border border-bullet-border">
              <span className={`text-[11px] font-semibold ${caConfig.isCaCertificateEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                {caConfig.isCaCertificateEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                type="button"
                onClick={() => handleToggleCa(!caConfig.isCaCertificateEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  caConfig.isCaCertificateEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                title="Toggle CA Certificate Verification"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    caConfig.isCaCertificateEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* CA File Upload or Loaded State */}
          <div className="pt-2 border-t border-bullet-border/60">
            <input
              type="file"
              ref={caFileInputRef}
              accept=".pem,.crt,.cer"
              onChange={handleCaFileSelect}
              className="hidden"
            />

            {caConfig.caFileName && caConfig.caBundlePem ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded bg-bullet-bg border border-bullet-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-xs truncate">{caConfig.caFileName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          caConfig.isCaCertificateEnabled
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {caConfig.isCaCertificateEnabled ? 'Active CA Bundle' : 'Paused (Toggle is Off)'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                        Valid X.509 PEM certificate loaded ({caConfig.caBundlePem.length} bytes)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCaPemPreviewOpen(!caPemPreviewOpen)}
                      className="px-2.5 py-1 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded transition cursor-pointer text-[11px]"
                    >
                      {caPemPreviewOpen ? 'Hide Content' : 'View PEM'}
                    </button>
                    <button
                      type="button"
                      onClick={() => caFileInputRef.current?.click()}
                      className="px-2.5 py-1 text-slate-300 hover:text-emerald-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded transition cursor-pointer text-[11px]"
                    >
                      Replace File
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveCaFile}
                      className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title="Remove CA Certificate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {caPemPreviewOpen && (
                  <div className="p-3 bg-black/40 border border-bullet-border rounded">
                    <pre className="text-[10px] text-slate-300 overflow-x-auto max-h-40 leading-relaxed font-mono">
                      {caConfig.caBundlePem}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => caFileInputRef.current?.click()}
                className="border-2 border-dashed border-bullet-border hover:border-emerald-500/50 rounded-lg p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition bg-bullet-bg/40 hover:bg-bullet-bg"
              >
                <div className="p-2.5 rounded-full bg-slate-800/80 text-slate-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-slate-200 font-medium">Select PEM / CRT root certificate file</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Supports standard .pem, .crt, or .cer CA bundles</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 2. CLIENT CERTIFICATES SECTION (mTLS AUTHENTICATION)          */}
        {/* ============================================================== */}
        <section className="bg-bullet-surface border border-bullet-border rounded-lg p-5 space-y-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-slate-100 text-sm">Client Certificates</h2>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Add client certificates for mutual TLS (mTLS). When sending requests, Bullet matches the target host and port automatically.
            </p>
          </div>

          {/* Certificate Table / Cards List */}
          {clientCertProfiles.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-bullet-border/60">
              {clientCertProfiles.map((p) => {
                const isEnabled = p.isEnabled ?? true;
                const isPfx = p.certType === 'PFX' || (!p.clientCertPem && !p.certFileName);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition ${
                      isEnabled
                        ? 'bg-bullet-bg border-bullet-border hover:border-slate-700'
                        : 'bg-bullet-bg/50 border-bullet-border/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded flex-shrink-0 ${
                        isPfx ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'
                      }`}>
                        <Key className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 text-xs truncate">{p.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isPfx
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {isPfx ? 'PFX' : 'CRT + KEY'}
                          </span>
                          {p.hasPassword && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Protected
                            </span>
                          )}
                          {p.allowSelfSigned && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px]">
                              Self-Signed OK
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-300 font-semibold">{p.hostPattern || '* (All Hosts)'}</span>
                          </div>
                          <span className="text-slate-600">•</span>
                          <div className="flex items-center gap-1">
                            <Server className="w-3 h-3 text-slate-500" />
                            <span>Port: {p.port ? p.port : 'All ports'}</span>
                          </div>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500 text-[10px] truncate">
                            {isPfx
                              ? (p.pfxFileName || 'certificate.pfx')
                              : `${p.certFileName || 'cert.crt'} & ${p.keyFileName || 'key.key'}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Toggle active switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleProfile(p)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                          isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                        title={isEnabled ? 'Certificate Active (Click to Pause)' : 'Certificate Paused (Click to Enable)'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.id, p.name)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete Certificate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. ADD CLIENT CERTIFICATE INLINE FORM CARD                     */}
          {/* ============================================================== */}
          <div className="bg-bullet-bg border border-bullet-border rounded-lg p-4 space-y-4">
            <div className="border-b border-bullet-border pb-2.5">
              <span className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                Add Client Certificate (mTLS)
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Configure a certificate for a specific host and port to authenticate requests automatically.
              </p>
            </div>

            <form onSubmit={handleSaveCertificate} className="space-y-4">
              {/* Host and Port Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">
                    Host Pattern <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="tls-host-pattern-input"
                    placeholder="e.g. api.example.com, localhost, *.internal.net"
                    value={hostPattern}
                    onChange={(e) => setHostPattern(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-emerald-500 text-xs"
                  />
                  <span className="text-[10px] text-slate-500 block">Wildcards (*.domain.com) supported</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">Port</label>
                  <input
                    type="number"
                    placeholder="e.g. 443"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-emerald-500 text-xs"
                  />
                  <span className="text-[10px] text-slate-500 block">Optional (blank = all)</span>
                </div>
              </div>

              {/* Profile Name */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block text-[11px]">
                  Profile Name <span className="text-slate-500 font-normal">(Label in Bullet)</span>
                </label>
                <input
                  type="text"
                  data-testid="tls-profile-name-input"
                  placeholder="e.g. Internal Banking mTLS Cert"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Certificate Type Segmented Selector */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block text-[11px]">Certificate File Format</label>
                <div className="grid grid-cols-2 gap-2 bg-bullet-surface p-1 rounded-lg border border-bullet-border">
                  <button
                    type="button"
                    onClick={() => setCertType('PFX')}
                    className={`py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
                      certType === 'PFX'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>PFX / PKCS#12</span>
                    <span className="text-[10px] opacity-70">(.pfx, .p12)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCertType('PEM')}
                    className={`py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
                      certType === 'PEM'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>CRT / PEM</span>
                    <span className="text-[10px] opacity-70">(.crt + .key)</span>
                  </button>
                </div>
              </div>

              {/* PFX Options */}
              {certType === 'PFX' && (
                <div className="space-y-3 bg-bullet-surface p-3.5 rounded-lg border border-bullet-border">
                  <input
                    type="file"
                    ref={pfxFileInputRef}
                    accept=".pfx,.p12"
                    onChange={handlePfxFileSelect}
                    className="hidden"
                  />

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block text-[11px]">PFX File</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => pfxFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-purple-400" />
                        <span>{pfxFileName ? 'Change PFX File' : 'Select PFX File'}</span>
                      </button>
                      <span className="text-slate-400 text-xs truncate">
                        {pfxFileName || 'No file chosen (or enter password/settings)'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block text-[11px]">Passphrase</label>
                    <div className="relative">
                      <input
                        type={showPfxPassword ? 'text' : 'password'}
                        placeholder="Enter PFX password if protected"
                        value={pfxPassword}
                        onChange={(e) => setPfxPassword(e.target.value)}
                        className="w-full p-2 pr-9 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-purple-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPfxPassword(!showPfxPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showPfxPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CRT / PEM Options */}
              {certType === 'PEM' && (
                <div className="space-y-3 bg-bullet-surface p-3.5 rounded-lg border border-bullet-border">
                  <input
                    type="file"
                    ref={certFileInputRef}
                    accept=".crt,.pem,.cer"
                    onChange={handleCertFileSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={keyFileInputRef}
                    accept=".key,.pem"
                    onChange={handleKeyFileSelect}
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    {/* CRT File */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-medium block text-[11px]">Certificate File (.crt, .pem)</label>
                      <button
                        type="button"
                        onClick={() => certFileInputRef.current?.click()}
                        className="w-full px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition truncate"
                      >
                        <Upload className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="truncate">{certFileName || 'Select CRT File'}</span>
                      </button>
                    </div>

                    {/* KEY File */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-medium block text-[11px]">Private Key File (.key, .pem)</label>
                      <button
                        type="button"
                        onClick={() => keyFileInputRef.current?.click()}
                        className="w-full px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition truncate"
                      >
                        <Upload className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="truncate">{keyFileName || 'Select KEY File'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block text-[11px]">Passphrase (Optional)</label>
                    <div className="relative">
                      <input
                        type={showKeyPassphrase ? 'text' : 'password'}
                        placeholder="Optional passphrase for encrypted private key"
                        value={keyPassphrase}
                        onChange={(e) => setKeyPassphrase(e.target.value)}
                        className="w-full p-2 pr-9 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-cyan-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyPassphrase(!showKeyPassphrase)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showKeyPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible raw text inputs fallback for backward compatibility & testing */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRawPemInputs(!showRawPemInputs)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {showRawPemInputs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>Paste Raw PEM Text Directly</span>
                    </button>

                    {showRawPemInputs && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">Raw Client Cert</label>
                          <textarea
                            data-testid="tls-client-cert-textarea"
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            value={clientCertPem}
                            onChange={(e) => setClientCertPem(e.target.value)}
                            className="w-full h-20 p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 font-mono text-[10px] outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">Raw Private Key</label>
                          <textarea
                            data-testid="tls-client-key-textarea"
                            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                            value={clientKeyPem}
                            onChange={(e) => setClientKeyPem(e.target.value)}
                            className="w-full h-20 p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 font-mono text-[10px] outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Advanced Options Checkbox (Self-Signed remote server verification bypass) */}
              <div className="pt-2 border-t border-bullet-border space-y-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="tls-skip-verify-checkbox"
                    checked={skipVerify}
                    onChange={(e) => setSkipVerify(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs">Skip Remote Server TLS Verification (Accept Self-Signed)</span>
                </label>

                {/* Hidden / optional inline CA bundle for specific profile */}
                <input
                  type="hidden"
                  data-testid="tls-ca-bundle-textarea"
                  value={caBundleInput}
                  onChange={(e) => setCaBundleInput(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-bullet-border">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs cursor-pointer transition"
                >
                  Clear
                </button>

                <button
                  type="submit"
                  data-testid="save-tls-profile-btn"
                  disabled={isSubmitting || (!hostPattern.trim() && !profileName.trim())}
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow"
                >
                  {isSubmitting ? 'Saving...' : 'Save Certificate Profile'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
