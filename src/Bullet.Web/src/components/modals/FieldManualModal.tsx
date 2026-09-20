import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, BookOpen, FileText } from 'lucide-react';

interface FieldManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  arsenalId: string | null;
  arsenalName: string;
}

export const FieldManualModal: React.FC<FieldManualModalProps> = ({
  isOpen,
  onClose,
  arsenalId,
  arsenalName,
}) => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');

  useEffect(() => {
    if (isOpen && arsenalId) {
      loadManual(arsenalId, format);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, arsenalId, format]);

  const loadManual = async (id: string, fmt: 'markdown' | 'json') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/field-manual/${id}?format=${fmt}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to generate Field Manual.`);
      if (fmt === 'markdown') {
        const text = await res.text();
        setMarkdownContent(text);
      } else {
        const json = await res.json();
        setMarkdownContent(JSON.stringify(json, null, 2));
      }
    } catch (err: any) {
      setMarkdownContent(`# Error Generating Documentation\n\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !arsenalId) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = format === 'markdown' ? 'md' : 'json';
    const mime = format === 'markdown' ? 'text/markdown' : 'application/json';
    const blob = new Blob([markdownContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${arsenalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-manual.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span className="font-mono text-sm font-bold text-slate-100">Arsenal Field Manual</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {arsenalName}
            </span>
          </div>
          <button
            data-testid="field-manual-close-x"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-bullet-border bg-bullet-panel text-xs font-mono">
          <button
            data-testid="field-manual-format-md"
            onClick={() => setFormat('markdown')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
              format === 'markdown'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Markdown (.md)
          </button>
          <button
            data-testid="field-manual-format-json"
            onClick={() => setFormat('json')}
            className={`px-2.5 py-1 rounded transition ${
              format === 'json'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            JSON Spec
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 bg-bullet-bg overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
              Generating API documentation...
            </div>
          ) : (
            <pre
              data-testid="field-manual-content"
              className="p-4 bg-bullet-surface border border-bullet-border rounded font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed select-text"
            >
              {markdownContent}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-bullet-border bg-bullet-panel flex items-center justify-between font-mono text-xs">
          <button
            data-testid="field-manual-close-btn"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              data-testid="field-manual-copy-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>

            <button
              onClick={handleDownload}
              data-testid="field-manual-download-btn"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-purple-500 hover:bg-purple-400 text-white font-bold shadow transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
