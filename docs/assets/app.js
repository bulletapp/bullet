// BULLET - Load. Aim. API. Interactive Engine

document.addEventListener('DOMContentLoaded', () => {
  initShotSimulator();
  initPlatformTabs();
  initGalleryTabs();
  initSnippetTabs();
  initCopyButtons();
  initMobileMenu();
});

// 1. Live Shot Simulator
const PRESETS = {
  telemetry: {
    method: 'GET',
    url: 'https://api.bullet.dev/v1/telemetry/sample',
    status: '200 OK',
    time: '8.4 ms',
    size: '1.42 KB',
    waterfall: { dns: 0.8, tcp: 1.2, tls: 2.1, ttfb: 3.8, transfer: 0.5 },
    body: {
      status: "bullet_hit",
      target: "api.bullet.dev",
      engine: ".NET 10 Kestrel Ballistic Core",
      protocol: "HTTP/2 (h2) TLS 1.3",
      telemetry: {
        nanoseconds: 8421900,
        dns_resolution_ms: 0.82,
        tcp_handshake_ms: 1.18,
        tls_handshake_ms: 2.14,
        time_to_first_byte_ms: 3.76,
        content_transfer_ms: 0.52
      },
      ssrf_protection: "ACTIVE (Non-routable ranges filtered)",
      security: {
        cipher_suite: "TLS_AES_256_GCM_SHA384",
        alpn: "h2",
        cert_valid_days: 89
      }
    },
    assertions: [
      { name: "Status code is 200 OK", passed: true, time: "0.1ms" },
      { name: "Total latency < 50ms (Actual: 8.4ms)", passed: true, time: "0.2ms" },
      { name: "TLS 1.3 negotiation verified", passed: true, time: "0.1ms" },
      { name: "SSRF verification passed for public domain", passed: true, time: "0.1ms" }
    ],
    headers: {
      "content-type": "application/json; charset=utf-8",
      "server": "Kestrel-Bullet/1.0",
      "x-bullet-latency": "8.42ms",
      "x-ssrf-guard": "enforced-pass",
      "cache-control": "no-store"
    }
  },
  fire: {
    method: 'POST',
    url: 'https://api.bullet.dev/v1/bullets/fire',
    status: '201 CREATED',
    time: '12.1 ms',
    size: '890 B',
    waterfall: { dns: 0.9, tcp: 1.4, tls: 2.4, ttfb: 6.8, transfer: 0.6 },
    body: {
      shot_id: "shot_9c2a8f01b5",
      caliber: "5.56 NATO (JSON Payload)",
      status: "dispatched",
      target_response_time_ms: 12.1,
      script_hooks: {
        pre_request: "executed in Jint ES6 isolate (0.4ms)",
        test_assertions: "3 passed, 0 failed"
      },
      payload_hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    assertions: [
      { name: "Status code is 201 Created", passed: true, time: "0.1ms" },
      { name: "Shot ID returned with valid prefix", passed: true, time: "0.1ms" },
      { name: "Pre-request signature injected into header", passed: true, time: "0.2ms" }
    ],
    headers: {
      "content-type": "application/json",
      "x-bullet-shot-id": "shot_9c2a8f01b5",
      "x-bullet-latency": "12.1ms"
    }
  },
  github: {
    method: 'GET',
    url: 'https://api.github.com/repos/bulletapp/bullet',
    status: '200 OK',
    time: '24.6 ms',
    size: '3.18 KB',
    waterfall: { dns: 1.2, tcp: 2.8, tls: 5.4, ttfb: 14.2, transfer: 1.0 },
    body: {
      name: "bullet",
      full_name: "bulletapp/bullet",
      description: "BULLET: Load. Aim. API. Ultra-fast sub-millisecond API weapon built with .NET 10 & React 19.",
      html_url: "https://github.com/bulletapp/bullet",
      license: "MIT License",
      language: "C# / TypeScript",
      latest_release: "v0.0.2",
      platforms: ["Windows x64", "macOS Apple Silicon (arm64)", "macOS Intel (x64)", "Docker Linux", "PWA Standalone"]
    },
    assertions: [
      { name: "Repository name is 'bullet'", passed: true, time: "0.1ms" },
      { name: "Owner matches bulletapp", passed: true, time: "0.1ms" },
      { name: "License is MIT", passed: true, time: "0.1ms" }
    ],
    headers: {
      "content-type": "application/json; charset=utf-8",
      "server": "GitHub.com",
      "x-ratelimit-remaining": "59"
    }
  },
  ssrf: {
    method: 'GET',
    url: 'http://169.254.169.254/latest/meta-data/',
    status: '403 FORBIDDEN',
    time: '0.4 ms',
    size: '312 B',
    waterfall: { dns: 0.1, tcp: 0.0, tls: 0.0, ttfb: 0.3, transfer: 0.0 },
    body: {
      error: "SSRF_BLOCKED_BY_BULLET_GUARD",
      message: "Target IP [169.254.169.254] resides in prohibited cloud metadata / link-local subnet.",
      action_taken: "Connection aborted instantly before socket open.",
      defense_mode: "STRICT_LOOPBACK_AND_METADATA_GUARD",
      override_instructions: "Enable unsafe intranet probing under Settings -> Security if intentionally authorized."
    },
    assertions: [
      { name: "SSRF Guard blocked non-routable destination", passed: true, time: "0.0ms" },
      { name: "Socket prevented before SYN handshake", passed: true, time: "0.0ms" }
    ],
    headers: {
      "content-type": "application/json",
      "x-bullet-ssrf-defense": "BLOCKED_LINK_LOCAL"
    }
  }
};

let currentPreset = 'telemetry';
let activeResponseTab = 'body';

function initShotSimulator() {
  const fireBtn = document.getElementById('btn-fire-shot');
  const presetSelect = document.getElementById('simulator-preset');
  const methodBadge = document.getElementById('simulator-method');
  const urlInput = document.getElementById('simulator-url');

  if (!fireBtn) return;

  function applyPreset(key) {
    currentPreset = key;
    const data = PRESETS[key];
    if (!data) return;

    methodBadge.textContent = data.method;
    methodBadge.className = 'badge-method badge-' + data.method.toLowerCase();
    urlInput.value = data.url;
    renderResponse(data);
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      applyPreset(e.target.value);
    });
  }

  fireBtn.addEventListener('click', () => {
    // Firing recoil animation
    fireBtn.classList.add('scale-95');
    const statusPill = document.getElementById('sim-status-pill');
    if (statusPill) statusPill.textContent = 'CONNECTING...';

    setTimeout(() => {
      fireBtn.classList.remove('scale-95');
      const data = PRESETS[currentPreset];
      renderResponse(data);
    }, 180);
  });

  // Response Subtabs
  document.querySelectorAll('.sim-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.sim-tab-btn').forEach(b => {
        b.classList.remove('active', 'border-amber-500', 'text-amber-400');
        b.classList.add('border-transparent', 'text-slate-400');
      });
      const target = e.currentTarget.dataset.tab;
      activeResponseTab = target;
      e.currentTarget.classList.add('active', 'border-amber-500', 'text-amber-400');
      e.currentTarget.classList.remove('border-transparent', 'text-slate-400');
      
      document.querySelectorAll('.sim-tab-content').forEach(c => c.classList.add('hidden'));
      const activeContent = document.getElementById('sim-content-' + target);
      if (activeContent) activeContent.classList.remove('hidden');
    });
  });

  // Initial render
  applyPreset('telemetry');
}

