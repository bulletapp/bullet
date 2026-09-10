import React, { useState, useEffect } from 'react';
import { Cookie, Trash2, RefreshCw, Lock, Globe } from 'lucide-react';
import { CookieRecord } from '../../types/bullet';
import { bulletApi } from '../../api/bulletApi';

export const CookieLockerView: React.FC = () => {
  const [cookies, setCookies] = useState<CookieRecord[]>([]);
  const [domainFilter, setDomainFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCookies = async () => {
    setIsLoading(true);
    try {
      const list = await bulletApi.getCookies(domainFilter || undefined);
      setCookies(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCookies();
  }, [domainFilter]);

  const handleDelete = async (id: string) => {
    try {
      await bulletApi.deleteCookie(id);
      fetchCookies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all stored cookies from the Cookie Locker?')) return;
    try {
      await bulletApi.clearCookies(domainFilter || undefined);
      fetchCookies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cookie className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm text-slate-100">Cookie Locker</span>
          <span className="text-[10px] text-slate-500 uppercase">Domain Session Storage</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by domain..."
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="p-1.5 bg-bullet-surface border border-bullet-border rounded text-slate-200 outline-none w-44 focus:border-amber-500"
          />
          <button
            onClick={fetchCookies}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Locker</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="border border-bullet-border rounded overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400">
                <th className="px-3 py-2 w-1/4">Domain</th>
                <th className="px-3 py-2 w-1/4">Name</th>
                <th className="px-3 py-2 w-1/3">Value</th>
                <th className="px-3 py-2 w-16 text-center">Secure</th>
                <th className="px-3 py-2 w-16 text-center">HttpOnly</th>
                <th className="w-8 px-2 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {cookies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No cookies stored in the Cookie Locker. Fired requests with Set-Cookie will automatically persist here.
                  </td>
                </tr>
              ) : (
                cookies.map((c) => (
                  <tr key={c.id} className="border-b border-bullet-border/40 hover:bg-bullet-surface/50">
                    <td className="px-3 py-2 text-cyan-400 font-medium">{c.domain}</td>
                    <td className="px-3 py-2 text-amber-400 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-slate-200 select-text truncate max-w-xs">{c.value}</td>
                    <td className="px-3 py-2 text-center">{c.isSecure ? '✓' : '-'}</td>
                    <td className="px-3 py-2 text-center">{c.isHttpOnly ? '✓' : '-'}</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
