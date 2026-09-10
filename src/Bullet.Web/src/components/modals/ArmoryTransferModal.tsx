import React, { useState } from 'react';
import { X, Download, Upload, Copy, Check, FileJson, AlertCircle } from 'lucide-react';
import { Arsenal } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface ArmoryTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  rangeId: string;
  arsenals: Arsenal[];
  onImportSuccess: () => void;
}

export const ArmoryTransferModal: React.FC<ArmoryTransferModalProps> = ({
  isOpen,
  onClose,
  rangeId,
  arsenals,
  onImportSuccess,
}) => {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [importFormat, setImportFormat] = useState<'native' | 'postman' | 'openapi' | 'curl'>('native');
  const [importContent, setImportContent] = useState('');
  const [exportArsenalId, setExportArsenalId] = useState(arsenals[0]?.id || '');
  const [exportFormat, setExportFormat] = useState<'native' | 'openapi'>('native');
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [exportOutput, setExportOutput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (isOpen && arsenals.length > 0) {
      if (!exportArsenalId || !arsenals.some((a) => a.id === exportArsenalId)) {
        setExportArsenalId(arsenals[0].id);
      }
    }
  }, [isOpen, arsenals]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportContent((ev.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importContent.trim()) {
      setStatusMsg({ type: 'error', text: 'Please paste or upload content to import.' });
      return;
    }

    setIsProcessing(true);
    setStatusMsg(null);
    try {
      if (importFormat === 'native') {
        await bulletApi.importNative(rangeId, importContent);
      } else if (importFormat === 'postman') {
        await bulletApi.importPostman(rangeId, importContent);
      } else if (importFormat === 'openapi') {
        await bulletApi.importOpenApi(rangeId, importContent);
      } else if (importFormat === 'curl') {
        if (!exportArsenalId) {
          throw new Error('Please select an Arsenal to import the cURL command into.');
        }
        await bulletApi.importCurl(exportArsenalId, importContent);
      }

      setStatusMsg({ type: 'success', text: 'Armory transfer import successful!' });
      onImportSuccess();
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Import failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!exportArsenalId) return;
    setIsProcessing(true);
    setStatusMsg(null);
    try {
      let output = '';
      if (exportFormat === 'native') {
        output = await bulletApi.exportNative(exportArsenalId, includeSecrets);
      } else {
        output = await bulletApi.exportOpenApi(exportArsenalId);
      }
      setExportOutput(output);
      setStatusMsg({ type: 'success', text: 'Export generated successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Export failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-sm font-bold text-slate-100">Armory Transfer</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
              Import & Export
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-bullet-border bg-bullet-panel text-xs font-mono">
          <button
            onClick={() => { setTab('import'); setStatusMsg(null); }}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              tab === 'import'
                ? 'border-amber-400 text-amber-400 font-bold bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Import Into Range
          </button>
          <button
            onClick={() => { setTab('export'); setStatusMsg(null); }}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              tab === 'export'
                ? 'border-amber-400 text-amber-400 font-bold bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Export From Arsenal
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
          {statusMsg && (
            <div className={`p-2.5 rounded border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {tab === 'import' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Import Format:</span>
                <div className="flex items-center gap-3">
                  {[
                    { id: 'native', label: 'Native .bullet.json' },
                    { id: 'postman', label: 'Postman v2.1' },
                    { id: 'openapi', label: 'OpenAPI 3.0' },
                    { id: 'curl', label: 'cURL Command' },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="importFormat"
                        value={f.id}
                        checked={importFormat === f.id}
                        onChange={() => setImportFormat(f.id as any)}
                        className="text-amber-500"
                      />
                      <span className={importFormat === f.id ? 'text-amber-400' : 'text-slate-400'}>
                        {f.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {importFormat === 'curl' && (
                <div>
                  <label className="text-slate-400 block mb-1">Target Arsenal for cURL Shot:</label>
                  <select
                    value={exportArsenalId}
                    onChange={(e) => setExportArsenalId(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    {arsenals.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Paste definition or upload file:</span>
                <label className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 cursor-pointer text-[11px]">
                  Upload File
                  <input type="file" accept=".json,.yaml,.yml,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder={
                  importFormat === 'curl'
                    ? "curl -X POST https://api.example.com/data -H 'Content-Type: application/json' -d '{\"foo\":\"bar\"}'"
                    : "Paste JSON/YAML content here..."
                }
                className="w-full h-56 bg-bullet-surface border border-bullet-border rounded p-3 text-slate-200 outline-none focus:border-amber-500 font-mono text-xs leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 block mb-1">Source Arsenal:</label>
                  <select
                    value={exportArsenalId}
                    onChange={(e) => setExportArsenalId(e.target.value)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    {arsenals.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Export Format:</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="w-full p-2 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none"
                  >
                    <option value="native">Native Bullet (.bullet.json)</option>
                    <option value="openapi">OpenAPI 3.0 Specification</option>
                  </select>
                </div>
              </div>

              {exportFormat === 'native' && (
                <div className="p-2.5 bg-bullet-surface border border-bullet-border rounded flex items-center justify-between">
                  <div>
                    <div className="text-slate-200">Include Secret Rounds</div>
                    <div className="text-[11px] text-slate-500">
                      Excluded by default for safety. Passwords & keys will be omitted if unchecked.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeSecrets}
                    onChange={(e) => setIncludeSecrets(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500"
                  />
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={isProcessing || !exportArsenalId}
                className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-bold"
              >
                {isProcessing ? 'Generating Export...' : 'Generate Export'}
              </button>

              {exportOutput && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Export Result:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(exportOutput);
                          setStatusMsg({ type: 'success', text: 'Copied export to clipboard!' });
                        }}
                        className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                      <button
                        onClick={() =>
                          downloadFile(
                            exportOutput,
                            exportFormat === 'native' ? 'export.bullet.json' : 'openapi.json'
                          )
                        }
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-1 bg-slate-800 rounded border border-slate-700"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={exportOutput}
                    className="w-full h-44 bg-bullet-surface border border-bullet-border rounded p-3 text-slate-300 font-mono text-[11px] outline-none select-text"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-bullet-border bg-bullet-bg flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-xs border border-slate-700"
          >
            Close
          </button>

          {tab === 'import' && (
            <button
              onClick={handleImport}
              disabled={isProcessing || !importContent.trim()}
              className="px-5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs shadow-md shadow-amber-500/10"
            >
              {isProcessing ? 'IMPORTING...' : 'IMPORT TO ARMORY'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
