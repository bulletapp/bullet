import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Plus, Terminal, Download, BookOpen, Layers, Sliders, X } from 'lucide-react';
import { Arsenal, Shot } from '../../types/bullet';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onFireShot: () => void;
  onOpenNewShot: () => void;
  onOpenFiringRun: () => void;
  onToggleConsole: () => void;
  onOpenArmoryTransfer: () => void;
  onOpenManual: () => void;
  arsenals: Arsenal[];
  onSelectShot: (shot: Shot) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onFireShot,
  onOpenNewShot,
  onOpenFiringRun,
  onToggleConsole,
  onOpenArmoryTransfer,
  onOpenManual,
  arsenals,
  onSelectShot,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Flatten all shots for quick jump
  const allShots: { shot: Shot; arsenalName: string }[] = [];
  for (const a of arsenals) {
    for (const s of a.shots || []) {
      allShots.push({ shot: s, arsenalName: a.name });
    }
    for (const sq of a.squads || []) {
      for (const s of sq.shots || []) {
        allShots.push({ shot: s, arsenalName: `${a.name} / ${sq.name}` });
      }
    }
  }

  const baseCommands = [
    {
      id: 'fire',
      title: 'Fire Current Shot',
      subtitle: 'Execute active HTTP request (Ctrl+Enter)',
      icon: <Play className="w-4 h-4 text-amber-400" />,
      action: () => { onFireShot(); onClose(); },
    },
    {
      id: 'new-shot',
      title: 'Create New Shot',
      subtitle: 'Add a new request to active Arsenal',
      icon: <Plus className="w-4 h-4 text-emerald-400" />,
      action: () => { onOpenNewShot(); onClose(); },
    },
    {
      id: 'run-arsenal',
      title: 'Run Firing Run',
      subtitle: 'Execute collection test suite runner',
      icon: <Play className="w-4 h-4 text-amber-400" />,
      action: () => { onOpenFiringRun(); onClose(); },
    },
    {
      id: 'console',
      title: 'Toggle Trajectory Console',
      subtitle: 'Show/hide real-time execution logs (Ctrl+J)',
      icon: <Terminal className="w-4 h-4 text-cyan-400" />,
      action: () => { onToggleConsole(); onClose(); },
    },
    {
      id: 'transfer',
      title: 'Armory Transfer (Import / Export)',
      subtitle: 'Import or export OpenAPI, Postman, cURL, .bullet.json',
      icon: <Download className="w-4 h-4 text-blue-400" />,
      action: () => { onOpenArmoryTransfer(); onClose(); },
    },
    {
      id: 'manual',
      title: 'Open Field Manual',
      subtitle: 'View Bullet documentation & architecture guide',
      icon: <BookOpen className="w-4 h-4 text-purple-400" />,
      action: () => { onOpenManual(); onClose(); },
    },
  ];

  const shotCommands = allShots.map((item) => ({
    id: `shot-${item.shot.id}`,
    title: item.shot.name,
    subtitle: `${item.shot.method} ${item.shot.url} • ${item.arsenalName}`,
    icon: <span className="font-mono text-[10px] text-amber-400">{item.shot.method}</span>,
    action: () => { onSelectShot(item.shot); onClose(); },
  }));

  const allItems = [...baseCommands, ...shotCommands];
  const filteredItems = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 select-none cursor-pointer"
    >
      <div className="w-full max-w-xl bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl overflow-hidden flex flex-col cursor-default">
        {/* Search input */}
        <div className="flex items-center px-3 py-3 border-b border-bullet-border bg-bullet-bg">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search shots..."
            className="flex-1 bg-transparent text-sm font-mono text-slate-100 placeholder-slate-500 outline-none"
          />
          <span className="text-[10px] font-mono text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
            ESC
          </span>
        </div>

        {/* Commands List */}
        <div className="max-h-80 overflow-y-auto p-1 text-xs">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-slate-500 font-mono text-xs">
              No matching commands or shots found.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition ${
                  selectedIndex === idx
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-300 hover:bg-bullet-surface'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-5 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
