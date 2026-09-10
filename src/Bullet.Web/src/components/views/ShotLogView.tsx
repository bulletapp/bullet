import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { ShotLog } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface ShotLogViewProps {
  rangeId: string;
}

export const ShotLogView: React.FC<ShotLogViewProps> = ({ rangeId }) => {
  const [logs, setLogs] = useState<ShotLog[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await bulletApi.getShotLogs(rangeId, 100);
      setLogs(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [rangeId]);

  const handleClear = async () => {
    if (!confirm('Clear all execution shot logs for this range?')) return;
    try {
      await bulletApi.clearShotLogs(rangeId);
      setLogs([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.shotName.toLowerCase().includes(filter.toLowerCase()) ||
      l.url.toLowerCase().includes(filter.toLowerCase()) ||
      l.method.toLowerCase().includes(filter.toLowerCase()) ||
      l.statusCode.toString().includes(filter)
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm text-slate-100">Shot Log</span>
          <span className="text-[10px] text-slate-500 uppercase">Execution History</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-bullet-surface border border-bullet-border rounded pl-7 pr-2 py-1 text-xs text-slate-200 outline-none w-48 focus:border-amber-500"
            />
          </div>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="border border-bullet-border rounded overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400">
                <th className="px-3 py-2 w-24">Status</th>
                <th className="px-3 py-2 w-20">Method</th>
                <th className="px-3 py-2 w-1/4">Shot Name</th>
                <th className="px-3 py-2">Resolved URL</th>
                <th className="px-3 py-2 w-24">Duration</th>
                <th className="px-3 py-2 w-36">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No execution logs found. Fire a shot to record history.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const is2xx = log.statusCode >= 200 && log.statusCode < 300;
                  return (
                    <tr key={log.id} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50">
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                          is2xx
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-amber-400">{log.method}</td>
                      <td className="px-3 py-2 text-slate-200 font-medium truncate">{log.shotName}</td>
                      <td className="px-3 py-2 text-slate-400 truncate select-text">{log.url}</td>
                      <td className="px-3 py-2 text-slate-400">{log.durationMs.toFixed(0)} ms</td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">
                        {new Date(log.executedAtUtc).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
