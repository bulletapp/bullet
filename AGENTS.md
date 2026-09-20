# AGENTS.md - Developer & Agent Guide for BULLET

Welcome to **BULLET: Load. Aim. API.**

This document provides immediate, actionable guidance for AI agents (Antigravity, Gemini Code Assist, Claude, Cursor, Copilot) and human developers contributing to this codebase.

---

## 1. Project Philosophy & Core Invariants

1. **Production-Grade Only**: No placeholders, no dummy mock functions, and no simulated UI buttons. Every button, selector, and view is backed by real execution engines or persistent storage.
2. **Unified Ballistic Terminology**: Always use the domain terms defined in the matrix below.
3. **Cross-Platform Delivery**:
   - **Windows**: Single-file Inno Setup installer (`Bullet-Setup.exe`) and portable desktop zip with Edge WebView2.
   - **macOS**: Native packages for Apple Silicon (`osx-arm64`) and Intel (`osx-x64`) with double-clickable `Bullet.command` and `run-mac.sh`.
   - **Linux / Docker**: Containerized deployment via `docker-compose.yml`.
4. **Deterministic Testing**: Every UI view and interaction is backed by the automated 25-phase Puppeteer E2E suite (`src/Bullet.Web/e2e-full-suite.mjs`).

---

## 2. Terminology Matrix

| BULLET Domain Term | Standard Industry Term | Definition |
|---|---|---|
| **Range** | Workspace | Top-level project boundary containing collections and environments. |
| **Arsenal** | Collection | Group of related API requests, squads, and automated test runs. |
| **Squad** | Folder | Nested organizational container within an Arsenal. |
| **Shot** | Request | An individual HTTP request (method, URL, headers, parameters, body, auth). |
| **Loadout** | Environment | Environment variable set (e.g., Development, Staging, Production). |
| **Round** | Variable | Key-value token referenced in URLs, headers, or bodies via `{{variableName}}`. |
| **Trigger** | Pre-request Script | Sandboxed JavaScript executed immediately prior to dispatching a request. |
| **Verifier** | Test Script | Sandboxed JavaScript assertions evaluating the HTTP response. |
| **Armor** | Authorization | Authentication scheme (Bearer, Basic, API Key, AWS SigV4, OAuth 2.0). |
| **Firing Run** | Collection Runner | Automated test runner with iterations, delay, and JUnit/HTML reporting. |
| **Target Range** | Mock Server | Embedded mock engine with path matching, simulated latency, and dynamic responses. |
| **Sentinel** | Monitor | Scheduled autonomous background worker executing API health checks. |
| **Bulletproof TLS** | Certificates | Client mTLS certificates, private keys, and custom enterprise CA roots. |
| **gRPC Studio** | gRPC GUI | HTTP/2 unary and streaming client with dynamic proto parsing & reflection. |
| **WiFi Mesh** | LAN Collaboration | Zero-cloud P2P workspace discovery and SignalR live synchronization over WiFi. |
| **Shot Log** | Execution History | Persistent log of executed requests with connection timings and payloads. |
| **Cookie Locker** | Cookie Manager | Domain-scoped persistent cookie storage. |
| **Code Shot** | Code Generation | Polyglot code snippet generation in 10 programming languages. |
| **Armory Transfer** | Import / Export | Importers for Postman Collection v2.0/v2.1, Postman Environments, OpenAPI, cURL. |
| **Trajectory Console**| Console Dock | Bottom dock showing real-time execution steps and masked secrets. |

---

## 3. Solution Architecture

```text
Bullet.slnx
├── src/Bullet.Domain/         -> Core domain entities (Shot, Arsenal, Loadout, Sentinel, Range, TLSProfile, CookieRecord)
├── src/Bullet.Application/    -> Application interfaces, DTOs, CQRS handlers, validation
├── src/Bullet.Execution/      -> High-performance HTTP/gRPC client handler, SSRF guard, mTLS manager
├── src/Bullet.Scripting/      -> Jint 4.16.2 JS sandbox (3s timeout, 10MB memory ceiling)
├── src/Bullet.Infrastructure/ -> EF Core 10, SQLite / PostgreSQL context, AES-256-GCM encryption
├── src/Bullet.Workers/        -> Background Sentinel health-check execution daemon
├── src/Bullet.Api/            -> ASP.NET Core 10 API, SignalR hubs (BulletHub, MeshHub), static wwwroot host
├── src/Bullet.Desktop/        -> Windows Forms + Microsoft.Web.WebView2 desktop shell
├── src/Bullet.Cli/            -> Cross-platform CLI runner with JUnit XML reports
└── src/Bullet.Web/            -> React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons
```

---

## 4. Daily Development Workflows

### Running Backend API
```bash
dotnet run --project src/Bullet.Api
# Server starts at http://127.0.0.1:5000 (serves REST API, SignalR, and bundled React UI)
```

