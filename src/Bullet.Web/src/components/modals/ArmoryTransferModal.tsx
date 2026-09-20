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
  initialContent?: string;
}

export const ArmoryTransferModal: React.FC<ArmoryTransferModalProps> = ({
  isOpen,
  onClose,
  rangeId,
  arsenals,
  onImportSuccess,
  initialContent,
}) => {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [importFormat, setImportFormat] = useState<'postman' | 'postman-env' | 'openapi' | 'curl' | 'native'>('postman');
  const [importContent, setImportContent] = useState('');
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const [isHoveringDropzone, setIsHoveringDropzone] = useState(false);
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

  React.useEffect(() => {
    if (isOpen && initialContent) {
      handleContentChange(initialContent);
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  const detectFormat = (content: string): 'postman' | 'postman-env' | 'openapi' | 'curl' | 'native' | null => {
    const trimmed = content.trim();
    if (trimmed.startsWith('curl ') || trimmed.startsWith('curl\n') || trimmed.startsWith('curl\r\n')) {
      return 'curl';
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed._postman_variable_scope === 'environment' || (parsed.values && Array.isArray(parsed.values) && parsed.name)) {
        return 'postman-env';
      }
      if (parsed.info?.schema?.includes('postman') || (parsed.info && parsed.item)) {
        return 'postman';
      }
      if (parsed.openapi || parsed.swagger) {
        return 'openapi';
      }
      if (parsed.arsenal || parsed.shots) {
        return 'native';
      }
    } catch {
      if (trimmed.includes('openapi:') || trimmed.includes('swagger:')) {
        return 'openapi';
      }
    }
    return null;
  };

  const handleContentChange = (content: string) => {
    setImportContent(content);
    const detected = detectFormat(content);
    if (detected) {
      setImportFormat(detected);
      const labels: Record<string, string> = {
        postman: 'Postman Collection v2.1',
        'postman-env': 'Postman Environment',
        openapi: 'OpenAPI Specification',
        curl: 'cURL Command',
        native: 'Native Bullet Format',
      };
      setAutoDetected(labels[detected] || null);
    } else {
      setAutoDetected(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      handleContentChange(text);
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
        setStatusMsg({ type: 'success', text: 'Native collection imported successfully!' });
      } else if (importFormat === 'postman') {
        await bulletApi.importPostman(rangeId, importContent);
        setStatusMsg({ type: 'success', text: 'Postman collection imported successfully!' });
      } else if (importFormat === 'postman-env') {
        await bulletApi.importPostmanEnvironment(rangeId, importContent);
        setStatusMsg({ type: 'success', text: 'Postman environment imported successfully into Loadouts!' });
      } else if (importFormat === 'openapi') {
        await bulletApi.importOpenApi(rangeId, importContent);
        setStatusMsg({ type: 'success', text: 'OpenAPI specification imported successfully!' });
      } else if (importFormat === 'curl') {
        if (!exportArsenalId) {
          throw new Error('Please select an Arsenal to import the cURL command into.');
        }
        await bulletApi.importCurl(exportArsenalId, importContent);
        setStatusMsg({ type: 'success', text: 'cURL command imported successfully into Arsenal!' });
      }

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
            <Upload className="w-4 h-4 text-amber-400" />
            <span className="font-mono text-sm font-bold text-slate-100">Import & Export</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
              Postman • OpenAPI • cURL • Native
            </span>
          </div>
          <button data-testid="armory-transfer-close-x" onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800">
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
            Import Into Bullet
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Import Format:</span>
                  {autoDetected && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ Auto-detected: {autoDetected}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { id: 'postman', label: 'Postman Collection v2.1' },
                    { id: 'postman-env', label: 'Postman Environment' },
                    { id: 'openapi', label: 'OpenAPI 3.0' },
                    { id: 'curl', label: 'cURL Command' },
                    { id: 'native', label: 'Native .bullet.json' },
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
                      <span className={importFormat === f.id ? 'text-amber-400 font-medium' : 'text-slate-400'}>
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

              {/* Drag and Drop Zone */}
              <div
                data-testid="import-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsHoveringDropzone(true);
                }}
                onDragLeave={() => setIsHoveringDropzone(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsHoveringDropzone(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      handleContentChange((ev.target?.result as string) || '');
                    };
                    reader.readAsText(file);
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-3 text-center transition cursor-pointer ${
                  isHoveringDropzone
                    ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                    : 'border-bullet-border hover:border-slate-600 bg-bullet-bg/40 text-slate-400'
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <div className="text-xs font-medium text-slate-200">
                  Drag & drop Postman Collection (.json) or Environment file here
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  or choose a file / paste JSON into the editor below
                </div>
              </div>

              <textarea
                value={importContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder={
                  importFormat === 'curl'
                    ? "curl -X POST https://api.example.com/data -H 'Content-Type: application/json' -d '{\"foo\":\"bar\"}'"
                    : importFormat === 'postman-env'
                    ? "Paste Postman Environment JSON here..."
                    : "Paste Postman Collection v2.1, OpenAPI JSON/YAML, or Bullet JSON here..."
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
            data-testid="armory-transfer-close-btn"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-xs border border-slate-700"
          >
            Close
          </button>

          {tab === 'import' && (
            <button
              data-testid="execute-import-btn"
              onClick={handleImport}
              disabled={isProcessing || !importContent.trim()}
              className="px-5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs shadow-md shadow-amber-500/10 cursor-pointer"
            >
              {isProcessing ? 'IMPORTING...' : 'IMPORT INTO BULLET'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
