import React, { useState, useEffect } from 'react';
import { 
  Range, Arsenal, Squad, Shot, Loadout, TLSProfile, 
  Impact, TrajectoryLogEntry 
} from './types/bullet';
import { bulletApi, createExecutionHubConnection } from './api/bulletApi';

// Components
import { Header } from './components/Header';
import { Sidebar, ActiveSidebarTab } from './components/Sidebar';
import { UrlBar } from './components/UrlBar';
import { ShotEditor } from './components/ShotEditor';
import { ImpactViewer } from './components/ImpactViewer';
import { TrajectoryConsole } from './components/TrajectoryConsole';

// Modals
import { CommandPaletteModal } from './components/modals/CommandPaletteModal';
import { FiringRunModal } from './components/modals/FiringRunModal';
import { ArmoryTransferModal } from './components/modals/ArmoryTransferModal';
import { CodeShotModal } from './components/modals/CodeShotModal';
import { NewRangeModal } from './components/modals/NewRangeModal';
import { NewArsenalModal } from './components/modals/NewArsenalModal';
import { NewSquadModal } from './components/modals/NewSquadModal';
import { NewShotModal } from './components/modals/NewShotModal';

// Dedicated Views
import { LoadoutsView } from './components/views/LoadoutsView';
import { ShotLogView } from './components/views/ShotLogView';
import { TargetRangeView } from './components/views/TargetRangeView';
import { BulletproofTlsView } from './components/views/BulletproofTlsView';
import { SentinelsView } from './components/views/SentinelsView';
import { CookieLockerView } from './components/views/CookieLockerView';
import { FieldManualView } from './components/views/FieldManualView';