function renderResponse(data) {
  const statusPill = document.getElementById('sim-status-pill');
  const timePill = document.getElementById('sim-time-pill');
  const sizePill = document.getElementById('sim-size-pill');
  const bodyViewer = document.getElementById('sim-json-body');
  const assertionsContainer = document.getElementById('sim-assertions-list');
  const headersContainer = document.getElementById('sim-headers-list');

  if (statusPill) {
    statusPill.textContent = data.status;
    if (data.status.startsWith('20')) {
      statusPill.className = 'px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    } else {
      statusPill.className = 'px-2.5 py-1 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
    }
  }

  if (timePill) timePill.textContent = data.time;
  if (sizePill) sizePill.textContent = data.size;

  // JSON Body formatting
  if (bodyViewer) {
    bodyViewer.innerHTML = syntaxHighlight(JSON.stringify(data.body, null, 2));
  }

  // Waterfall bars
  const total = data.waterfall.dns + data.waterfall.tcp + data.waterfall.tls + data.waterfall.ttfb + data.waterfall.transfer || 1;
  setWaterfallBar('bar-dns', 'val-dns', data.waterfall.dns, total);
  setWaterfallBar('bar-tcp', 'val-tcp', data.waterfall.tcp, total);
  setWaterfallBar('bar-tls', 'val-tls', data.waterfall.tls, total);
  setWaterfallBar('bar-ttfb', 'val-ttfb', data.waterfall.ttfb, total);
  setWaterfallBar('bar-transfer', 'val-transfer', data.waterfall.transfer, total);

  // Assertions
  if (assertionsContainer) {
    assertionsContainer.innerHTML = data.assertions.map(a => `
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
        <div class="flex items-center gap-2">
          <span class="text-emerald-400 text-sm font-bold">✓</span>
          <span class="text-xs text-slate-200 font-mono">${escapeHtml(a.name)}</span>
        </div>
        <span class="text-[11px] text-slate-400 font-mono">${a.time}</span>
      </div>
    `).join('');
  }

  // Headers
  if (headersContainer) {
    headersContainer.innerHTML = Object.entries(data.headers).map(([k, v]) => `
      <div class="flex items-start justify-between py-1.5 border-b border-slate-800/60 font-mono text-xs">
        <span class="text-amber-400/90 font-medium">${escapeHtml(k)}:</span>
        <span class="text-slate-300 break-all pl-4 text-right">${escapeHtml(v)}</span>
      </div>
    `).join('');
  }
}

