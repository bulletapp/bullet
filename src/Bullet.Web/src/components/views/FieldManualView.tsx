import React from 'react';
import { BookOpen, Crosshair, Terminal, ShieldAlert, Code2, Layers } from 'lucide-react';

export const FieldManualView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-bullet-panel select-none overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-bullet-border px-4 flex items-center justify-between bg-bullet-bg flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-sm text-slate-100">Field Manual</span>
          <span className="text-[10px] text-slate-500 uppercase">Architecture & SDK Reference</span>
        </div>
      </div>

      {/* Manual Content */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-4xl text-slate-300 select-text leading-relaxed">
        {/* Core Philosophy */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
            <Crosshair className="w-4 h-4" />
            <span>BULLET: Load. Aim. API.</span>
          </div>
          <p className="text-slate-400 text-xs">
            Bullet is a modern, developer-first alternative to traditional bloated API clients. Built on .NET 10, C# 13, and React 19, Bullet delivers sandboxed JavaScript scripting (Jint 4.16.2), automated SSRF protection, mTLS client certificates, high-speed automated test runners, and a unified CLI for CI/CD pipelines.
          </p>
        </section>

        {/* Terminology Matrix */}
        <section className="space-y-2">
          <span className="text-sm font-bold text-slate-100 uppercase tracking-wider block">
            Product Terminology Matrix
          </span>
          <div className="border border-bullet-border rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bullet-bg border-b border-bullet-border text-slate-400">
                  <th className="px-3 py-2 w-1/3">Bullet Term</th>
                  <th className="px-3 py-2 w-1/3">Traditional Term</th>
                  <th className="px-3 py-2">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bullet-border/40">
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Range</td>
                  <td className="px-3 py-1.5 text-slate-400">Workspace</td>
                  <td className="px-3 py-1.5 text-slate-300">Top-level project boundary containing Arsenals & Loadouts.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Arsenal</td>
                  <td className="px-3 py-1.5 text-slate-400">Collection</td>
                  <td className="px-3 py-1.5 text-slate-300">Group of related requests and test suites.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Squad</td>
                  <td className="px-3 py-1.5 text-slate-400">Folder</td>
                  <td className="px-3 py-1.5 text-slate-300">Sub-folder within an Arsenal for modular hierarchy.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Shot</td>
                  <td className="px-3 py-1.5 text-slate-400">Request</td>
                  <td className="px-3 py-1.5 text-slate-300">An individual HTTP/REST call definition.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Loadout</td>
                  <td className="px-3 py-1.5 text-slate-400">Environment</td>
                  <td className="px-3 py-1.5 text-slate-300">Set of variable rounds (e.g. dev, staging, prod).</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Round</td>
                  <td className="px-3 py-1.5 text-slate-400">Variable</td>
                  <td className="px-3 py-1.5 text-slate-300">Key-value token referenced via <code className="text-amber-400">{'{{round}}'}</code>.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Trigger</td>
                  <td className="px-3 py-1.5 text-slate-400">Pre-request Script</td>
                  <td className="px-3 py-1.5 text-slate-300">JavaScript executing prior to Shot dispatch.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Verifier</td>
                  <td className="px-3 py-1.5 text-slate-400">Test Script</td>
                  <td className="px-3 py-1.5 text-slate-300">JavaScript executing assertions on response impact.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Armor</td>
                  <td className="px-3 py-1.5 text-slate-400">Authorization</td>
                  <td className="px-3 py-1.5 text-slate-300">Authentication schemes (Bearer, Basic, API Key, AWS SigV4).</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Firing Run</td>
                  <td className="px-3 py-1.5 text-slate-400">Collection Runner</td>
                  <td className="px-3 py-1.5 text-slate-300">Automated sequential/data-driven test runner.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Bulletproof TLS</td>
                  <td className="px-3 py-1.5 text-slate-400">Certificates</td>
                  <td className="px-3 py-1.5 text-slate-300">Client mTLS certificates, custom CA bundles, and TLS versions.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Target Range</td>
                  <td className="px-3 py-1.5 text-slate-400">Mock Server</td>
                  <td className="px-3 py-1.5 text-slate-300">Deterministic mock endpoints with simulated latency.</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-bold text-amber-400">Sentinel</td>
                  <td className="px-3 py-1.5 text-slate-400">Monitor</td>
                  <td className="px-3 py-1.5 text-slate-300">Scheduled automated health check worker.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Script SDK */}
        <section className="space-y-2">
          <span className="text-sm font-bold text-slate-100 uppercase tracking-wider block">
            Script Sandbox SDK (<code className="text-amber-400">bullet.*</code>)
          </span>
          <p className="text-slate-400 text-xs">
            Bullet uses an isolated, memory-bounded (10MB), and time-limited (3s) Jint JavaScript engine:
          </p>

          <pre className="p-3 bg-bullet-bg border border-bullet-border rounded text-slate-200 text-xs leading-relaxed">
{`// 1. Reading & Setting Rounds (Variables)
bullet.rounds.set('jwt', 'eyJhbGci...');
var token = bullet.rounds.get('jwt');

// 2. Modifying Outgoing Requests (in Triggers)
bullet.request.headers.add('X-Custom-Timestamp', Date.now().toString());

// 3. Inspecting Responses (in Verifiers)
var status = bullet.response.status;         // e.g. 200
var duration = bullet.response.responseTime; // in milliseconds
var data = bullet.response.json();           // parsed JSON body

// 4. Assertions & Testing
bullet.test('Returns active status', function() {
    bullet.expect(bullet.response.status).toBe(200);
    bullet.expect(data.status).toBe('active');
    bullet.expect(bullet.response.responseTime).toBeLessThan(500);
});

// 5. Crypto Utilities
var hash = bullet.crypto.sha256('message');
var b64 = bullet.crypto.base64Encode('user:pass');`}
          </pre>
        </section>

        {/* CLI Usage */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-slate-100 text-sm font-bold uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Bullet CLI for CI / CD Pipelines</span>
          </div>
          <p className="text-slate-400 text-xs">
            Run automated test suites directly from your GitHub Actions, GitLab CI, or terminal:
          </p>
          <pre className="p-3 bg-bullet-bg border border-bullet-border rounded text-cyan-300 text-xs leading-relaxed">
{`# Run full Arsenal test suite with JUnit XML export
bullet arsenal run ./users.bullet.json --report junit --output ./results.xml

# Run with custom environment loadout and delay
bullet arsenal run ./api.bullet.json --loadout Production --delay 100 --stop-on-error`}
          </pre>
        </section>
      </div>
    </div>
  );
};