export function App() {
  // Global State
  const [ranges, setRanges] = useState<Range[]>([]);
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const [arsenals, setArsenals] = useState<Arsenal[]>([]);
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [selectedLoadout, setSelectedLoadout] = useState<Loadout | null>(null);
  const [tlsProfiles, setTlsProfiles] = useState<TLSProfile[]>([]);

  // Navigation & View State
  const [activeSidebarTab, setActiveSidebarTab] = useState<ActiveSidebarTab>('arsenals');
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);

  // Execution & Telemetry State
  const [impact, setImpact] = useState<Impact | null>(null);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [consoleOpen, setConsoleOpen] = useState<boolean>(false);
  const [trajectoryLogs, setTrajectoryLogs] = useState<TrajectoryLogEntry[]>([]);

  // Modals
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [firingRunOpen, setFiringRunOpen] = useState(false);
  const [armoryTransferOpen, setArmoryTransferOpen] = useState(false);
  const [codeShotOpen, setCodeShotOpen] = useState(false);
  const [newRangeOpen, setNewRangeOpen] = useState(false);
  const [newArsenalOpen, setNewArsenalOpen] = useState(false);
  const [newSquadOpen, setNewSquadOpen] = useState(false);
  const [targetArsenalForSquad, setTargetArsenalForSquad] = useState<string>('');
  const [newShotOpen, setNewShotOpen] = useState(false);
  const [newShotTarget, setNewShotTarget] = useState<{ arsenalId?: string; squadId?: string }>({});

  // 1. Fetch Ranges on Mount
  useEffect(() => {
    loadRanges();
  }, []);

  const loadRanges = async () => {
    try {
      const data = await bulletApi.getRanges();
      setRanges(data);
      if (data.length > 0 && !selectedRange) {
        setSelectedRange(data[0]);
      }
    } catch (err) {
      console.error('Failed to load ranges', err);
    }
  };

  // 2. Fetch Range Children when active Range changes
  useEffect(() => {
    if (selectedRange) {
      loadRangeData(selectedRange.id);
    }
  }, [selectedRange]);

  const loadRangeData = async (rangeId: string) => {
    try {
      const [ars, loads, tls] = await Promise.all([
        bulletApi.getArsenals(rangeId),
        bulletApi.getLoadouts(rangeId),
        bulletApi.getTlsProfiles(rangeId),
      ]);

      setArsenals(ars);
      setLoadouts(loads);
      setTlsProfiles(tls);

      // Select default loadout if none selected
      if (loads.length > 0 && !selectedLoadout) {
        setSelectedLoadout(loads[0]);
      }

      // Select first available shot if none selected
      if (!selectedShot && ars.length > 0) {
        const firstShot = ars[0].shots?.[0] || ars[0].squads?.[0]?.shots?.[0];
        if (firstShot) setSelectedShot(firstShot);
      }
    } catch (err) {
      console.error('Failed to load range details', err);
    }
  };

  // 3. Connect to SignalR ExecutionHub for Real-Time Telemetry
  useEffect(() => {
    const hubConnection = createExecutionHubConnection();

    hubConnection.on('ExecutionTelemetry', (log: TrajectoryLogEntry) => {
      setTrajectoryLogs((prev) => [...prev, log]);
    });

    hubConnection.start().catch((err) => console.warn('SignalR execution hub offline:', err));

    return () => {
      hubConnection.stop();
    };
  }, []);

  // 4. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Fire Shot: Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleFireShot();
      }
      // Save Shot: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveShot();
      }
      // Toggle Trajectory Console: Ctrl+J or Cmd+J
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setConsoleOpen((prev) => !prev);
      }
      // Command Palette: Ctrl+Shift+P or Ctrl+K / Cmd+K
      if (((e.ctrlKey || e.metaKey) && e.key === 'k') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShot, selectedLoadout]);

  // Actions
  const handleFireShot = async (shotOverride?: Shot) => {
    const targetShot = shotOverride || selectedShot;
    if (!targetShot) return;
    setIsFiring(true);
    setImpact(null);

    // Append trigger log
    const startTime = new Date().toISOString();
    setTrajectoryLogs((prev) => [
      ...prev,
      {
        category: 'Trigger',
        message: `Dispatching shot '${targetShot.name}' [${targetShot.method} ${targetShot.url}]`,
        timestampUtc: startTime,
        level: 'Information',
      },
    ]);

    try {
      const globalSslDisabled = localStorage.getItem('bullet_verify_ssl') === 'false';
      const effectiveVerifySsl = globalSslDisabled 
        ? false 
        : ((targetShot.settings?.verifySsl ?? targetShot.settings?.verifyTls) ?? true);

      const effectiveSettings = {
        ...targetShot.settings,
        verifySsl: effectiveVerifySsl,
        verifyTls: effectiveVerifySsl,
      };

      const targetShotId = targetShot.id || (targetShot as any).Id;
      const res = await bulletApi.fireShot(targetShotId, {
        loadoutId: selectedLoadout?.id,
        method: targetShot.method,
        url: targetShot.url,
        parameters: targetShot.parameters,
        headers: targetShot.headers,
        payload: targetShot.payload,
        armor: targetShot.armor,
        settings: effectiveSettings,
        triggerScript: targetShot.triggerScript,
        verifierScript: targetShot.verifierScript,
      });
      setImpact(res);

      // Append impact telemetry
      if (res.trajectoryLogs) {
        setTrajectoryLogs((prev) => [...prev, ...res.trajectoryLogs]);
      }

      setTrajectoryLogs((prev) => [
        ...prev,
        {
          category: 'Impact',
          message: `Impact received: ${res.statusCode} ${res.statusText} (${res.durationMs.toFixed(0)}ms, ${res.responseSizeBytes ?? res.sizeBytes ?? 0} bytes)`,
          timestampUtc: new Date().toISOString(),
          level: res.isSuccess ? 'Information' : 'Warning',
        },
      ]);
    } catch (err: any) {
      const errMsg = err.message || 'Execution failed due to network or connection error.';
      const isSsl = errMsg.toLowerCase().includes('ssl') || 
                    errMsg.toLowerCase().includes('certificate') ||
                    errMsg.toLowerCase().includes('tls');

      const fallbackImpact: Impact = {
        shotId: targetShot.id,
        shotName: targetShot.name,
        method: targetShot.method,
        resolvedUrl: targetShot.url,
        statusCode: 0,
        statusText: isSsl ? 'SSL Error' : 'Could not get response',
        isSuccess: false,
        durationMs: 0,
        sizeBytes: 0,
        responseHeaders: {},
        requestHeadersSent: {},
        cookies: [],
        timing: {
          dnsLookupMs: 0,
          tcpConnectionMs: 0,
          tlsHandshakeMs: 0,
          ttfbMs: 0,
          contentDownloadMs: 0,
          totalMs: 0,
        },
        trajectoryLogs: [],
        verifications: [],
        exportedRounds: {},
        errorMessage: errMsg,
        tlsDiagnostics: {
          handshakeSuccessful: false,
          potentialIssues: isSsl ? ['SSL/TLS certificate rejected: validation procedure failed.'] : [errMsg],
          recommendation: isSsl 
            ? 'Disable SSL certificate verification in Shot Settings to allow self-signed or development certificates.' 
            : 'Check server availability and target URL.'
        }
      };

      setImpact(fallbackImpact);

      setTrajectoryLogs((prev) => [
        ...prev,
        {
          category: 'Impact',
          message: `Execution failed: ${errMsg}`,
          timestampUtc: new Date().toISOString(),
          level: 'Error',
        },
      ]);
    } finally {
      setIsFiring(false);
    }
  };

  const handleDisableSslAndRetry = async () => {
    if (!selectedShot) return;
    const updatedShot: Shot = {
      ...selectedShot,
      settings: {
        ...selectedShot.settings,
        verifySsl: false,
        verifyTls: false,
      },
    };
    setSelectedShot(updatedShot);

    try {
      await bulletApi.updateShot(updatedShot.id, {
        settings: updatedShot.settings,
      });
    } catch {}

    handleFireShot(updatedShot);
  };

  const handleSaveShot = async () => {
    if (!selectedShot) return;
    try {
      const updated = await bulletApi.updateShot(selectedShot.id, selectedShot);
      setSelectedShot(updated);
      if (selectedRange) loadRangeData(selectedRange.id);
    } catch (err: any) {
      alert(err.message || 'Failed to save shot');
    }
  };

  const handleDeleteArsenal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Arsenal?')) return;
    try {
      await bulletApi.deleteArsenal(id);
      if (selectedRange) loadRangeData(selectedRange.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteSquad = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Squad?')) return;
    try {
      await bulletApi.deleteSquad(id);
      if (selectedRange) loadRangeData(selectedRange.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteShot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Shot?')) return;
    try {
      await bulletApi.deleteShot(id);
      if (selectedShot?.id === id) setSelectedShot(null);
      if (selectedRange) loadRangeData(selectedRange.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-bullet-bg text-slate-100 overflow-hidden select-none">
      {/* 1. Header Bar */}
      <Header
        ranges={ranges}
        selectedRange={selectedRange}
        onSelectRange={setSelectedRange}
        onOpenNewRange={() => setNewRangeOpen(true)}
        loadouts={loadouts}
        selectedLoadout={selectedLoadout}
        onSelectLoadout={setSelectedLoadout}
        onOpenNewShot={() => {
          if (arsenals.length > 0) {
            setNewShotTarget({ arsenalId: arsenals[0].id });
            setNewShotOpen(true);
          } else {
            setNewArsenalOpen(true);
          }
        }}
        onOpenFiringRun={() => setFiringRunOpen(true)}
        onOpenArmoryTransfer={() => setArmoryTransferOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        consoleOpen={consoleOpen}
        onToggleConsole={() => setConsoleOpen((prev) => !prev)}
        consoleLogCount={trajectoryLogs.length}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          arsenals={arsenals}
          selectedShotId={selectedShot?.id || null}
          onSelectShot={(shot) => {
            setSelectedShot(shot);
            setActiveSidebarTab('arsenals');
          }}
          onOpenNewArsenal={() => setNewArsenalOpen(true)}
          onOpenNewSquad={(arsenalId) => {
            setTargetArsenalForSquad(arsenalId);
            setNewSquadOpen(true);
          }}
          onOpenNewShot={(arsenalId, squadId) => {
            setNewShotTarget({ arsenalId, squadId });
            setNewShotOpen(true);
          }}
          onDeleteArsenal={handleDeleteArsenal}
          onDeleteSquad={handleDeleteSquad}
          onDeleteShot={handleDeleteShot}
          onRunArsenal={() => setFiringRunOpen(true)}
          onExportArsenal={() => setArmoryTransferOpen(true)}
        />

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeSidebarTab === 'arsenals' && (
            selectedShot ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Request URL Bar */}
                <UrlBar
                  shot={selectedShot}
                  onChange={setSelectedShot}
                  onFire={handleFireShot}
                  onCancel={() => setIsFiring(false)}
                  isFiring={isFiring}
                  onSave={handleSaveShot}
                  onOpenCodeShot={() => setCodeShotOpen(true)}
                  activeLoadout={selectedLoadout}
                />

                {/* Split Request / Response Pane */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Shot Editor (Tabs: Params, Headers, Armor, Payload, Triggers, Verifiers, Settings) */}
                  <div className="w-1/2 border-r border-bullet-border flex flex-col overflow-hidden">
                    <ShotEditor
                      shot={selectedShot}
                      onChange={setSelectedShot}
                    />
                  </div>

                  {/* Right: Impact Viewer (Pretty, Raw, Preview, Headers, Cookies, Timing, Verifications) */}
                  <div className="w-1/2 flex flex-col overflow-hidden">
                    <ImpactViewer
                      impact={impact}
                      isFiring={isFiring}
                      onDisableSslAndRetry={handleDisableSslAndRetry}
                      onRetry={() => handleFireShot()}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs p-8">
                <div>No Shot selected. Select a shot from the Arsenal tree or create a new shot.</div>
                <button
                  onClick={() => {
                    if (arsenals.length > 0) {
                      setNewShotTarget({ arsenalId: arsenals[0].id });
                      setNewShotOpen(true);
                    } else {
                      setNewArsenalOpen(true);
                    }
                  }}
                  className="mt-3 px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold"
                >
                  {arsenals.length > 0 ? '+ Create New Shot' : '+ Create Arsenal'}
                </button>
              </div>
            )
          )}

          {activeSidebarTab === 'loadouts' && selectedRange && (
            <LoadoutsView
              rangeId={selectedRange.id}
              loadouts={loadouts}
              onRefresh={() => loadRangeData(selectedRange.id)}
            />
          )}

          {activeSidebarTab === 'logs' && selectedRange && (
            <ShotLogView rangeId={selectedRange.id} />
          )}

          {activeSidebarTab === 'target-range' && selectedRange && (
            <TargetRangeView rangeId={selectedRange.id} />
          )}

          {activeSidebarTab === 'tls' && selectedRange && (
            <BulletproofTlsView rangeId={selectedRange.id} />
          )}

          {activeSidebarTab === 'sentinels' && selectedRange && (
            <SentinelsView
              rangeId={selectedRange.id}
              arsenals={arsenals}
              loadouts={loadouts}
            />
          )}

          {activeSidebarTab === 'cookies' && (
            <CookieLockerView />
          )}

          {activeSidebarTab === 'manual' && (
            <FieldManualView />
          )}
        </div>
      </div>

      {/* 3. Collapsible Trajectory Console Dock */}
      {consoleOpen && (
        <TrajectoryConsole
          logs={trajectoryLogs}
          onClear={() => setTrajectoryLogs([])}
          onClose={() => setConsoleOpen(false)}
        />
      )}

      {/* 4. Modals */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onFireShot={handleFireShot}
        onOpenNewShot={() => {
          if (arsenals.length > 0) {
            setNewShotTarget({ arsenalId: arsenals[0].id });
            setNewShotOpen(true);
          }
        }}
        onOpenFiringRun={() => setFiringRunOpen(true)}
        onToggleConsole={() => setConsoleOpen((prev) => !prev)}
        onOpenArmoryTransfer={() => setArmoryTransferOpen(true)}
        onOpenManual={() => setActiveSidebarTab('manual')}
        arsenals={arsenals}
        onSelectShot={(shot) => {
          setSelectedShot(shot);
          setActiveSidebarTab('arsenals');
        }}
      />

      {selectedRange && (
        <FiringRunModal
          isOpen={firingRunOpen}
          onClose={() => setFiringRunOpen(false)}
          rangeId={selectedRange.id}
          arsenals={arsenals}
          loadouts={loadouts}
          tlsProfiles={tlsProfiles}
          initialArsenalId={selectedShot?.arsenalId}
        />
      )}

      {selectedRange && (
        <ArmoryTransferModal
          isOpen={armoryTransferOpen}
          onClose={() => setArmoryTransferOpen(false)}
          rangeId={selectedRange.id}
          arsenals={arsenals}
          onImportSuccess={() => loadRangeData(selectedRange.id)}
        />
      )}

      <CodeShotModal
        isOpen={codeShotOpen}
        onClose={() => setCodeShotOpen(false)}
        shot={selectedShot}
      />

      <NewRangeModal
        isOpen={newRangeOpen}
        onClose={() => setNewRangeOpen(false)}
        onCreated={(range) => {
          setRanges((prev) => [...prev, range]);
          setSelectedRange(range);
        }}
      />

      {selectedRange && (
        <NewArsenalModal
          isOpen={newArsenalOpen}
          onClose={() => setNewArsenalOpen(false)}
          rangeId={selectedRange.id}
          onCreated={(arsenal) => {
            setArsenals((prev) => [...prev, arsenal]);
          }}
        />
      )}

      {targetArsenalForSquad && (
        <NewSquadModal
          isOpen={newSquadOpen}
          onClose={() => setNewSquadOpen(false)}
          arsenalId={targetArsenalForSquad}
          onCreated={() => {
            if (selectedRange) loadRangeData(selectedRange.id);
          }}
        />
      )}

      {selectedRange && (
        <NewShotModal
          isOpen={newShotOpen}
          onClose={() => setNewShotOpen(false)}
          arsenals={arsenals}
          defaultArsenalId={newShotTarget.arsenalId}
          defaultSquadId={newShotTarget.squadId}
          onCreated={(rawShot) => {
            const shot: Shot = {
              ...rawShot,
              id: rawShot.id || (rawShot as any).Id,
              arsenalId: rawShot.arsenalId || (rawShot as any).ArsenalId,
              squadId: rawShot.squadId || (rawShot as any).SquadId,
              name: rawShot.name || (rawShot as any).Name,
              method: rawShot.method || (rawShot as any).Method,
              url: rawShot.url || (rawShot as any).Url,
              settings: rawShot.settings || (rawShot as any).Settings,
              parameters: rawShot.parameters || (rawShot as any).Parameters || [],
              headers: rawShot.headers || (rawShot as any).Headers || [],
              payload: rawShot.payload || (rawShot as any).Payload || { type: 'none' },
              armor: rawShot.armor || (rawShot as any).Armor || { type: 'inherit' },
            };
            setSelectedShot(shot);
            setArsenals((prev) =>
              prev.map((a) => {
                if (a.id === shot.arsenalId) {
                  if (shot.squadId) {
                    return {
                      ...a,
                      squads: a.squads?.map((sq) =>
                        sq.id === shot.squadId
                          ? { ...sq, shots: [...(sq.shots || []), shot] }
                          : sq
                      ),
                    };
                  }
                  return { ...a, shots: [...(a.shots || []), shot] };
                }
                return a;
              })
            );
            setActiveSidebarTab('arsenals');
          }}
        />
      )}
    </div>
  );
}

export default App;
