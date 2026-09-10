import React, { useState, useEffect } from 'react';
import { X, Folder } from 'lucide-react';
import { bulletApi } from '../../api/bulletApi';
import { Squad } from '../../types/bullet';

interface NewSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  arsenalId: string;
  onCreated: (squad: Squad) => void;
}

export const NewSquadModal: React.FC<NewSquadModalProps> = ({
  isOpen,
  onClose,
  arsenalId,
  onCreated,
}) => {
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
      const created = await bulletApi.createSquad(arsenalId, name.trim(), description.trim() || undefined);
      onCreated(created);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create Squad.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="new-squad-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-md bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-100">Create New Squad (Folder)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-slate-400 block mb-1">Squad Name</label>
            <input
              type="text"
              required
              data-testid="squad-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. User Lifecycle"
              className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Folder purpose..."
              className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none focus:border-amber-500"
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
              data-testid="create-squad-submit-btn"
              disabled={isLoading || !name.trim()}
              className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold"
            >
              {isLoading ? 'Creating...' : 'Create Squad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
