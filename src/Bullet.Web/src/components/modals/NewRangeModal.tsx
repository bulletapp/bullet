import React, { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { bulletApi } from '../../api/bulletApi';
import { Range } from '../../types/bullet';

interface NewRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (range: Range) => void;
}

export const NewRangeModal: React.FC<NewRangeModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const created = await bulletApi.createRange(name.trim(), description.trim() || undefined);
      onCreated(created);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create Range.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="new-range-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-md bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-100">Create New Range (Workspace)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-slate-400 block mb-1">Range Name</label>
            <input
              type="text"
              required
              data-testid="range-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payments Gateway API"
              className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Workspace purpose and notes..."
              className="w-full h-20 p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="create-range-submit-btn"
              disabled={isLoading || !name.trim()}
              className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold"
            >
              {isLoading ? 'Creating...' : 'Create Range'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