### Running Frontend Development Server
```bash
cd src/Bullet.Web
npm.cmd run dev
# Vite starts at http://localhost:3000 with HMR proxying /api to http://127.0.0.1:5000
```

### Building & Synchronizing Frontend Assets
Whenever you edit frontend components in `src/Bullet.Web`, recompile and sync assets:
```powershell
cd src/Bullet.Web
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm.cmd run build
Copy-Item -Path "dist/*" -Destination "../Bullet.Api/wwwroot" -Recurse -Force
```

### Running the Full 36-Phase Automated E2E Browser Suite
```powershell
cd src/Bullet.Web
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
node e2e-full-suite.mjs
```
The suite launches a headless browser, connects to the local backend, runs all 36 interaction phases, captures visual screenshots to `src/Bullet.Web/e2e-screenshots/`, and validates with zero console errors.

### Running Native Desktop on Windows
```bash
dotnet run --project src/Bullet.Desktop
```

### Running Native Engine on macOS
```bash
./scripts/run-mac.sh
# Or double-click scripts/Bullet.command in Finder
```

---

## 5. Coding Standards & Conventions

### C# & .NET 10
- Use modern C# 13 syntax (primary constructors, file-scoped namespaces, pattern matching, records).
- Nullable reference types are strictly enabled (`<Nullable>enable</Nullable>`).
- Keep controllers thin and delegate business logic to handlers in `Bullet.Application`.
- Encrypt sensitive data (passwords, tokens, private keys) with `ISecurityService` (AES-256-GCM).

### React 19 & TypeScript
- Functional components with React hooks.
- Strong TypeScript typing across all DTOs in `src/Bullet.Web/src/types/bullet.ts`.
- Tailwind CSS for responsive and theme-aware styling. Use theme classes:
  - Background: `bg-bullet-dark`, `bg-bullet-panel`, `bg-bullet-surface`
  - Border: `border-bullet-border`
  - Accent: `text-amber-400`, `bg-amber-500`, `text-cyan-400`
- **Brand Logo**: Always use `<BulletLogo size={...} />` from `src/Bullet.Web/src/components/BulletLogo.tsx`. Do not create ad-hoc SVG bullet shapes.

---

## 6. Critical Pitfalls & Gotchas

1. **Circular JSON Error from React SyntheticEvent**:
   - In React, passing an event callback directly (e.g. `<button onClick={onFire}>`) passes a `MouseEvent` as the first argument. If `onFire(shotOverride)` expects an optional data object, passing the `MouseEvent` causes `JSON.stringify` to throw:
     `Converting circular structure to JSON --> starting at object with constructor 'HTMLButtonElement'`
   - **Rule**: Always wrap invocations with `() => onFire()` and guard `typeof shotOverride === 'object' && typeof shotOverride.url === 'string'`.

2. **Network Binding in CI & Headless Testing**:
   - Always bind test servers to `http://127.0.0.1:5000` rather than `localhost` or `0.0.0.0` to ensure deterministic loopback routing.

3. **PowerShell Formatting in GitHub Actions**:
   - In YAML `run: |` blocks, avoid multiline `@"` here-strings because closing `"@` fails on indentation in Windows PowerShell.
   - Use `$lines = @(...) ; $body = $lines -join "`n"` instead.

4. **Mark of the Web (Zone.Identifier = 3)**:
   - Newly downloaded binaries from browsers are blocked by Windows SmartScreen / Smart App Control by default.
   - Strip Mark of the Web using `Unblock-File .\Bullet-Setup.exe` or right-click Properties $\rightarrow$ Unblock.

5. **SSRF Guard on Loopback / Internal Subnets**:
   - BULLET's `SsrfProtectionService` intercepts requests to `127.0.0.1`, `localhost`, and RFC 1918 subnets (`10.0.0.0/8`, `192.168.0.0/16`).
   - If targeting internal endpoints in tests, toggle `bypassSsrfGuard: true` in Shot Settings (via `[data-testid="bypass-ssrf-toggle"]`).

6. **React Controlled Inputs in Puppeteer / E2E Automation**:
   - `page.keyboard.press('Backspace')` on focused React controlled inputs does not always fire synthetic `change` events in headless Chromium.
   - Use the `clearAndType` helper in `e2e-full-suite.mjs` which sets the value through the native prototype descriptor (`Object.getOwnPropertyDescriptor(proto, 'value')?.set`) and dispatches synthetic `'input'` and `'change'` events.

7. **Environment State Refresh & Selected Loadout Sync**:
   - When adding, updating, or deleting rounds (variables) in a Loadout, ensure `setSelectedLoadout` is also updated to the matching refreshed object in `App.tsx` and child popovers use optimistic state to prevent stale render delays.
