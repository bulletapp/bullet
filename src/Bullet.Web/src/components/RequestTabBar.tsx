import React from 'react';
import { Plus, X } from 'lucide-react';
import { Shot } from '../types/bullet';

export interface RequestTabItem {
  id: string;
  shot: Shot;
  isDirty?: boolean;
}

interface RequestTabBarProps {
  tabs: RequestTabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

export const RequestTabBar: React.FC<RequestTabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'POST':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'PUT':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'PATCH':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'GRPC':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'WS':
      case 'WEBSOCKET':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div
      data-testid="request-tab-bar"
      className="flex items-center h-9 bg-bullet-panel border-b border-bullet-border px-1.5 overflow-x-auto select-none no-scrollbar flex-shrink-0"
    >
      <div className="flex items-center gap-1 flex-1 overflow-x-auto py-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const method = tab.shot.method || 'GET';
          const name = tab.shot.name || 'Untitled Shot';

          return (
            <div
              key={tab.id}
              data-testid={`request-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-2 px-2.5 py-1 rounded-t text-xs font-mono border transition-all cursor-pointer max-w-[200px] min-w-[120px] ${
                isActive
                  ? 'bg-bullet-bg border-bullet-border border-b-transparent text-slate-100 font-semibold shadow-sm -mb-[1px]'
                  : 'bg-bullet-surface/60 hover:bg-bullet-surface border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Method Badge */}
              <span
                className={`text-[9px] font-bold px-1 py-0.2 rounded border uppercase flex-shrink-0 ${getMethodBadgeClass(
                  method
                )}`}
              >
                {method === 'GRPC' ? 'gRPC' : method}
              </span>

              {/* Shot Name */}
              <span className="truncate flex-1 text-left" title={name}>
                {name}
              </span>

              {/* Dirty Indicator or Close Button */}
              <div className="flex items-center flex-shrink-0 ml-1">
                {tab.isDirty ? (
                  <span
                    data-testid={`tab-dirty-indicator-${tab.id}`}
                    className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"
                    title="Unsaved changes"
                  />
                ) : null}
                <button
                  data-testid={`tab-close-btn-${tab.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={`p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition ${
                    tab.isDirty ? 'hidden group-hover:block' : ''
                  }`}
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Plus / New Tab Button */}
        <button
          data-testid="tab-new-btn"
          onClick={onNewTab}
          className="flex items-center justify-center p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
          title="New Request Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