function setWaterfallBar(barId, valId, val, total) {
  const bar = document.getElementById(barId);
  const label = document.getElementById(valId);
  if (bar) {
    const pct = Math.max(5, Math.min(100, (val / total) * 100));
    bar.style.width = pct + '%';
  }
  if (label) {
    label.textContent = val.toFixed(1) + ' ms';
  }
}

function syntaxHighlight(json) {
  json = escapeHtml(json);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'text-amber-300'; // number
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-cyan-400 font-semibold'; // key
      } else {
        cls = 'text-emerald-300'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-purple-400 font-bold'; // boolean
    } else if (/null/.test(match)) {
      cls = 'text-rose-400'; // null
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 2. Platform Tabs
const PLATFORM_DATA = {
  windows: {
    title: "Windows 10 / 11 (x64)",
    badge: "Installer & Portable",
    desc: "Self-contained desktop application with native WebView2 runtime and microsecond SocketsHttpHandler.",
    primaryBtn: { text: "Download Setup (.exe)", url: "https://github.com/bulletapp/bullet/releases/download/v0.0.2/Bullet-Setup-v0.0.2.exe" },
    secondaryBtn: { text: "Portable (.zip)", url: "https://github.com/bulletapp/bullet/releases/download/v0.0.2/Bullet-Windows-Portable-v0.0.2.zip" },
    terminal: `# Install via PowerShell One-Liner
Invoke-WebRequest -Uri "https://github.com/bulletapp/bullet/releases/download/v0.0.2/Bullet-Setup-v0.0.2.exe" -OutFile "Bullet-Setup.exe"; .\Bullet-Setup.exe`
  },
  mac_arm: {
    title: "macOS Apple Silicon",
    badge: "Native ARM64 Universal",
    desc: "Optimized for Apple Silicon hardware acceleration with zero Rosetta emulation overhead.",
    primaryBtn: { text: "Download for Apple Silicon (.zip)", url: "https://github.com/bulletapp/bullet/releases/download/v0.0.2/Bullet-macOS-AppleSilicon-arm64.zip" },
    secondaryBtn: { text: "View macOS Guide", url: "https://github.com/bulletapp/bullet/blob/main/README.md#-macos-installation-apple-silicon--intel" },
    terminal: `# Quick Run via Terminal (Removes Gatekeeper quarantine)
unzip Bullet-macOS-AppleSilicon-arm64.zip
xattr -cr Bullet.app
open Bullet.app`
  },
  mac_intel: {
    title: "macOS Intel (x64)",
    badge: "Intel 64-bit Native",
    desc: "For Intel Core i5/i7/i9 MacBooks and iMacs running macOS 12+ (Monterey, Ventura, Sonoma, Sequoia).",
    primaryBtn: { text: "Download for Intel Mac (.zip)", url: "https://github.com/bulletapp/bullet/releases/download/v0.0.2/Bullet-macOS-Intel-x64.zip" },
    secondaryBtn: { text: "View macOS Guide", url: "https://github.com/bulletapp/bullet/blob/main/README.md#-macos-installation-apple-silicon--intel" },
    terminal: `# Quick Run for Intel Mac
unzip Bullet-macOS-Intel-x64.zip
xattr -cr Bullet.app
open Bullet.app`
  },
  docker: {
    title: "Docker Container (Linux / Cloud)",
    badge: "Headless & Web",
    desc: "Run BULLET in isolated containers on Linux, server farms, or Kubernetes with zero desktop overhead.",
    primaryBtn: { text: "GitHub Container Registry", url: "https://github.com/bulletapp/bullet/pkgs/container/bullet" },
    secondaryBtn: { text: "Docker Compose Guide", url: "https://github.com/bulletapp/bullet/blob/main/docs/CLI.md" },
    terminal: `# Pull & Run Bullet Container in 1 Command
docker run -d --name bullet-engine -p 5000:5000 ghcr.io/bulletapp/bullet:latest
# Then open http://localhost:5000 in any browser`
  },
  pwa: {
    title: "Progressive Web App (PWA)",
    badge: "Zero Install • Add to Dock",
    desc: "Run BULLET directly in Safari, Chrome, or Edge. Click 'Install' or 'Add to Dock' for a full offline desktop window.",
    primaryBtn: { text: "Open Web App (localhost:5000)", url: "http://localhost:5000" },
    secondaryBtn: { text: "Read PWA Guide", url: "https://github.com/bulletapp/bullet#standalone-web-app--pwa-macos-dock" },
    terminal: `# Start the local API server and launch your browser
dotnet run --project src/Bullet.Api
# Click the 'Install BULLET App' button in the top navigation bar!`
  },
  sdk: {
    title: ".NET 10 SDK & Source Build",
    badge: "Source Code",
    desc: "Full access to the .NET 10 Kestrel backend, Jint sandbox, and React 19 frontend codebase.",
    primaryBtn: { text: "Clone Repository", url: "https://github.com/bulletapp/bullet" },
    secondaryBtn: { text: "Architecture Spec", url: "https://github.com/bulletapp/bullet/blob/main/docs/ARCHITECTURE.md" },
    terminal: `git clone https://github.com/bulletapp/bullet.git
cd bullet
dotnet run --project src/Bullet.Api`
  }
};

function initPlatformTabs() {
  const tabs = document.querySelectorAll('.platform-tab-btn');
  const cardTitle = document.getElementById('platform-card-title');
  const cardBadge = document.getElementById('platform-card-badge');
  const cardDesc = document.getElementById('platform-card-desc');
  const cardPrimary = document.getElementById('platform-card-primary');
  const cardSecondary = document.getElementById('platform-card-secondary');
  const cardTerminal = document.getElementById('platform-card-terminal');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('active', 'bg-amber-500/20', 'text-amber-400', 'border-amber-500/40');
        t.classList.add('bg-slate-900/60', 'text-slate-300', 'border-slate-800');
      });

      const key = e.currentTarget.dataset.platform;
      const data = PLATFORM_DATA[key];
      if (!data) return;

      e.currentTarget.classList.add('active', 'bg-amber-500/20', 'text-amber-400', 'border-amber-500/40');
      e.currentTarget.classList.remove('bg-slate-900/60', 'text-slate-300', 'border-slate-800');

      if (cardTitle) cardTitle.textContent = data.title;
      if (cardBadge) cardBadge.textContent = data.badge;
      if (cardDesc) cardDesc.textContent = data.desc;
      if (cardPrimary) {
        cardPrimary.textContent = data.primaryBtn.text;
        cardPrimary.href = data.primaryBtn.url;
      }
      if (cardSecondary) {
        cardSecondary.textContent = data.secondaryBtn.text;
        cardSecondary.href = data.secondaryBtn.url;
      }
      if (cardTerminal) {
        cardTerminal.textContent = data.terminal;
      }
    });
  });
}

