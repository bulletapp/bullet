import React, { useState } from 'react';
import { 
  ShieldAlert, Sparkles, Plus, Trash2, Code2, 
  HelpCircle, Eye, EyeOff, CheckSquare, Square
} from 'lucide-react';
import { Shot, KeyValuePair, ArmorConfig, PayloadConfig, ShotSettings } from '../types/bullet';

interface ShotEditorProps {
  shot: Shot;
  onChange: (updated: Shot) => void;
}

type EditorTab = 'params' | 'headers' | 'armor' | 'payload' | 'triggers' | 'verifiers' | 'settings';

export const ShotEditor: React.FC<ShotEditorProps> = ({ shot, onChange }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('params');
  const [bulkMode, setBulkMode] = useState<Record<string, boolean>>({});
  const [bulkText, setBulkText] = useState<Record<string, string>>({});

  // Key-value editor handlers
  const updateKeyValueList = (field: 'parameters' | 'headers', items: KeyValuePair[]) => {
    onChange({ ...shot, [field]: items });
  };

  const addRow = (field: 'parameters' | 'headers') => {
    const list = [...(shot[field] || [])];
    list.push({ key: '', value: '', description: '', enabled: true });
    updateKeyValueList(field, list);
  };

  const removeRow = (field: 'parameters' | 'headers', index: number) => {
    const list = [...(shot[field] || [])];
    list.splice(index, 1);
    updateKeyValueList(field, list);
  };

  const updateRow = (field: 'parameters' | 'headers', index: number, patch: Partial<KeyValuePair>) => {
    const list = [...(shot[field] || [])];
    list[index] = { ...list[index], ...patch };
    updateKeyValueList(field, list);
  };

  // Bulk Edit Toggle
  const toggleBulkMode = (field: 'parameters' | 'headers') => {
    const isBulk = bulkMode[field] ?? false;
    if (!isBulk) {
      const text = (shot[field] || [])
        .map((item) => `${item.key}:${item.value}`)
        .join('\n');
      setBulkText((prev) => ({ ...prev, [field]: text }));
    } else {
      const lines = (bulkText[field] || '').split('\n');
      const parsed: KeyValuePair[] = lines
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          const idx = l.indexOf(':');
          if (idx === -1) return { key: l.trim(), value: '', enabled: true };
          return {
            key: l.slice(0, idx).trim(),
            value: l.slice(idx + 1).trim(),
            enabled: true,
          };
        });
      updateKeyValueList(field, parsed);
    }
    setBulkMode((prev) => ({ ...prev, [field]: !isBulk }));
  };

  // Format JSON payload
  const beautifyPayload = () => {
    if (shot.payload.type === 'json' && shot.payload.rawText) {
      try {
        const obj = JSON.parse(shot.payload.rawText);
        onChange({
          ...shot,
          payload: { ...shot.payload, rawText: JSON.stringify(obj, null, 2) },
        });
      } catch {
        // invalid JSON
      }
    }
  };

  // Add Trigger Snippets
  const addTriggerSnippet = (snippet: string) => {
    const current = shot.triggerScript || '';
    onChange({
      ...shot,
      triggerScript: current ? `${current}\n\n${snippet}` : snippet,
    });
  };

  // Add Verifier Snippets
  const addVerifierSnippet = (snippet: string) => {
    const current = shot.verifierScript || '';
    onChange({
      ...shot,
      verifierScript: current ? `${current}\n\n${snippet}` : snippet,
    });
  };

  return (
    <div className="flex flex-col h-full bg-bullet-panel select-none overflow-hidden">
      {/* Sub-tab strip */}
      <div className="flex items-center gap-1 px-3 border-b border-bullet-border bg-bullet-bg text-xs">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
            activeTab === 'params'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Params
          {shot.parameters?.length > 0 && (
            <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
              {shot.parameters.filter((p) => p.enabled && p.key).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('headers')}
          className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
            activeTab === 'headers'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Headers
          {shot.headers?.length > 0 && (
            <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
              {shot.headers.filter((h) => h.enabled && h.key).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('armor')}
          className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
            activeTab === 'armor'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Armor
          {shot.armor?.type && shot.armor.type !== 'inherit' && shot.armor.type !== 'none' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('payload')}
          className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
            activeTab === 'payload'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Payload
          {shot.payload?.type && shot.payload.type !== 'none' && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('triggers')}
          className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
            activeTab === 'triggers'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Triggers
          {shot.triggerScript?.trim() && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('verifiers')}
          className={`px-3 py-2 border-b-2 font-mono transition flex items-center gap-1.5 ${
            activeTab === 'verifiers'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Verifiers
          {shot.verifierScript?.trim() && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 border-b-2 font-mono transition ${
            activeTab === 'settings'
              ? 'border-amber-400 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* PARAMS / HEADERS VIEW */}
        {(activeTab === 'params' || activeTab === 'headers') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                {activeTab === 'params' ? 'Query Parameters' : 'HTTP Request Headers'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleBulkMode(activeTab === 'params' ? 'parameters' : 'headers')}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition"
                >
                  {bulkMode[activeTab === 'params' ? 'parameters' : 'headers'] ? 'Grid Edit' : 'Bulk Edit'}
                </button>
              </div>
            </div>

            {bulkMode[activeTab === 'params' ? 'parameters' : 'headers'] ? (
              <textarea
                value={bulkText[activeTab === 'params' ? 'parameters' : 'headers'] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const key = activeTab === 'params' ? 'parameters' : 'headers';
                  setBulkText((prev) => ({ ...prev, [key]: val }));
                }}
                placeholder="Key:Value (one per line)"
                className="w-full h-48 bg-bullet-surface border border-bullet-border rounded p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-500"
              />
            ) : (
              <div className="border border-bullet-border rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400 font-mono">
                      <th className="w-8 px-2 py-1.5 text-center">✓</th>
                      <th className="px-3 py-1.5 font-normal">Key</th>
                      <th className="px-3 py-1.5 font-normal">Value</th>
                      <th className="px-3 py-1.5 font-normal">Description</th>
                      <th className="w-8 px-2 py-1.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {((activeTab === 'params' ? shot.parameters : shot.headers) || []).map((row, idx) => (
                      <tr key={idx} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50">
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { enabled: e.target.checked }
                              )
                            }
                            className="rounded bg-slate-900 border-slate-700 text-amber-500"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={row.key}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { key: e.target.value }
                              )
                            }
                            placeholder="Key"
                            className="w-full bg-transparent font-mono text-xs text-slate-200 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { value: e.target.value }
                              )
                            }
                            placeholder="Value"
                            className="w-full bg-transparent font-mono text-xs text-slate-200 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={row.description || ''}
                            onChange={(e) =>
                              updateRow(
                                activeTab === 'params' ? 'parameters' : 'headers',
                                idx,
                                { description: e.target.value }
                              )
                            }
                            placeholder="Optional notes"
                            className="w-full bg-transparent text-xs text-slate-400 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() =>
                              removeRow(activeTab === 'params' ? 'parameters' : 'headers', idx)
                            }
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-1.5 bg-bullet-bg border-t border-bullet-border">
                  <button
                    onClick={() => addRow(activeTab === 'params' ? 'parameters' : 'headers')}
                    className="flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-slate-800"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ARMOR (AUTH) VIEW */}
        {activeTab === 'armor' && (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Armor (Authorization)
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-mono block mb-1">Auth Type</label>
              <select
                value={shot.armor?.type || 'inherit'}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    armor: { ...shot.armor, type: e.target.value as any },
                  })
                }
                className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="inherit">Inherit Armor from Squad / Arsenal</option>
                <option value="none">No Armor (None)</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apiKey">API Key</option>
                <option value="awsSigV4">AWS Signature V4</option>
              </select>
            </div>

            {shot.armor?.type === 'bearer' && (
              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">
                  Bearer Token (supports <code className="text-amber-400">{'{{round}}'}</code>)
                </label>
                <input
                  type="text"
                  value={shot.armor.bearerToken || ''}
                  onChange={(e) =>
                    onChange({
                      ...shot,
                      armor: { ...shot.armor, bearerToken: e.target.value },
                    })
                  }
                  placeholder="e.g. {{authToken}} or eyJhbGciOi..."
                  className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            )}

            {shot.armor?.type === 'basic' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Username</label>
                  <input
                    type="text"
                    value={shot.armor.basicUsername || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, basicUsername: e.target.value },
                      })
                    }
                    placeholder="Username or {{username}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Password</label>
                  <input
                    type="password"
                    value={shot.armor.basicPassword || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, basicPassword: e.target.value },
                      })
                    }
                    placeholder="Password or {{password}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {shot.armor?.type === 'apiKey' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Key Name</label>
                  <input
                    type="text"
                    value={shot.armor.apiKeyName || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, apiKeyName: e.target.value },
                      })
                    }
                    placeholder="e.g. X-API-Key"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Key Value</label>
                  <input
                    type="text"
                    value={shot.armor.apiKeyValue || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, apiKeyValue: e.target.value },
                      })
                    }
                    placeholder="e.g. {{apiKey}}"
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-mono block mb-1">Add To</label>
                  <select
                    value={shot.armor.apiKeyLocation || 'header'}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        armor: { ...shot.armor, apiKeyLocation: e.target.value as any },
                      })
                    }
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-xs font-mono text-slate-200 outline-none"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAYLOAD VIEW */}
        {activeTab === 'payload' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Payload Type:
                </span>
                <div className="flex items-center gap-2">
                  {(['none', 'json', 'formUrlEncoded', 'multipart', 'raw', 'xml', 'graphQl'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-1 cursor-pointer text-xs font-mono">
                      <input
                        type="radio"
                        name="payloadType"
                        value={type}
                        checked={shot.payload?.type === type}
                        onChange={() =>
                          onChange({
                            ...shot,
                            payload: { ...shot.payload, type },
                          })
                        }
                        className="text-amber-500"
                      />
                      <span className={shot.payload?.type === type ? 'text-amber-400' : 'text-slate-400'}>
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {shot.payload?.type === 'json' && (
                <button
                  onClick={beautifyPayload}
                  className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Beautify JSON</span>
                </button>
              )}
            </div>

            {shot.payload?.type === 'none' ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-bullet-border rounded">
                This request does not have a payload body.
              </div>
            ) : shot.payload?.type === 'graphQl' ? (
              <div className="grid grid-cols-2 gap-2 h-72">
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-slate-400 mb-1">GraphQL Query:</span>
                  <textarea
                    value={shot.payload.graphQlQuery || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        payload: { ...shot.payload, graphQlQuery: e.target.value },
                      })
                    }
                    placeholder="query { users { id name } }"
                    className="w-full flex-1 bg-bullet-surface border border-bullet-border rounded p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-slate-400 mb-1">GraphQL Variables (JSON):</span>
                  <textarea
                    value={shot.payload.graphQlVariables || ''}
                    onChange={(e) =>
                      onChange({
                        ...shot,
                        payload: { ...shot.payload, graphQlVariables: e.target.value },
                      })
                    }
                    placeholder="{}"
                    className="w-full flex-1 bg-bullet-surface border border-bullet-border rounded p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <textarea
                value={shot.payload?.rawText || ''}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    payload: { ...shot.payload, rawText: e.target.value },
                  })
                }
                placeholder="Enter payload contents (supports {{round}} tokens)..."
                className="w-full h-72 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-slate-200 outline-none focus:border-amber-500 leading-relaxed"
              />
            )}
          </div>
        )}

        {/* TRIGGERS VIEW */}
        {activeTab === 'triggers' && (
          <div className="grid grid-cols-4 gap-3 h-full">
            <div className="col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Pre-Request Script (Trigger)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Runs before Shot execution. Use <code className="text-amber-400">bullet.*</code> SDK.
                </span>
              </div>
              <textarea
                value={shot.triggerScript || ''}
                onChange={(e) => onChange({ ...shot, triggerScript: e.target.value })}
                placeholder="// Bullet Trigger Script (Jint JavaScript)
// Example:
bullet.rounds.set('reqTimestamp', Date.now().toString());
bullet.request.headers.add('X-Timestamp', bullet.rounds.get('reqTimestamp'));
bullet.console.log('Fired with timestamp');"
                className="w-full h-80 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-emerald-400 outline-none focus:border-amber-500"
              />
            </div>

            {/* Snippet Helper Column */}
            <div className="col-span-1 border-l border-bullet-border pl-3 flex flex-col gap-1.5">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Snippets
              </span>
              <button
                onClick={() => addTriggerSnippet("bullet.rounds.set('key', 'value');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Set round
              </button>
              <button
                onClick={() => addTriggerSnippet("var val = bullet.rounds.get('key');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Get round
              </button>
              <button
                onClick={() => addTriggerSnippet("bullet.request.headers.add('X-Custom-Header', 'custom-value');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Add header
              </button>
              <button
                onClick={() => addTriggerSnippet("bullet.console.log('Trajectory checkpoint reached');")}
                className="text-left text-xs font-mono text-slate-300 hover:text-amber-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Log message
              </button>
            </div>
          </div>
        )}

        {/* VERIFIERS VIEW */}
        {activeTab === 'verifiers' && (
          <div className="grid grid-cols-4 gap-3 h-full">
            <div className="col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Post-Response Assertions (Verifier)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Assert HTTP responses. Use <code className="text-amber-400">bullet.test(...)</code> and <code className="text-amber-400">bullet.expect(...)</code>.
                </span>
              </div>
              <textarea
                value={shot.verifierScript || ''}
                onChange={(e) => onChange({ ...shot, verifierScript: e.target.value })}
                placeholder="// Bullet Verifier Script (API Tests)
bullet.test('Status code is 200', function() {
    bullet.expect(bullet.response.status).toBe(200);
});

bullet.test('Response time is under 500ms', function() {
    bullet.expect(bullet.response.responseTime).toBeLessThan(500);
});

bullet.test('Body contains token', function() {
    var json = bullet.response.json();
    bullet.expect(json.token).toBeDefined();
    bullet.rounds.set('authToken', json.token);
});"
                className="w-full h-80 bg-bullet-surface border border-bullet-border rounded p-3 font-mono text-xs text-amber-300 outline-none focus:border-amber-500"
              />
            </div>

            {/* Snippet Helper Column */}
            <div className="col-span-1 border-l border-bullet-border pl-3 flex flex-col gap-1.5">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Assertion Snippets
              </span>
              <button
                onClick={() => addVerifierSnippet("bullet.test('Status is 200 OK', function() {\n  bullet.expect(bullet.response.status).toBe(200);\n});")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Status is 200
              </button>
              <button
                onClick={() => addVerifierSnippet("bullet.test('Response time < 200ms', function() {\n  bullet.expect(bullet.response.responseTime).toBeLessThan(200);\n});")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Response time &lt; 200ms
              </button>
              <button
                onClick={() => addVerifierSnippet("bullet.test('JSON field value check', function() {\n  var data = bullet.response.json();\n  bullet.expect(data.status).toBe('active');\n});")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + JSON field check
              </button>
              <button
                onClick={() => addVerifierSnippet("// Extract token to round\nvar data = bullet.response.json();\nbullet.rounds.set('jwtToken', data.token);")}
                className="text-left text-xs font-mono text-slate-300 hover:text-emerald-400 p-1.5 rounded hover:bg-bullet-surface border border-bullet-border"
              >
                + Extract token to round
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-xl">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
              Shot Execution Settings
            </span>

            <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
              <div>
                <div className="text-xs font-medium text-slate-200">Timeout (Milliseconds)</div>
                <div className="text-[11px] text-slate-400">Maximum duration before request aborts</div>
              </div>
              <input
                type="number"
                value={shot.settings?.timeoutMs || 30000}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    settings: { ...shot.settings, timeoutMs: parseInt(e.target.value) || 30000 },
                  })
                }
                className="w-24 p-1.5 bg-bullet-bg border border-bullet-border rounded font-mono text-xs text-slate-200 outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
              <div>
                <div className="text-xs font-medium text-slate-200">Follow HTTP Redirects</div>
                <div className="text-[11px] text-slate-400">Automatically follow 3xx redirect chains</div>
              </div>
              <input
                type="checkbox"
                checked={shot.settings?.followRedirects ?? true}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    settings: { ...shot.settings, followRedirects: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-amber-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bullet-surface border border-bullet-border rounded">
              <div>
                <div className="text-xs font-medium text-slate-200">Verify TLS / SSL Certificate</div>
                <div className="text-[11px] text-slate-400">Reject invalid, self-signed, or expired server certificates</div>
              </div>
              <input
                type="checkbox"
                checked={shot.settings?.verifyTls ?? true}
                onChange={(e) =>
                  onChange({
                    ...shot,
                    settings: { ...shot.settings, verifyTls: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-amber-500"
              />
            </div>

            {/* SSRF Guard Bypass toggle */}
            <div className={`p-3 border rounded transition ${
              shot.settings?.bypassSsrfGuard
                ? 'bg-rose-950/20 border-rose-500/50'
                : 'bg-bullet-surface border-bullet-border'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className={`w-4 h-4 ${shot.settings?.bypassSsrfGuard ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-medium text-slate-200">Bypass SSRF Protection</span>
                </div>
                <input
                  type="checkbox"
                  checked={shot.settings?.bypassSsrfGuard ?? false}
                  onChange={(e) =>
                    onChange({
                      ...shot,
                      settings: { ...shot.settings, bypassSsrfGuard: e.target.checked },
                    })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Bullet SSRF Guard blocks private IPs (127.0.0.1, 10.x, 192.168.x) and cloud metadata services by default. Only enable this if firing against local development services.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
