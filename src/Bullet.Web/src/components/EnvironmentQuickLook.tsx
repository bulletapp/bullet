import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Search, Plus, ExternalLink, ShieldAlert, Key } from 'lucide-react';
import { Loadout, Round } from '../types/bullet';
import { bulletApi } from '../api/bulletApi';

interface EnvironmentQuickLookProps {
  activeLoadout: Loadout | null;
  onOpenLoadouts: () => void;
  onRefreshLoadouts?: () => void;
}

export const EnvironmentQuickLook: React.FC<EnvironmentQuickLookProps> = ({
  activeLoadout,
  onOpenLoadouts,
  onRefreshLoadouts,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [localRounds, setLocalRounds] = useState<Round[]>(activeLoadout?.rounds || []);

  useEffect(() => {
    setLocalRounds(activeLoadout?.rounds || []);
  }, [activeLoadout]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const rounds = localRounds;
  const filteredRounds = rounds.filter((r) => {
    const q = search.toLowerCase();
    const key = (r.key || r.name || '').toLowerCase();
    const val = (r.value || '').toLowerCase();
    return key.includes(q) || val.includes(q);
  });

  const toggleSecret = (roundId: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [roundId]: !prev[roundId],
    }));
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoadout || !newKey.trim()) return;
    setIsAdding(true);
    try {
      const created = await bulletApi.addRound(activeLoadout.id, {
        key: newKey.trim(),
        name: newKey.trim(),
        value: newValue,
        isSecret: newIsSecret,
      });
      if (created) {
        setLocalRounds((prev) => [...prev.filter((r) => r.id !== created.id), created]);
      }
      setNewKey('');
      setNewValue('');
      setNewIsSecret(false);
      if (onRefreshLoadouts) {
        onRefreshLoadouts();
      }
    } catch (err) {
      console.error('Failed to add round variable', err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Eye Trigger Button */}
      <button
        data-testid="env-quick-look-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-md text-xs border transition ${
          isOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950'
            : 'bg-bullet-surface hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-bullet-border'
        }`}
        title="Environment Quick Look (Active Variables)"
      >
        <Eye className="w-3.5 h-3.5 text-amber-400" />
        {rounds.length > 0 && (
          <span
            data-testid="env-var-count-badge"
            className="text-[10px] font-mono px-1 rounded bg-slate-800 text-amber-300"
          >
            {rounds.length}
          </span>
        )}
      </button>

      {/* Floating Popover Panel */}
      {isOpen && (
        <div
          data-testid="env-quick-look-popover"
          className="absolute left-0 mt-2 w-96 bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl p-3 z-50 text-xs font-mono text-slate-200 flex flex-col gap-2.5 max-h-[480px] overflow-hidden"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-bullet-border">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold text-slate-100">
                {activeLoadout ? activeLoadout.name : 'No Active Loadout'}
              </span>
              {activeLoadout?.isProduction && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                  PROD
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenLoadouts();
              }}
              className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
            >
              <span>Manage</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              data-testid="env-quick-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variables..."
              className="w-full pl-8 pr-2 py-1 bg-bullet-bg border border-bullet-border rounded text-slate-200 text-xs outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Variables Table */}
          <div className="flex-1 overflow-y-auto max-h-52 border border-bullet-border/60 rounded bg-bullet-bg/40">
            {filteredRounds.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-[11px]">
                {activeLoadout
                  ? search
                    ? 'No variables match search.'
                    : 'No variables defined in this Loadout.'
                  : 'Select a Loadout above to view active environment variables.'}
              </div>
            ) : (
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-bullet-border bg-bullet-surface/30 text-slate-400">
                    <th className="px-2 py-1 font-semibold">Variable</th>
                    <th className="px-2 py-1 font-semibold">Value</th>
                    <th className="w-8 px-1 py-1 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRounds.map((round) => {
                    const key = round.key || round.name || '';
                    const isRevealed = revealedSecrets[round.id];
                    const displayValue = round.isSecret
                      ? isRevealed
                        ? round.value
                        : '••••••••••••'
                      : round.value;

                    return (
                      <tr
                        key={round.id}
                        data-testid={`env-row-${key}`}
                        className="border-b border-bullet-border/30 hover:bg-bullet-surface/40 transition"
                      >
                        <td className="px-2 py-1 text-amber-400 font-bold truncate max-w-[110px]" title={key}>
                          {`{{${key}}}`}
                        </td>
                        <td className="px-2 py-1 text-slate-300 truncate max-w-[170px]" title={round.value}>
                          {displayValue || <span className="text-slate-600 italic">empty</span>}
                        </td>
                        <td className="px-1 py-1 text-center">
                          {round.isSecret && (
                            <button
                              data-testid={`toggle-secret-btn-${key}`}
                              onClick={() => toggleSecret(round.id)}
                              className="text-slate-500 hover:text-amber-400 p-0.5 rounded transition"
                              title={isRevealed ? 'Hide Secret' : 'Reveal Secret'}
                            >
                              {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick Add Variable Form */}
          {activeLoadout && (
            <form onSubmit={handleQuickAdd} className="pt-2 border-t border-bullet-border flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                + Quick Add Variable
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  data-testid="env-quick-key-input"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="variable_name"
                  className="flex-1 px-2 py-1 bg-bullet-bg border border-bullet-border rounded text-slate-200 text-xs outline-none focus:border-amber-500 transition"
                />
                <input
                  type="text"
                  data-testid="env-quick-val-input"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="value"
                  className="flex-1 px-2 py-1 bg-bullet-bg border border-bullet-border rounded text-slate-200 text-xs outline-none focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  data-testid="env-quick-secret-toggle"
                  onClick={() => setNewIsSecret(!newIsSecret)}
                  className={`p-1.5 rounded border transition ${
                    newIsSecret
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-bullet-bg border-bullet-border text-slate-500 hover:text-slate-300'
                  }`}
                  title={newIsSecret ? 'Secret Variable (Masked)' : 'Plain Variable'}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                </button>
                <button
                  type="submit"
                  data-testid="env-quick-add-btn"
                  disabled={isAdding || !newKey.trim()}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