// 3. Screenshot Showcase
const GALLERY_DATA = {
  editor: {
    src: "assets/preview-editor.png",
    title: "Shot Cockpit & JSON Syntax Formatter",
    desc: "Fine-tune request headers, auth tokens, URL query params, and JSON bodies with instant indentation beautification."
  },
  telemetry: {
    src: "assets/preview-telemetry.png",
    title: "Microsecond Telemetry Waterfall",
    desc: "Inspect nanosecond timestamps across DNS resolution, TCP handshake, TLS 1.3 handshake, and TTFB phases."
  },
  tls: {
    src: "assets/preview-tls.png",
    title: "Bulletproof TLS & Certificate Locker",
    desc: "Manage custom Certificate Authorities (CAs), client mTLS .p12 certificates, and self-signed certificate bypasses."
  },
  runner: {
    src: "assets/preview-runner.png",
    title: "Multi-Shot Automated Firing Runner",
    desc: "Orchestrate automated test runs across complete collection folders with concurrent workers and pass/fail summary reports."
  },
  assertions: {
    src: "assets/preview-assertions.png",
    title: "Real-time Test Assertions (Jint ES6)",
    desc: "Execute Chai-compatible pm.test assertions in a locked-down JavaScript isolate with sub-millisecond overhead."
  },
  grpc: {
    src: "assets/preview-grpc.png",
    title: "gRPC Studio with Server Reflection & Protobuf Parser",
    desc: "Discover RPC services dynamically with Server Reflection, parse .proto schemas, compose JSON payloads, and inspect HTTP/2 binary framing & trailers."
  },
  oauth2: {
    src: "assets/preview-oauth2.png",
    title: "OAuth 2.0 Engine with PKCE & Token Lifecycle",
    desc: "Execute Authorization Code with PKCE (S256), Client Credentials, Password, and Refresh Token grants with one-click token acquisition and auto-injection."
  }
};

