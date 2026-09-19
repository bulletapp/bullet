import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Lock, Unlock, Users, Copy, X, Radio, Shield, Monitor, Eye, EyeOff } from 'lucide-react';
import { bulletApi } from '../../api/bulletApi';
import { MeshStatus, DiscoveredRange, MeshJoinResponse, ActiveShareInfo } from '../../types/bullet';

interface MeshCollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRangeId: string | null;
  selectedRangeName: string | null;
}

type TabId = 'share' | 'discover';

const osIcon = (os: string) => {
  if (os.toLowerCase().includes('mac') || os.toLowerCase().includes('osx')) return '🍎';
  if (os.toLowerCase().includes('linux')) return '🐧';
  return '🪟';
};

export const MeshCollaborationModal: React.FC<MeshCollaborationModalProps> = ({
  isOpen,
  onClose,
  selectedRangeId,
  selectedRangeName,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('share');
  const [meshStatus, setMeshStatus] = useState<MeshStatus | null>(null);
  const [discoveredRanges, setDiscoveredRanges] = useState<DiscoveredRange[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [activeShare, setActiveShare] = useState<ActiveShareInfo | null>(null);

  // Share form state
  const [sharePassword, setSharePassword] = useState('');
  const [usePassword, setUsePassword] = useState(true);
  const [accessMode, setAccessMode] = useState<'ReadWrite' | 'ReadOnly'>('ReadWrite');

  // Join state
  const [joinPasswords, setJoinPasswords] = useState<Record<string, string>>({});
  const [joinStatus, setJoinStatus] = useState<Record<string, { loading: boolean; error?: string; ticket?: string }>>({});
  const [directIp, setDirectIp] = useState('');

  // Errors
  const [shareError, setShareError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await bulletApi.getMeshStatus();
      setMeshStatus(status);
      if (selectedRangeId) {
        const existing = status.activeShares.find(s => s.rangeId === selectedRangeId);
        if (existing) {
          setActiveShare(existing);
          setIsBroadcasting(true);
        }
      }
    } catch { }
  }, [selectedRangeId]);

  const loadDiscovered = useCallback(async () => {
    try {
      const ranges = await bulletApi.getDiscoveredRanges();
      setDiscoveredRanges(ranges);
    } catch { }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadStatus();
    loadDiscovered();
    const interval = setInterval(() => {
      loadStatus();
      loadDiscovered();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, loadStatus, loadDiscovered]);

  const handleShare = async () => {
    if (!selectedRangeId) return;
    setShareLoading(true);
    setShareError('');
    try {
      const result = await bulletApi.shareRange(
        selectedRangeId,
        usePassword ? sharePassword : undefined,
        accessMode
      );
      setActiveShare(result);
      setIsBroadcasting(true);
      await loadStatus();
    } catch (e: any) {
      setShareError(e.message || 'Failed to start sharing');
    } finally {
      setShareLoading(false);
    }
  };

  const handleStopShare = async () => {
    if (!selectedRangeId) return;
    try {
      await bulletApi.stopShareRange(selectedRangeId);
      setActiveShare(null);
      setIsBroadcasting(false);
      await loadStatus();
    } catch { }
  };

  const handleJoin = async (rangeId: string) => {
    setJoinStatus(prev => ({ ...prev, [rangeId]: { loading: true } }));
    try {
      const result = await bulletApi.joinMeshRange(
        rangeId,
        joinPasswords[rangeId],
        'BULLET Peer'
      );
      if (result.success) {
        setJoinStatus(prev => ({ ...prev, [rangeId]: { loading: false, ticket: result.ticket } }));
      } else {
        setJoinStatus(prev => ({ ...prev, [rangeId]: { loading: false, error: result.errorMessage || 'Join failed' } }));
      }
    } catch (e: any) {
      setJoinStatus(prev => ({ ...prev, [rangeId]: { loading: false, error: e.message } }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  const primaryIp = meshStatus?.localIpAddresses?.[0] || '127.0.0.1';
  const connectionUrl = `http://${primaryIp}:${meshStatus?.port || 5230}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0a0e14] border border-slate-700/60 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Wifi className="w-5 h-5 text-cyan-400" />
              {isBroadcasting && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">BULLET MESH</h2>
              <p className="text-[10px] text-slate-400 font-mono">WiFi Workspace Collaboration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/40">
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-2.5 text-xs font-mono font-medium transition border-b-2 ${
              activeTab === 'share'
                ? 'text-amber-400 border-amber-400 bg-amber-500/5'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 inline mr-1.5" />
            Share This Workspace
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-2.5 text-xs font-mono font-medium transition border-b-2 ${
              activeTab === 'discover'
                ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 inline mr-1.5" />
            Nearby WiFi Ranges
            {discoveredRanges.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {discoveredRanges.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'share' && (
            <div className="space-y-4">
              {/* Machine Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-slate-200">
                    {osIcon(meshStatus?.osPlatform || '')} {meshStatus?.machineName || 'Loading...'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {meshStatus?.localIpAddresses?.join(', ') || '...'} • Port {meshStatus?.port || 5230}
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {meshStatus?.osPlatform || '...'}
                </span>
              </div>

              {!isBroadcasting ? (
                <>
                  {/* Range being shared */}
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="text-[10px] font-mono text-amber-400/60 uppercase tracking-wider mb-1">Sharing Range</div>
                    <div className="text-sm font-mono text-amber-300 font-medium">
                      {selectedRangeName || 'No range selected'}
                    </div>
                  </div>

                  {/* Password Toggle */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePassword}
                        onChange={() => setUsePassword(!usePassword)}
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
                      />
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-slate-200 font-mono">Password Protect</span>
                    </label>
                    {usePassword && (
                      <input
                        type="password"
                        value={sharePassword}
                        onChange={(e) => setSharePassword(e.target.value)}
                        placeholder="Enter collaboration password..."
                        className="w-full px-3 py-2 text-xs font-mono rounded bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Access Mode */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAccessMode('ReadWrite')}
                      className={`flex-1 py-2 text-xs font-mono rounded border transition ${
                        accessMode === 'ReadWrite'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ✏️ Read + Write
                    </button>
                    <button
                      onClick={() => setAccessMode('ReadOnly')}
                      className={`flex-1 py-2 text-xs font-mono rounded border transition ${
                        accessMode === 'ReadOnly'
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      👁️ Read Only
                    </button>
                  </div>

                  {shareError && (
                    <div className="text-xs text-red-400 font-mono p-2 rounded bg-red-500/10 border border-red-500/30">
                      {shareError}
                    </div>
                  )}

                  {/* Start Broadcasting */}
                  <button
                    onClick={handleShare}
                    disabled={shareLoading || !selectedRangeId}
                    className="w-full py-2.5 text-xs font-mono font-bold rounded bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-amber-500/20"
                  >
                    {shareLoading ? '⏳ Starting...' : '📡 Start Broadcasting on WiFi'}
                  </button>
                </>
              ) : (
                <>
                  {/* Broadcasting Active */}
                  <div className="relative p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                    {/* Radar Animation */}
                    <div className="absolute top-3 right-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400" />
                    </div>

                    <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-2">
                      📡 Broadcasting on LAN
                    </div>
                    <div className="text-sm font-mono text-emerald-200 font-medium mb-2">
                      {activeShare?.rangeName || selectedRangeName}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">{connectionUrl}</span>
                      <button
                        onClick={() => copyToClipboard(connectionUrl)}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                        title="Copy URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
                    </div>

                    <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-slate-400">
                      <span>{activeShare?.isPasswordProtected ? '🔒 Password Protected' : '🔓 Open Access'}</span>
                      <span>•</span>
                      <span>{activeShare?.accessMode === 'ReadOnly' ? '👁️ ReadOnly' : '✏️ ReadWrite'}</span>
                      <span>•</span>
                      <span><Users className="w-3 h-3 inline" /> {activeShare?.connectedPeers || 0} peers</span>
                    </div>
                  </div>

                  {/* Connected Peers */}
                  {activeShare && activeShare.peers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Connected Peers</div>
                      {activeShare.peers.map((peer) => (
                        <div key={peer.connectionId} className="flex items-center gap-2 px-3 py-2 rounded bg-slate-800/50 border border-slate-700/40 text-xs font-mono">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-slate-200">{peer.peerName}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{peer.ipAddress}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-500">{osIcon(peer.osPlatform)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleStopShare}
                    className="w-full py-2 text-xs font-mono rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition"
                  >
                    ⏹ Stop Sharing
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'discover' && (
            <div className="space-y-4">
              {/* Radar Scanner Animation */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-1 rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                  <Wifi className="w-4 h-4 text-cyan-400 relative z-10" />
                </div>
                <div>
                  <div className="text-xs font-mono text-cyan-300">Scanning local network...</div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Listening on UDP port 5238 • Auto-refresh every 3s
                  </div>
                </div>
              </div>

              {/* Discovered Ranges */}
              {discoveredRanges.length === 0 ? (
                <div className="text-center py-8">
                  <WifiOff className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-mono text-slate-500">No nearby BULLET instances detected</p>
                  <p className="text-[10px] font-mono text-slate-600 mt-1">Make sure another device is sharing on the same WiFi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {discoveredRanges.map((range) => {
                    const status = joinStatus[range.rangeId];
                    return (
                      <div key={`${range.rangeId}-${range.hostIp}`} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{osIcon(range.osPlatform)}</span>
                            <div>
                              <div className="text-xs font-mono text-slate-200 font-medium">{range.rangeName}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {range.machineName} • {range.hostIp}:{range.hostPort}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {range.isPasswordProtected && <Lock className="w-3 h-3 text-amber-400" />}
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              range.accessMode === 'ReadOnly'
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            }`}>
                              {range.accessMode}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              <Users className="w-3 h-3 inline" /> {range.activePeers}
                            </span>
                          </div>
                        </div>

                        {range.isPasswordProtected && !status?.ticket && (
                          <input
                            type="password"
                            value={joinPasswords[range.rangeId] || ''}
                            onChange={(e) => setJoinPasswords(prev => ({ ...prev, [range.rangeId]: e.target.value }))}
                            placeholder="Enter password to join..."
                            className="w-full px-2.5 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                          />
                        )}

                        {status?.error && (
                          <div className="text-[10px] font-mono text-red-400 p-1.5 rounded bg-red-500/10 border border-red-500/20">
                            {status.error}
                          </div>
                        )}

                        {status?.ticket ? (
                          <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            Connected • Ticket acquired
                          </div>
                        ) : (
                          <button
                            onClick={() => handleJoin(range.rangeId)}
                            disabled={status?.loading}
                            className="w-full py-1.5 text-xs font-mono rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 disabled:opacity-40 transition"
                          >
                            {status?.loading ? '⏳ Connecting...' : '🔗 Join Workspace'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Direct IP Fallback */}
              <div className="mt-4 pt-4 border-t border-slate-700/40">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">Direct IP Connection</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={directIp}
                    onChange={(e) => setDirectIp(e.target.value)}
                    placeholder="e.g. 192.168.1.42:5230"
                    className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                  <button className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition">
                    Connect
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-700/40 bg-slate-900/50">
          <div className="text-[9px] font-mono text-slate-500">
            {meshStatus?.osPlatform} • {primaryIp} • UDP 5238 / HTTP {meshStatus?.port || 5230}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
            <div className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {isBroadcasting ? 'Broadcasting' : 'Idle'}
          </div>
        </div>
      </div>
    </div>
  );
};
