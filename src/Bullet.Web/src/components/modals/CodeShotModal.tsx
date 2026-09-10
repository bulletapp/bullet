import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Code2 } from 'lucide-react';
import { Shot } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

interface CodeShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot | null;
}

const LANGUAGES = [
  { id: 'curl', label: 'cURL' },
  { id: 'typescript', label: 'TypeScript (fetch)' },
  { id: 'javascript', label: 'JavaScript (axios)' },
  { id: 'python', label: 'Python (requests)' },
  { id: 'csharp', label: 'C# (HttpClient)' },
  { id: 'go', label: 'Go (net/http)' },
  { id: 'rust', label: 'Rust (reqwest)' },
  { id: 'java', label: 'Java (HttpClient)' },
  { id: 'php', label: 'PHP (cURL)' },
  { id: 'ruby', label: 'Ruby (Net::HTTP)' },
];

export const CodeShotModal: React.FC<CodeShotModalProps> = ({ isOpen, onClose, shot }) => {
  const [selectedLang, setSelectedLang] = useState('curl');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && shot) {
      loadCode(selectedLang);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedLang, shot]);

  const loadCode = async (lang: string) => {
    if (!shot) return;
    setIsLoading(true);
    try {
      const res = await bulletApi.generateCode(shot, lang);
      setGeneratedCode(res.code);
    } catch (err: any) {
      setGeneratedCode(`// Error generating snippet: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !shot) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl bg-bullet-panel border border-bullet-border rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bullet-border bg-bullet-bg">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-sm font-bold text-slate-100">Code Shot</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {shot.name}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-bullet-border bg-bullet-panel overflow-x-auto text-xs font-mono">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLang(l.id)}
              className={`px-2.5 py-1 rounded transition whitespace-nowrap ${
                selectedLang === l.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 bg-bullet-bg overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-500 font-mono text-xs">
              Generating code snippet...
            </div>
          ) : (
            <pre className="p-4 bg-bullet-surface border border-bullet-border rounded font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed select-text">
              {generatedCode}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-bullet-border bg-bullet-panel flex items-center justify-between font-mono text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
          >
            Close
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY CODE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