function initGalleryTabs() {
  const tabs = document.querySelectorAll('.gallery-tab-btn');
  const img = document.getElementById('gallery-main-img');
  const title = document.getElementById('gallery-caption-title');
  const desc = document.getElementById('gallery-caption-desc');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('active', 'border-amber-500', 'text-amber-400');
        t.classList.add('border-transparent', 'text-slate-400');
      });

      const key = e.currentTarget.dataset.gallery;
      const data = GALLERY_DATA[key];
      if (!data) return;

      e.currentTarget.classList.add('active', 'border-amber-500', 'text-amber-400');
      e.currentTarget.classList.remove('border-transparent', 'text-slate-400');

      if (img) {
        img.style.opacity = '0.4';
        setTimeout(() => {
          img.src = data.src;
          img.style.opacity = '1';
        }, 150);
      }
      if (title) title.textContent = data.title;
      if (desc) desc.textContent = data.desc;
    });
  });
}

// 4. Polyglot Snippet Generator
const SNIPPETS = {
  curl: `curl -X POST "https://api.bullet.dev/v1/bullets/fire" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bullet_secret_token" \\
  -d '{"caliber": "5.56 NATO", "target": "api.production"}'`,
  python: `import requests

url = "https://api.bullet.dev/v1/bullets/fire"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer bullet_secret_token"
}
payload = {
    "caliber": "5.56 NATO",
    "target": "api.production"
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`,
  node: `const response = await fetch("https://api.bullet.dev/v1/bullets/fire", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer bullet_secret_token"
  },
  body: JSON.stringify({
    caliber: "5.56 NATO",
    target: "api.production"
  })
});
const data = await response.json();
console.log(response.status, data);`,
  go: `package main

import (
	"bytes"
	"fmt"
	"net/http"
	"io"
)

func main() {
	url := "https://api.bullet.dev/v1/bullets/fire"
	var jsonStr = []byte(\`{"caliber":"5.56 NATO","target":"api.production"}\`)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonStr))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer bullet_secret_token")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil { panic(err) }
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(resp.Status, string(body))
}`,
  csharp: `using System.Net.Http.Headers;
using System.Text;

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "bullet_secret_token");

var content = new StringContent(
    """{"caliber": "5.56 NATO", "target": "api.production"}""",
    Encoding.UTF8,
    "application/json"
);

var response = await client.PostAsync("https://api.bullet.dev/v1/bullets/fire", content);
var result = await response.Content.ReadAsStringAsync();
Console.WriteLine($"Status: {response.StatusCode} | Body: {result}");`,
  rust: `use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, AUTHORIZATION};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std.error::Error>> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(AUTHORIZATION, HeaderValue::from_static("Bearer bullet_secret_token"));

    let client = reqwest::Client::new();
    let res = client.post("https://api.bullet.dev/v1/bullets/fire")
        .headers(headers)
        .json(&json!({
            "caliber": "5.56 NATO",
            "target": "api.production"
        }))
        .send()
        .await?;

    println!("Status: {}", res.status());
    println!("Response: {}", res.text().await?);
    Ok(())
}`
};

function initSnippetTabs() {
  const tabs = document.querySelectorAll('.snippet-tab-btn');
  const codeBlock = document.getElementById('snippet-code');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('active', 'border-amber-500', 'text-amber-400');
        t.classList.add('border-transparent', 'text-slate-400');
      });

      const lang = e.currentTarget.dataset.lang;
      const code = SNIPPETS[lang];
      if (!code || !codeBlock) return;

      e.currentTarget.classList.add('active', 'border-amber-500', 'text-amber-400');
      e.currentTarget.classList.remove('border-transparent', 'text-slate-400');

      codeBlock.textContent = code;
    });
  });
}

// 5. Copy Buttons
function initCopyButtons() {
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.dataset.copyTarget;
      let textToCopy = '';
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) textToCopy = el.textContent.trim();
      } else if (btn.dataset.copyText) {
        textToCopy = btn.dataset.copyText;
      }

      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-400 text-xs font-bold">✓ Copied!</span>`;
        setTimeout(() => {
          btn.innerHTML = original;
        }, 1800);
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
      });
    });
  });
}

// 6. Mobile Menu
function initMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });

  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.add('hidden');
    });
  });
}
