import React, { useState } from 'react';
import { 
  Sliders, Plus, Trash2, Eye, EyeOff, ShieldAlert, 
  Save, Check, Lock, AlertTriangle 
} from 'lucide-react';
import { Loadout, Round } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface LoadoutsViewProps {
  rangeId: string;
  loadouts: Loadout[];
  onRefresh: () => void;
}

export const LoadoutsView: React.FC<LoadoutsViewProps> = ({ rangeId, loadouts, onRefresh }) => {
  const [selectedLoadoutId, setSelectedLoadoutId] = useState<string>(loadouts[0]?.id || '');
  const [newLoadoutName, setNewLoadoutName] = useState('');
  const [newLoadoutProd, setNewLoadoutProd] = useState(false);
  const [showNewLoadoutModal, setShowNewLoadoutModal] = useState(false);

  const [maskSecrets, setMaskSecrets] = useState(true);
  const [newRoundKey, setNewRoundKey] = useState('');
  const [newRoundValue, setNewRoundValue] = useState('');
  const [newRoundIsSecret, setNewRoundIsSecret] = useState(false);
  const [newRoundDesc, setNewRoundDesc] = useState('');

  const currentLoadout = loadouts.find((l) => l.id === selectedLoadoutId) || loadouts[0];

  const handleCreateLoadout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoadoutName.trim()) return;
    try {
      const created = await bulletApi.createLoadout(rangeId, newLoadoutName, newLoadoutProd);
      setNewLoadoutName('');
      setNewLoadoutProd(false);
      setShowNewLoadoutModal(false);
      onRefresh();
      setSelectedLoadoutId(created.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteLoadout = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Loadout?')) return;
    try {
      await bulletApi.deleteLoadout(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleProduction = async (loadout: Loadout) => {
    try {
      await bulletApi.updateLoadout(loadout.id, { isProduction: !loadout.isProduction });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLoadout || !newRoundKey.trim()) return;
    try {
      await bulletApi.addRound(currentLoadout.id, {
        key: newRoundKey.trim(),
        name: newRoundKey.trim(),
        value: newRoundValue,
        isSecret: newRoundIsSecret,
        description: newRoundDesc,
      });
      setNewRoundKey('');
      setNewRoundValue('');
      setNewRoundIsSecret(false);
      setNewRoundDesc('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    try {
      await bulletApi.deleteRound(roundId);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm text-slate-100">Loadouts & Rounds</span>
          <span className="text-[10px] text-slate-500 uppercase">Environments & Variables</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMaskSecrets(!maskSecrets)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs"
          >
            {maskSecrets ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>{maskSecrets ? 'Reveal Secrets' : 'Mask Secrets'}</span>
          </button>

          <button
            onClick={() => setShowNewLoadoutModal(true)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Loadout</span>
          </button>
        </div>
      </div>

      {/* Main split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Loadout list selector */}
        <div className="w-64 border-r border-bullet-border bg-bullet-panel p-2 space-y-1 overflow-y-auto">
          <span className="text-[10px] text-slate-500 uppercase px-2 py-1 block">Loadouts (Environments)</span>
          {loadouts.map((l) => {
            const isSelected = (currentLoadout?.id || '') === l.id;
            return (
              <div
                key={l.id}
                onClick={() => setSelectedLoadoutId(l.id)}
                className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer transition ${
                  isSelected
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-bullet-surface'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {l.isProduction ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  )}
                  <span className="truncate font-medium">{l.name}</span>
                </div>
                <span className="text-[10px] text-slate-500">{l.rounds?.length || 0}</span>
              </div>
            );
          })}
        </div>

        {/* Loadout detail */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          {currentLoadout ? (
            <>
              {/* Loadout settings */}
              <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">{currentLoadout.name}</span>
                    {currentLoadout.isProduction && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase">
                        Production Guard
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Rounds defined here can be referenced using <code className="text-amber-400">{'{{roundName}}'}</code>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleProduction(currentLoadout)}
                    className={`px-2.5 py-1 rounded border text-xs transition ${
                      currentLoadout.isProduction
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {currentLoadout.isProduction ? '⚡ Marked as Production' : 'Mark as Production'}
                  </button>
                  <button
                    onClick={() => handleDeleteLoadout(currentLoadout.id)}
                    className="p-1.5 rounded hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 border border-slate-700"
                    title="Delete Loadout"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rounds table */}
              <div className="border border-bullet-border rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400">
                      <th className="px-3 py-2 w-1/4 font-normal">Round Key</th>
                      <th className="px-3 py-2 w-1/3 font-normal">Value</th>
                      <th className="px-3 py-2 w-16 text-center font-normal">Secret</th>
                      <th className="px-3 py-2 font-normal">Description</th>
                      <th className="w-8 px-2 py-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentLoadout.rounds || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          No rounds defined in this loadout. Add one below.
                        </td>
                      </tr>
                    ) : (
                      currentLoadout.rounds.map((round) => (
                        <tr key={round.id} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50">
                          <td className="px-3 py-2 font-mono text-amber-400 font-medium select-text">
                            {round.key || (round as any).name}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-200 select-text">
                            {round.isSecret && maskSecrets ? (
                              <span className="text-slate-500 tracking-widest">••••••••••••</span>
                            ) : (
                              round.value
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {round.isSecret ? (
                              <Lock className="w-3 h-3 text-amber-400 inline" />
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{round.description || '-'}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRound(round.id)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add round form */}
              <form onSubmit={handleAddRound} className="p-3 bg-bullet-surface border border-bullet-border rounded space-y-3">
                <span className="font-semibold text-slate-200 uppercase text-[11px] block">
                  Add New Round (Variable)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <input
                      type="text"
                      data-testid="new-round-key-input"
                      required
                      placeholder="Key (e.g. apiHost)"
                      value={newRoundKey}
                      onChange={(e) => setNewRoundKey(e.target.value)}
                      className="w-full p-1.5 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      data-testid="new-round-value-input"
                      placeholder="Value (e.g. https://api.prod.com)"
                      value={newRoundValue}
                      onChange={(e) => setNewRoundValue(e.target.value)}
                      className="w-full p-1.5 bg-bullet-bg border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRoundIsSecret}
                        onChange={(e) => setNewRoundIsSecret(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-amber-500"
                      />
                      <span>Secret</span>
                    </label>
                    <button
                      type="submit"
                      data-testid="add-round-submit-btn"
                      disabled={!newRoundKey.trim()}
                      className="flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500">
              No Loadouts created yet. Click "New Loadout" to create one.
            </div>
          )}
        </div>
      </div>

      {/* New Loadout Modal */}
      {showNewLoadoutModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl p-4 space-y-3">
            <span className="font-bold text-slate-100 text-sm block">Create Loadout</span>
            <form onSubmit={handleCreateLoadout} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Loadout Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staging Environment"
                  value={newLoadoutName}
                  onChange={(e) => setNewLoadoutName(e.target.value)}
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newLoadoutProd}
                  onChange={(e) => setNewLoadoutProd(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500"
                />
                <span>Enable Production Safeguards</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLoadoutModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
