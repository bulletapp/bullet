import React, { useState, useEffect } from 'react';
import { X, Crosshair } from 'lucide-react';
import { bulletApi } from '../../api/bulletApi';
import { Shot, Arsenal } from '../../types/bullet';

interface NewShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  arsenals: Arsenal[];
  defaultArsenalId?: string;
  defaultSquadId?: string;
  onCreated: (shot: Shot) => void;
}

export const NewShotModal: React.FC<NewShotModalProps> = ({
  isOpen,
  onClose,
  arsenals,
  defaultArsenalId,
  defaultSquadId,
  onCreated,
}) => {
  const [arsenalId, setArsenalId] = useState('');
  const [squadId, setSquadId] = useState('');
  const [name, setName] = useState('');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync state whenever modal is opened or targets change
  useEffect(() => {
    if (isOpen) {
      const validArsenalId = defaultArsenalId && arsenals.some((a) => a.id === defaultArsenalId)
        ? defaultArsenalId
        : (arsenals.length > 0 ? arsenals[0].id : '');

      setArsenalId(validArsenalId);
      setSquadId(defaultSquadId || '');
      setName('');
      setMethod('GET');
      setUrl('');
      setIsLoading(false);
    }
  }, [isOpen, defaultArsenalId, defaultSquadId, arsenals]);

  if (!isOpen) return null;

  const currentArsenal = arsenals.find((a) => a.id === arsenalId) || arsenals[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetArsenalId = arsenalId || defaultArsenalId || (arsenals.length > 0 ? arsenals[0].id : '');

    if (!name.trim()) {
      alert('Please enter a Shot name.');
      return;
    }
    if (!targetArsenalId) {
      alert('No Arsenal available to attach this Shot to. Please create an Arsenal first.');
      return;
    }

    setIsLoading(true);
    try {
      const created = await bulletApi.createShot({
        arsenalId: targetArsenalId,
        squadId: squadId || undefined,
        name: name.trim(),
        method,
        url: url.trim() || '{{apiHost}}/',
        parameters: [],
        headers: [],
        payload: { type: 'none', formData: [] },
        armor: { type: 'inherit' },
        settings: {
          timeoutMs: 30000,
          followRedirects: true,
          maxRedirects: 5,
          verifyTls: localStorage.getItem('bullet_verify_ssl') !== 'false',
          verifySsl: localStorage.getItem('bullet_verify_ssl') !== 'false',
          bypassSsrfGuard: false,
        },
      });
      onCreated(created);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create Shot.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="new-shot-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-md bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-100">Create New Shot (Request)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {arsenals.length === 0 ? (
          <div className="p-6 text-center text-slate-400 space-y-3">
            <p>No Arsenals exist in this Range yet.</p>
            <p className="text-slate-500 text-[11px]">Shots must belong to an Arsenal (Collection). Please create an Arsenal first.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Target Arsenal</label>
                <select
                  data-testid="shot-arsenal-select"
                  value={arsenalId || currentArsenal?.id || ''}
                  onChange={(e) => {
                    setArsenalId(e.target.value);
                    setSquadId('');
                  }}
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                >
                  {arsenals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Squad (Optional)</label>
                <select
                  data-testid="shot-squad-select"
                  value={squadId}
                  onChange={(e) => setSquadId(e.target.value)}
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                >
                  <option value="">Directly in Arsenal</option>
                  {currentArsenal?.squads?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Shot Name</label>
              <input
                type="text"
                required
                data-testid="shot-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Google Search API or Fetch User"
                className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Method</label>
                <select
                  data-testid="shot-method-select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-amber-400 font-bold outline-none"
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-slate-400 block mb-1">URL (supports {'{{round}}'})</label>
                <input
                  type="text"
                  data-testid="shot-url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.google.com"
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="new-shot-cancel-btn"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="create-shot-submit-btn"
                disabled={isLoading || !name.trim()}
                className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold shadow transition flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Shot</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
