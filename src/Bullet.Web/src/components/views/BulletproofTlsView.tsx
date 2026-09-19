import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Key, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TLSProfile } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface BulletproofTlsViewProps {
  rangeId: string;
}

export const BulletproofTlsView: React.FC<BulletproofTlsViewProps> = ({ rangeId }) => {
  const [profiles, setProfiles] = useState<TLSProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<TLSProfile | null>(null);

  const [name, setName] = useState('');
  const [hostPattern, setHostPattern] = useState('');
  const [clientCert, setClientCert] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [caBundle, setCaBundle] = useState('');
  const [skipVerify, setSkipVerify] = useState(false);
  const [minTls, setMinTls] = useState('Tls12');
  const [maxTls, setMaxTls] = useState('Tls13');

  const fetchProfiles = async () => {
    try {
      const list = await bulletApi.getTlsProfiles(rangeId);
      setProfiles(list);
      if (list.length > 0 && !selectedProfile) {
        setSelectedProfile(list[0]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [rangeId]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await bulletApi.createTlsProfile({
        rangeId,
        name,
        hostPattern: hostPattern || undefined,
        clientCertPem: clientCert || undefined,
        clientCertificatePem: clientCert || undefined,
        clientKeyPem: clientKey || undefined,
        caBundlePem: caBundle || undefined,
        certificateAuthorityPem: caBundle || undefined,
        insecureSkipVerify: skipVerify,
        minTlsVersion: minTls,
        maxTlsVersion: maxTls,
      });
      setName('');
      setHostPattern('');
      setClientCert('');
      setClientKey('');
      setCaBundle('');
      setSkipVerify(false);
      await fetchProfiles();
      setSelectedProfile(created);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Delete this TLS Profile?')) return;
    try {
      await bulletApi.deleteTlsProfile(id);
      setSelectedProfile(null);
      await fetchProfiles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-sm text-slate-100">Bulletproof TLS</span>
          <span className="text-[10px] text-slate-500 uppercase">Certificates & mTLS Profiles</span>
        </div>
      </div>

      {/* Main split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Profile List */}
        <div className="w-64 border-r border-bullet-border bg-bullet-panel p-2 space-y-1 overflow-y-auto">
          <span className="text-[10px] text-slate-500 uppercase px-2 py-1 block">TLS Profiles</span>
          {profiles.map((p) => {
            const isSelected = selectedProfile?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedProfile(p)}
                className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer transition ${
                  isSelected
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-bullet-surface'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Key className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="truncate font-medium">{p.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProfile(p.id);
                  }}
                  className="text-slate-500 hover:text-rose-400 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Profile Form & Details */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <form onSubmit={handleCreateProfile} className="space-y-3 max-w-2xl bg-bullet-surface border border-bullet-border rounded p-4">
            <span className="font-bold text-slate-100 text-sm block">
              {selectedProfile ? `Profile: ${selectedProfile.name}` : 'Create New TLS Profile'}
            </span>

            <div>
              <label className="text-slate-400 block mb-1">Profile Name</label>
              <input
                type="text"
                data-testid="tls-profile-name-input"
                required
                placeholder="e.g. Internal Banking mTLS Cert"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Host Pattern (Optional, e.g. *.internal.net or api.example.com)</label>
              <input
                type="text"
                data-testid="tls-host-pattern-input"
                placeholder="e.g. *.internal.net:443"
                value={hostPattern}
                onChange={(e) => setHostPattern(e.target.value)}
                className="w-full p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Client Certificate (PEM)</label>
                <textarea
                  data-testid="tls-client-cert-textarea"
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={clientCert}
                  onChange={(e) => setClientCert(e.target.value)}
                  className="w-full h-28 p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 font-mono text-[11px] outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Client Private Key (PEM)</label>
                <textarea
                  data-testid="tls-client-key-textarea"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                  className="w-full h-28 p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 font-mono text-[11px] outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Custom Root CA Bundle (PEM)</label>
              <textarea
                data-testid="tls-ca-bundle-textarea"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={caBundle}
                onChange={(e) => setCaBundle(e.target.value)}
                className="w-full h-24 p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 font-mono text-[11px] outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="tls-skip-verify-checkbox"
                  checked={skipVerify}
                  onChange={(e) => setSkipVerify(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500"
                />
                <span>Skip Remote Server TLS Verification (Self-Signed)</span>
              </label>

              <button
                type="submit"
                data-testid="save-tls-profile-btn"
                disabled={!name.trim()}
                className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold"
              >
                Save TLS Profile
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
