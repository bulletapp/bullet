import React, { useState } from 'react';
import { Terminal, Trash2, X, Filter } from 'lucide-react';
import { TrajectoryLogEntry } from '../types/bullet';

interface TrajectoryConsoleProps {
  logs: TrajectoryLogEntry[];
  onClear: () => void;
  onClose: () => void;
}

export const TrajectoryConsole: React.FC<TrajectoryConsoleProps> = ({ logs, onClear, onClose }) => {
  const [filter, setFilter] = useState<string>('all');

  const getCategory = (log: TrajectoryLogEntry) => log.category || (log as any).step || 'Info';

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return getCategory(log).toLowerCase() === filter.toLowerCase();
  });

  const getCategoryBadge = (category?: string) => {
    const cat = (category || 'info').toLowerCase();
    if (cat === 'trigger') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (cat === 'request') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (cat === 'tls') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (cat === 'verifier') return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (cat === 'impact') return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  };

  return (
    <div
      data-testid="trajectory-console-dock"
      className="h-48 border-t border-bullet-border bg-bullet-bg flex flex-col select-none flex-shrink-0 z-30 font-mono text-xs"
    >
      {/* Console Header */}
      <div className="h-8 px-3 border-b border-bullet-border bg-bullet-panel flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-[11px] uppercase tracking-wider">Trajectory Console</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-[10px]">
            {['all', 'trigger', 'request', 'tls', 'verifier'].map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-1.5 py-0.5 rounded uppercase border transition ${
                  filter === c
                    ? 'bg-slate-700 text-slate-100 border-slate-600'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Console Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800"
            title="Clear Console"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
            title="Close Console (Ctrl+J)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Output List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1 font-mono text-[11px] select-text">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 text-center py-4">
            No trajectory telemetry recorded yet. Fire a shot to view execution logs.
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 hover:bg-bullet-surface/30 px-1 rounded">
              <span className="text-slate-600 text-[10px] flex-shrink-0">
                {new Date(log.timestampUtc).toLocaleTimeString()}
              </span>
              <span className={`px-1 py-0.2 rounded border text-[9px] uppercase font-bold flex-shrink-0 ${getCategoryBadge(getCategory(log))}`}>
                {getCategory(log)}
              </span>
              <span className="text-slate-300 flex-1 break-all">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
