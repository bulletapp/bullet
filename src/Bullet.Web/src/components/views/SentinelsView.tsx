import React, { useState, useEffect } from 'react';
import { Activity, Plus, Trash2, Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Sentinel, Arsenal, Loadout } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface SentinelsViewProps {
  rangeId: string;
  arsenals: Arsenal[];
  loadouts: Loadout[];
}

export const SentinelsView: React.FC<SentinelsViewProps> = ({ rangeId, arsenals, loadouts }) => {
  const [sentinels, setSentinels] = useState<Sentinel[]>([]);
  const [name, setName] = useState('');
  const [cron, setCron] = useState('*/15 * * * *');
  const [selectedArsenalId, setSelectedArsenalId] = useState(arsenals[0]?.id || '');
  const [selectedLoadoutId, setSelectedLoadoutId] = useState(loadouts[0]?.id || '');
  const [isRunning, setIsRunning] = useState<Record<string, boolean>>({});

  const fetchSentinels = async () => {
    try {
      const list = await bulletApi.getSentinels(rangeId);
      setSentinels(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSentinels();
  }, [rangeId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await bulletApi.createSentinel({
        rangeId,
        name,
        cronSchedule: cron,
        arsenalId: selectedArsenalId || undefined,
        loadoutId: selectedLoadoutId || undefined,
        enabled: true,
      });
      setName('');
      fetchSentinels();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRunNow = async (id: string) => {
    setIsRunning((prev) => ({ ...prev, [id]: true }));
    try {
      await bulletApi.runSentinel(id);
      await fetchSentinels();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRunning((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this Sentinel monitor?')) return;
    try {
      await bulletApi.deleteSentinel(id);
      fetchSentinels();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm text-slate-100">Sentinels</span>
          <span className="text-[10px] text-slate-500 uppercase">Automated Health Monitors</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Create Sentinel Form */}
        <form onSubmit={handleCreate} className="p-3 bg-bullet-surface border border-bullet-border rounded space-y-3 max-w-2xl">
          <span className="font-bold text-slate-200 uppercase text-[11px] block">
            Deploy New Sentinel (Scheduled API Monitor)
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Sentinel Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Production API Heartbeat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Cron Schedule</label>
              <input
                type="text"
                required
                placeholder="*/15 * * * *"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                className="w-full p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Target Arsenal</label>
              <select
                value={selectedArsenalId}
                onChange={(e) => setSelectedArsenalId(e.target.value)}
                className="w-full p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none"
              >
                {arsenals.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Target Loadout</label>
              <select
                value={selectedLoadoutId}
                onChange={(e) => setSelectedLoadoutId(e.target.value)}
                className="w-full p-2 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none"
              >
                {loadouts.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold"
          >
            Deploy Sentinel
          </button>
        </form>

        {/* Sentinel List */}
        <div className="border border-bullet-border rounded overflow-hidden max-w-3xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400">
                <th className="px-3 py-2 w-28">Status</th>
                <th className="px-3 py-2">Sentinel Name</th>
                <th className="px-3 py-2 w-32">Schedule</th>
                <th className="px-3 py-2 w-36">Last Run</th>
                <th className="px-3 py-2 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sentinels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No active Sentinels deployed. Deploy a sentinel above for automated monitoring.
                  </td>
                </tr>
              ) : (
                sentinels.map((s) => (
                  <tr key={s.id} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50">
                    <td className="px-3 py-2">
                      {s.lastRunPassed === undefined ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          PENDING
                        </span>
                      ) : s.lastRunPassed ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          HEALTHY
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit font-bold">
                          <XCircle className="w-2.5 h-2.5" />
                          FAILING
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-200 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-amber-400">{s.cronSchedule}</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">
                      {s.lastRunUtc ? new Date(s.lastRunUtc).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRunNow(s.id)}
                          disabled={isRunning[s.id]}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]"
                          title="Run Sentinel Check Now"
                        >
                          <Play className="w-2.5 h-2.5 inline mr-1 fill-current" />
                          {isRunning[s.id] ? 'Running...' : 'Run'}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="Delete Sentinel"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
