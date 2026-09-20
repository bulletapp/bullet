import React, { useState } from 'react';
import {
  Folder, Sliders, Clock, Radio, 
  Activity, Cookie, BookOpen, ChevronRight, ChevronDown, 
  Plus, Search, Trash2, Play, FileDown,
  Lock, Upload
} from 'lucide-react';
import { Arsenal, Shot } from '../types/bullet';

export type ActiveSidebarTab = 
  | 'arsenals' 
  | 'loadouts' 
  | 'logs' 
  | 'tls' 
  | 'target-range' 
  | 'sentinels' 
  | 'cookies' 
  | 'manual';

interface SidebarProps {
  activeTab: ActiveSidebarTab;
  onTabChange: (tab: ActiveSidebarTab) => void;
  arsenals: Arsenal[];
  selectedShotId: string | null;
  onSelectShot: (shot: Shot) => void;
  onOpenNewArsenal: () => void;
  onOpenNewSquad: (arsenalId: string) => void;
  onOpenNewShot: (arsenalId: string, squadId?: string) => void;
  onDeleteArsenal: (id: string) => void;
  onDeleteSquad: (id: string) => void;
  onDeleteShot: (id: string) => void;
  onRunArsenal: (arsenalId: string) => void;
  onExportArsenal: (arsenalId: string) => void;
  onOpenImport?: () => void;
  onMoveShot?: (shotId: string, targetSquadId: string | null, targetArsenalId?: string) => void;
  onOpenFieldManual?: (arsenalId: string, arsenalName: string) => void;
}

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  POST: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  PUT: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  HEAD: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  OPTIONS: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  arsenals,
  selectedShotId,
  onSelectShot,
  onOpenNewArsenal,
  onOpenNewSquad,
  onOpenNewShot,
  onDeleteArsenal,
  onDeleteSquad,
  onDeleteShot,
  onRunArsenal,
  onExportArsenal,
  onOpenImport,
  onMoveShot,
  onOpenFieldManual,
}) => {
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'squad' | 'arsenal'; id: string } | null>(null);
  const [expandedArsenals, setExpandedArsenals] = useState<Record<string, boolean>>({
    // Pre-expand all by default
    ...arsenals.reduce((acc, a) => ({ ...acc, [a.id]: true }), {}),
  });
  const [expandedSquads, setExpandedSquads] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');

  const toggleArsenal = (id: string) => {
    setExpandedArsenals((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSquad = (id: string) => {
    setExpandedSquads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredArsenals = arsenals.map((a) => {
    if (!searchFilter.trim()) return a;
    const q = searchFilter.toLowerCase();
    const matchingDirectShots = a.shots?.filter((s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)) ?? [];
    const matchingSquads = (a.squads ?? []).map((squad) => ({
      ...squad,
      shots: squad.shots?.filter((s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)) ?? [],
    })).filter((squad) => squad.name.toLowerCase().includes(q) || squad.shots.length > 0);

    const matchesSelf = a.name.toLowerCase().includes(q);
    if (matchesSelf || matchingDirectShots.length > 0 || matchingSquads.length > 0) {
      return {
        ...a,
        shots: matchesSelf ? a.shots : matchingDirectShots,
        squads: matchesSelf ? a.squads : matchingSquads,
      };
    }
    return null;
  }).filter(Boolean) as Arsenal[];

  return (
    <div className="flex h-full border-r border-bullet-border bg-bullet-panel select-none">
      {/* Primary Tool Icon Strip */}
      <nav className="w-12 bg-bullet-bg border-r border-bullet-border flex flex-col items-center py-2 gap-1 flex-shrink-0">
        <button
          data-testid="sidebar-tab-arsenals"
          onClick={() => onTabChange('arsenals')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'arsenals'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Arsenals (Collections & Requests)"
        >
          <Folder className="w-4 h-4" />
        </button>

        <button
          data-testid="sidebar-tab-loadouts"
          onClick={() => onTabChange('loadouts')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'loadouts'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Loadouts & Rounds (Environments & Variables)"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          data-testid="sidebar-tab-logs"
          onClick={() => onTabChange('logs')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'logs'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Shot Log (Execution History)"
        >
          <Clock className="w-4 h-4" />
        </button>

        <button
          data-testid="sidebar-tab-tls"
          onClick={() => onTabChange('tls')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'tls'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Certificates & TLS Profiles"
        >
          <Lock className="w-4 h-4" />
        </button>

        <button
          data-testid="sidebar-tab-target-range"
          onClick={() => onTabChange('target-range')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'target-range'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Target Range (Mock Servers)"
        >
          <Radio className="w-4 h-4" />
        </button>

        <button
          data-testid="sidebar-tab-sentinels"
          onClick={() => onTabChange('sentinels')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'sentinels'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Sentinels (Automated Health Monitors)"
        >
          <Activity className="w-4 h-4" />
        </button>

        <button
          data-testid="sidebar-tab-cookies"
          onClick={() => onTabChange('cookies')}
          className={`w-9 h-9 rounded flex items-center justify-center transition ${
            activeTab === 'cookies'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Cookie Locker (Session & Cookie Management)"
        >
          <Cookie className="w-4 h-4" />
        </button>

        <div className="mt-auto">
          <button
            data-testid="sidebar-tab-manual"
            onClick={() => onTabChange('manual')}
            className={`w-9 h-9 rounded flex items-center justify-center transition ${
              activeTab === 'manual'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Field Manual (Documentation & Guide)"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Primary Tree Drawer (When in Arsenals view) */}
      {activeTab === 'arsenals' && (
        <div className="w-64 flex flex-col h-full bg-bullet-panel">
          {/* Search and Add Arsenal */}
          <div className="p-2 border-b border-bullet-border flex items-center gap-1.5">
            <div className="flex-1 relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Arsenal..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-bullet-surface border border-bullet-border rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
              />
            </div>
            <button
              onClick={onOpenNewArsenal}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
              title="Create Arsenal"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {onOpenImport && (
              <button
                data-testid="sidebar-import-btn"
                onClick={onOpenImport}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 transition"
                title="Import Postman Collection or OpenAPI"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tree View */}
          <div className="flex-1 overflow-y-auto p-1 text-xs space-y-0.5">
            {filteredArsenals.length === 0 ? (
              <div className="p-4 text-center text-slate-500 font-mono text-[11px]">
                No Arsenals found.<br />
                <div className="mt-2.5 flex items-center justify-center gap-1.5">
                  <button
                    onClick={onOpenNewArsenal}
                    className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/20"
                  >
                    + Create
                  </button>
                  {onOpenImport && (
                    <button
                      onClick={onOpenImport}
                      className="px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/20 flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      Import
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredArsenals.map((arsenal) => {
                const isExpanded = expandedArsenals[arsenal.id] ?? true;
                return (
                  <div key={arsenal.id} className="group/arsenal">
                    {/* Arsenal Item */}
                    <div
                      data-testid={`arsenal-item-${arsenal.id}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverTarget?.id !== arsenal.id) {
                          setDragOverTarget({ type: 'arsenal', id: arsenal.id });
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverTarget?.id === arsenal.id) {
                          setDragOverTarget(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const shotId = e.dataTransfer.getData('application/bullet-shot-id') || e.dataTransfer.getData('text/plain');
                        if (shotId && onMoveShot) {
                          onMoveShot(shotId, null, arsenal.id);
                        }
                        setDragOverTarget(null);
                        setDraggedShotId(null);
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition ${
                        dragOverTarget?.id === arsenal.id && dragOverTarget?.type === 'arsenal'
                          ? 'bg-amber-500/20 border border-amber-400/60 ring-1 ring-amber-400/50'
                          : 'hover:bg-bullet-surface text-slate-200'
                      }`}
                    >
                      <div
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={() => toggleArsenal(arsenal.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="font-medium truncate text-xs text-slate-200">
                          {arsenal.name}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="hidden group-hover/arsenal:flex items-center gap-1">
                        <button
                          onClick={() => onRunArsenal(arsenal.id)}
                          className="p-1 hover:text-amber-400 text-slate-400"
                          title="Run Arsenal (Firing Run)"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <button
                          data-testid={`add-shot-arsenal-${arsenal.id}`}
                          onClick={() => onOpenNewShot(arsenal.id)}
                          className="p-1 hover:text-emerald-400 text-slate-400"
                          title="Add Shot"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          data-testid={`add-squad-arsenal-${arsenal.id}`}
                          onClick={() => onOpenNewSquad(arsenal.id)}
                          className="p-1 hover:text-cyan-400 text-slate-400"
                          title="Add Squad (Folder)"
                        >
                          <Folder className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onExportArsenal(arsenal.id)}
                          className="p-1 hover:text-blue-400 text-slate-400"
                          title="Export Arsenal"
                        >
                          <FileDown className="w-3 h-3" />
                        </button>
                        {onOpenFieldManual && (
                          <button
                            data-testid={`field-manual-arsenal-${arsenal.id}`}
                            onClick={() => onOpenFieldManual(arsenal.id, arsenal.name)}
                            className="p-1 hover:text-purple-400 text-slate-400"
                            title="Field Manual / Documentation"
                          >
                            <BookOpen className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteArsenal(arsenal.id)}
                          className="p-1 hover:text-rose-400 text-slate-400"
                          title="Delete Arsenal"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Children: Squads & Direct Shots */}
                    {isExpanded && (
                      <div className="pl-3 border-l border-bullet-border ml-3 mt-0.5 space-y-0.5">
                        {/* Squads */}
                        {arsenal.squads?.map((squad) => {
                          const squadExpanded = expandedSquads[squad.id] ?? true;
                          const isSquadDropTarget = dragOverTarget?.id === squad.id && dragOverTarget?.type === 'squad';
                          return (
                            <div key={squad.id} className="group/squad">
                              <div
                                data-testid={`squad-item-${squad.id}`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (dragOverTarget?.id !== squad.id) {
                                    setDragOverTarget({ type: 'squad', id: squad.id });
                                  }
                                }}
                                onDragLeave={(e) => {
                                  e.stopPropagation();
                                  if (dragOverTarget?.id === squad.id) {
                                    setDragOverTarget(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const shotId = e.dataTransfer.getData('application/bullet-shot-id') || e.dataTransfer.getData('text/plain');
                                  if (shotId && onMoveShot) {
                                    onMoveShot(shotId, squad.id, arsenal.id);
                                  }
                                  setDragOverTarget(null);
                                  setDraggedShotId(null);
                                }}
                                className={`flex items-center justify-between px-1.5 py-1 rounded cursor-pointer transition ${
                                  isSquadDropTarget
                                    ? 'bg-amber-500/25 border border-amber-400 text-amber-200 shadow-sm ring-1 ring-amber-400/50'
                                    : 'hover:bg-bullet-surface text-slate-300'
                                }`}
                              >
                                <div
                                  className="flex items-center gap-1.5 flex-1 min-w-0"
                                  onClick={() => toggleSquad(squad.id)}
                                >
                                  {squadExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-500" />
                                  )}
                                  <span className="truncate text-[11px] font-medium">
                                    {squad.name}
                                  </span>
                                </div>
                                <div className="hidden group-hover/squad:flex items-center gap-1">
                                  <button
                                    onClick={() => onOpenNewShot(arsenal.id, squad.id)}
                                    className="p-0.5 hover:text-emerald-400 text-slate-400"
                                    title="Add Shot to Squad"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteSquad(squad.id)}
                                    className="p-0.5 hover:text-rose-400 text-slate-400"
                                    title="Delete Squad"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>

                              {squadExpanded && (
                                <div className="pl-3 border-l border-bullet-border ml-2 mt-0.5 space-y-0.5">
                                  {squad.shots?.map((shot) => {
                                    const isSelected = selectedShotId === shot.id;
                                    const isDragging = draggedShotId === shot.id;
                                    return (
                                      <div
                                        key={shot.id}
                                        data-testid={`shot-item-${shot.id}`}
                                        draggable={true}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('text/plain', shot.id);
                                          e.dataTransfer.setData('application/bullet-shot-id', shot.id);
                                          e.dataTransfer.effectAllowed = 'move';
                                          setDraggedShotId(shot.id);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedShotId(null);
                                          setDragOverTarget(null);
                                        }}
                                        onClick={() => onSelectShot(shot)}
                                        className={`group/shot flex items-center justify-between px-1.5 py-1 rounded cursor-grab active:cursor-grabbing transition ${
                                          isDragging ? 'opacity-40 border-dashed border border-amber-500/50' : ''
                                        } ${
                                          isSelected
                                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                            : 'hover:bg-bullet-surface text-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                                            methodColors[shot.method] || 'text-slate-400'
                                          }`}>
                                            {shot.method}
                                          </span>
                                          <span className="truncate text-xs">{shot.name}</span>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteShot(shot.id);
                                          }}
                                          className="hidden group-hover/shot:block p-0.5 hover:text-rose-400 text-slate-500"
                                          title="Delete Shot"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Empty Arsenal Helper */}
                        {(!arsenal.shots || arsenal.shots.length === 0) && (!arsenal.squads || arsenal.squads.length === 0) && (
                          <div className="py-2 px-2 text-slate-500 font-mono text-[11px] flex items-center gap-2">
                            <span>Empty Arsenal.</span>
                            <button
                              data-testid={`empty-add-shot-${arsenal.id}`}
                              onClick={() => onOpenNewShot(arsenal.id)}
                              className="text-amber-400 hover:text-amber-300 underline font-medium"
                            >
                              + Add Shot
                            </button>
                          </div>
                        )}

                        {/* Direct Shots */}
                        {arsenal.shots?.filter((shot) => !shot.squadId).map((shot) => {
                          const isSelected = selectedShotId === shot.id;
                          const isDragging = draggedShotId === shot.id;
                          return (
                            <div
                              key={shot.id}
                              data-testid={`shot-item-${shot.id}`}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', shot.id);
                                e.dataTransfer.setData('application/bullet-shot-id', shot.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedShotId(shot.id);
                              }}
                              onDragEnd={() => {
                                setDraggedShotId(null);
                                setDragOverTarget(null);
                              }}
                              onClick={() => onSelectShot(shot)}
                              className={`group/shot flex items-center justify-between px-1.5 py-1 rounded cursor-grab active:cursor-grabbing transition ${
                                isDragging ? 'opacity-40 border-dashed border border-amber-500/50' : ''
                              } ${
                                isSelected
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                  : 'hover:bg-bullet-surface text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                                  methodColors[shot.method] || 'text-slate-400'
                                }`}>
                                  {shot.method}
                                </span>
                                <span className="truncate text-xs">{shot.name}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteShot(shot.id);
                                }}
                                className="hidden group-hover/shot:block p-0.5 hover:text-rose-400 text-slate-500"
                                title="Delete Shot"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
