import React, { useState } from 'react';
import { 
  X, Play, CheckCircle2, XCircle, Clock, Download, 
  FileCode, Layers, Sliders, AlertTriangle 
} from 'lucide-react';
import { Arsenal, Squad, Loadout, TLSProfile, FiringRun } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface FiringRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  rangeId: string;
  arsenals: Arsenal[];
  loadouts: Loadout[];
  tlsProfiles: TLSProfile[];
  initialArsenalId?: string;
}

export const FiringRunModal: React.FC<FiringRunModalProps> = ({
  isOpen,
  onClose,
  rangeId,
  arsenals,
  loadouts,
  tlsProfiles,
  initialArsenalId,
}) => {
  const [selectedArsenalId, setSelectedArsenalId] = useState<string>(
    initialArsenalId || arsenals[0]?.id || ''
  );
  const [selectedSquadId, setSelectedSquadId] = useState<string>('');
  const [selectedLoadoutId, setSelectedLoadoutId] = useState<string>(loadouts[0]?.id || '');
  const [selectedTlsId, setSelectedTlsId] = useState<string>('');
  const [iterations, setIterations] = useState<number>(1);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [stopOnError, setStopOnError] = useState<boolean>(false);
  const [dataFileContent, setDataFileContent] = useState<string>('');

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentRun, setCurrentRun] = useState<FiringRun | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const validArsenal = initialArsenalId && arsenals.some((a) => a.id === initialArsenalId)
        ? initialArsenalId
        : (arsenals[0]?.id || '');
      setSelectedArsenalId(validArsenal);
      setSelectedSquadId('');
      if (loadouts.length > 0 && (!selectedLoadoutId || !loadouts.some((l) => l.id === selectedLoadoutId))) {
        setSelectedLoadoutId(loadouts[0].id);
      }
    }
  }, [isOpen, initialArsenalId, arsenals, loadouts]);

  if (!isOpen) return null;

  const effectiveArsenalId = selectedArsenalId || initialArsenalId || arsenals[0]?.id || '';
  const currentArsenal = arsenals.find((a) => a.id === effectiveArsenalId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setDataFileContent(text);
    };
    reader.readAsText(file);
  };

  const handleStartRun = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    setCurrentRun(null);

    try {
      let dataRows: Array<Record<string, string>> | undefined = undefined;
      if (dataFileContent.trim()) {
        try {
          dataRows = JSON.parse(dataFileContent);
        } catch {
          // Parse CSV
          const lines = dataFileContent.split('\n').filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            const headers = lines[0].split(',').map((h) => h.trim());
            dataRows = lines.slice(1).map((line) => {
              const vals = line.split(',').map((v) => v.trim());
              const row: Record<string, string> = {};
              headers.forEach((h, i) => {
                row[h] = vals[i] || '';
              });
              return row;
            });
          }
        }
      }

      const run = await bulletApi.startFiringRun({
        rangeId,
        name: `Run: ${currentArsenal?.name || 'Arsenal'}`,
        arsenalId: selectedSquadId ? undefined : effectiveArsenalId,
        squadId: selectedSquadId || undefined,
        loadoutId: selectedLoadoutId || undefined,
        tlsProfileId: selectedTlsId || undefined,
        iterations: iterations,
        delayMs: delayMs,
        stopOnError: stopOnError,
        dataRows: dataRows,
      });

      setCurrentRun(run);
    } catch (err: any) {
      setErrorMsg(err.message || 'Firing Run failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Play className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="font-mono text-sm font-bold text-slate-100">Firing Run Engine</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
              Automated Runner
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded flex items-center gap-2 text-rose-300 font-mono text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!currentRun ? (
            /* Setup View */
            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                {/* Arsenal Selector */}
                <div>
                  <label className="text-slate-400 block mb-1">Target Arsenal</label>
                  <select
                    value={selectedArsenalId}
                    onChange={(e) => {
                      setSelectedArsenalId(e.target.value);
                      setSelectedSquadId('');
                    }}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    {arsenals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.shots?.length || 0} direct shots)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Squad Selector */}
                <div>
                  <label className="text-slate-400 block mb-1">Target Squad (Optional)</label>
                  <select
                    data-testid="target-squad-select"
                    value={selectedSquadId}
                    onChange={(e) => setSelectedSquadId(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    <option value="">Entire Arsenal (All Squads & Shots)</option>
                    {currentArsenal?.squads?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.shots?.length || 0} shots)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loadout Selector */}
                <div>
                  <label className="text-slate-400 block mb-1">Execution Loadout</label>
                  <select
                    value={selectedLoadoutId}
                    onChange={(e) => setSelectedLoadoutId(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    <option value="">No Loadout</option>
                    {loadouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.isProduction ? '⚡ [PROD]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TLS Profile Selector */}
                <div>
                  <label className="text-slate-400 block mb-1">Bulletproof TLS Profile</label>
                  <select
                    value={selectedTlsId}
                    onChange={(e) => setSelectedTlsId(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    <option value="">Default System TLS</option>
                    {tlsProfiles.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Iterations */}
                <div>
                  <label className="text-slate-400 block mb-1">Iterations</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={iterations}
                    onChange={(e) => setIterations(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  />
                </div>

                {/* Delay */}
                <div>
                  <label className="text-slate-400 block mb-1">Delay Between Shots (ms)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={delayMs}
                    onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={stopOnError}
                    onChange={(e) => setStopOnError(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500"
                  />
                  <span>Stop on first test verification failure or HTTP error</span>
                </label>
              </div>

              {/* Data File Upload (Data-driven testing) */}
              <div className="p-3 bg-bullet-surface border border-bullet-border rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Data-Driven Testing (Optional)</span>
                  <label className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 cursor-pointer text-[11px]">
                    Select CSV / JSON file
                    <input type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Upload a CSV or JSON array where keys match <code className="text-amber-400">{'{{round}}'}</code> variables. Each row runs as a separate iteration.
                </p>
                {dataFileContent && (
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 p-2 rounded truncate">
                    Loaded {dataFileContent.length} bytes of test data.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Results View */
            <div className="space-y-4 font-mono text-xs">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-bullet-surface border border-bullet-border rounded">
                  <div className="text-slate-400 text-[10px] uppercase">Total Shots</div>
                  <div className="text-base font-bold text-slate-100">{currentRun.totalShots}</div>
                </div>
                <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/40 rounded">
                  <div className="text-emerald-400 text-[10px] uppercase">Passed</div>
                  <div className="text-base font-bold text-emerald-400">{currentRun.passedShots}</div>
                </div>
                <div className="p-2.5 bg-rose-950/20 border border-rose-500/40 rounded">
                  <div className="text-rose-400 text-[10px] uppercase">Failed</div>
                  <div className="text-base font-bold text-rose-400">{currentRun.failedShots}</div>
                </div>
                <div className="p-2.5 bg-bullet-surface border border-bullet-border rounded">
                  <div className="text-slate-400 text-[10px] uppercase">Duration</div>
                  <div className="text-base font-bold text-amber-400">{(currentRun.durationMs / 1000).toFixed(2)}s</div>
                </div>
              </div>

              {/* Results Table */}
              <div className="border border-bullet-border rounded overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400 font-mono">
                      <th className="w-10 px-2 py-1.5 text-center">Result</th>
                      <th className="px-3 py-1.5 font-normal">Method</th>
                      <th className="px-3 py-1.5 font-normal">Shot Name / URL</th>
                      <th className="px-3 py-1.5 font-normal">Status</th>
                      <th className="px-3 py-1.5 font-normal">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRun.results.map((r, idx) => (
                      <tr key={idx} className="border-b border-bullet-border/30 hover:bg-bullet-surface/50 font-mono">
                        <td className="px-2 py-1.5 text-center">
                          {r.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 inline" />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-amber-400 font-bold">{r.method}</td>
                        <td className="px-3 py-1.5">
                          <div className="text-slate-200 font-medium truncate">{r.shotName}</div>
                          <div className="text-[10px] text-slate-500 truncate">{r.url}</div>
                          {r.errorMessage && (
                            <div className="text-[10px] text-rose-400 mt-0.5">{r.errorMessage}</div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-300">{r.statusCode}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.durationMs.toFixed(0)}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Export Links */}
              <div className="flex items-center gap-2 pt-2">
                <a
                  href={bulletApi.getJunitXmlUrl(currentRun.id)}
                  download={`firing-run-${currentRun.id}.xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JUnit XML (CI/CD)</span>
                </a>

                <button
                  onClick={() => setCurrentRun(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs"
                >
                  Configure New Run
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-bullet-border bg-bullet-bg flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-xs border border-slate-700"
          >
            Close
          </button>

          {!currentRun && (
            <button
              data-testid="start-firing-run-btn"
              onClick={handleStartRun}
              disabled={isRunning || !effectiveArsenalId}
              className="flex items-center gap-2 px-5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs transition shadow-md shadow-amber-500/10"
            >
              {isRunning ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>EXECUTING RUN...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START FIRING RUN</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
