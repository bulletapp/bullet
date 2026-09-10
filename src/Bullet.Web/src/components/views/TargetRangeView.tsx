import React, { useState, useEffect } from 'react';
import { Radio, Plus, Trash2, Save, Play, Check } from 'lucide-react';
import { TargetRange } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface TargetRangeViewProps {
  rangeId: string;
}

export const TargetRangeView: React.FC<TargetRangeViewProps> = ({ rangeId }) => {
  const [targetRanges, setTargetRanges] = useState<TargetRange[]>([]);
  const [selectedMock, setSelectedMock] = useState<TargetRange | null>(null);
  const [rulesJson, setRulesJson] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchMocks = async () => {
    try {
      const list = await bulletApi.getTargetRanges(rangeId);
      setTargetRanges(list);
      if (list.length > 0 && !selectedMock) {
        setSelectedMock(list[0]);
        setRulesJson(list[0].mockRulesJson || '[]');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMocks();
  }, [rangeId]);

  const handleSelectMock = (mock: TargetRange) => {
    setSelectedMock(mock);
    setRulesJson(mock.mockRulesJson || '[]');
  };

  const handleCreateMock = async () => {
    try {
      const created = await bulletApi.createTargetRange({
        rangeId,
        name: `Mock Server ${targetRanges.length + 1}`,
        prefixPath: `/mock-${targetRanges.length + 1}`,
        port: 8080 + targetRanges.length,
        enabled: true,
        mockRulesJson: JSON.stringify(
          [
            {
              pathPattern: '/users/.*',
              method: 'GET',
              statusCode: 200,
              latencyMs: 50,
              responseHeaders: { 'Content-Type': 'application/json' },
              responseBody: JSON.stringify({ id: 101, name: 'Alice Test', role: 'developer' }, null, 2),
            },
          ],
          null,
          2
        ),
      });
      await fetchMocks();
      handleSelectMock(created);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteMock = async (id: string) => {
    if (!confirm('Delete this Target Range mock server?')) return;
    try {
      await bulletApi.deleteTargetRange(id);
      setSelectedMock(null);
      await fetchMocks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-sm text-slate-100">Target Range</span>
          <span className="text-[10px] text-slate-500 uppercase">Mock Servers & Simulations</span>
        </div>

        <button
          onClick={handleCreateMock}
          className="flex items-center gap-1 px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Target Range</span>
        </button>
      </div>

      {/* Main split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mock Server List */}
        <div className="w-64 border-r border-bullet-border bg-bullet-panel p-2 space-y-1 overflow-y-auto">
          <span className="text-[10px] text-slate-500 uppercase px-2 py-1 block">Configured Mocks</span>
          {targetRanges.map((m) => {
            const isSelected = selectedMock?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleSelectMock(m)}
                className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer transition ${
                  isSelected
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-bullet-surface'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${m.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="truncate font-medium">{m.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMock(m.id);
                  }}
                  className="text-slate-500 hover:text-rose-400 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Mock Rules & Config */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          {selectedMock ? (
            <>
              <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
                <div>
                  <div className="text-sm font-bold text-slate-100">{selectedMock.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Prefix path: <code className="text-cyan-400">{selectedMock.prefixPath}</code> • Port: {selectedMock.port}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    ONLINE
                  </span>
                </div>
              </div>

              {/* Rules JSON editor */}
              <div className="flex-1 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[11px]">
                    Mock Match Rules & Responses (JSON)
                  </span>
                </div>
                <textarea
                  value={rulesJson}
                  onChange={(e) => setRulesJson(e.target.value)}
                  className="w-full h-96 bg-bullet-surface border border-bullet-border rounded p-3 text-slate-200 font-mono text-xs outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500">
              No Target Range mock servers configured. Click "New Target Range" to spin one up.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
