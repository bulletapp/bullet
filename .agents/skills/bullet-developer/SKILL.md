---
name: bullet-developer
description: Expert development, debugging, testing, and architecture guide for the BULLET API Testing Platform (.NET 10, C# 13, React 19, TypeScript, Tailwind CSS, Puppeteer). Use whenever implementing features, resolving bugs, running E2E suites, or publishing releases in this repository.
---

# BULLET Developer & AI Agent Skill Guide

This skill equips any AI agent or software engineer to immediately understand, navigate, develop, and test the **BULLET** API Testing Platform with 100% velocity and zero guesswork.

---

## 1. Domain Terminology Matrix

BULLET uses an intentional ballistic domain model. Always adhere to these domain terms in code and documentation:

| BULLET Term | Industry Equivalent | Description |
|---|---|---|
| **Range** | Workspace | Top-level project boundary containing collections and environments. |
| **Arsenal** | Collection | Group of related API requests, squads, and automated test runs. |
| **Squad** | Folder | Sub-folder within an Arsenal for nested hierarchical organization. |
| **Shot** | Request | An individual HTTP request definition with method, URL, headers, and body. |
| **Loadout** | Environment | Set of environment key-value pairs (e.g., Development, Staging, Production). |
| **Round** | Variable | Key-value token referenced anywhere via `{{variableName}}`. |
| **Trigger** | Pre-request Script | Sandboxed JavaScript executing before a request is fired over the wire. |
| **Verifier** | Test Script | Sandboxed JavaScript assertions evaluating the HTTP response impact. |
| **Armor** | Authorization | Authentication configuration (Bearer, Basic, API Key, AWS SigV4, OAuth 2.0). |
| **Firing Run** | Collection Runner | Batch test execution engine with iterations, delay, and report generation. |
| **Target Range**| Mock Server | Embedded mock server with path matching, simulated latency, and mock responses. |
| **Sentinel** | Monitor | Scheduled background worker executing autonomous API health checks. |
| **Bulletproof TLS** | Certificates | Client mTLS certificates, private keys, and custom enterprise CA bundles. |
| **Shot Log** | Execution History | Persistent log of executed requests with timing metrics and payloads. |
| **Cookie Locker** | Cookie Jar | Domain-scoped persistent cookie storage. |
| **Code Shot** | Code Snippets | Polyglot code snippet generation in 10 programming languages. |
| **Armory Transfer** | Import / Export | Importers for Postman Collection v2.0/v2.1, Postman Environments, OpenAPI, cURL. |
| **Trajectory Console**| Console Dock | Bottom docking drawer showing execution steps and masked secrets. |

---

## 2. Architecture & File Structure

```text
bullet/
├── src/
│   ├── Bullet.Domain/         # Core domain models (Shot, Arsenal, Loadout, Sentinel, Range)
│   ├── Bullet.Application/    # Business services, DTOs, interfaces, and CQRS handlers
│   ├── Bullet.Execution/      # HTTP pipeline, token resolver, SSRF guard, mTLS cert manager
│   ├── Bullet.Scripting/      # Jint 4.16.2 sandboxed JS runtime for Triggers and Verifiers
│   ├── Bullet.Infrastructure/ # EF Core 10, SQLite / PostgreSQL DbContext, AES-256-GCM secret store
│   ├── Bullet.Workers/        # Background Sentinel monitor execution workers
│   ├── Bullet.Api/            # ASP.NET Core 10 Web API, SignalR hubs, and static web hosting (wwwroot)
│   ├── Bullet.Desktop/        # Windows Forms + Edge WebView2 desktop host application
│   ├── Bullet.Cli/            # Cross-platform command-line runner with JUnit XML reports
│   └── Bullet.Web/            # React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Puppeteer E2E
├── installer/                 # Inno Setup 6 script (Bullet.iss) for single-file Windows installer
├── scripts/                   # Cross-platform launch scripts (run-mac.sh, Bullet.command, build-installer.ps1)
├── docker/                    # Dockerfiles for API and Web frontend
├── .github/workflows/ci.yml   # Multi-stage CI/CD: hygiene, compilation, 25-phase E2E, Docker, releases
├── .agents/skills/            # Agent skills and automation runbooks
└── AGENTS.md                  # Root agent instructions and architectural guidelines
```

---

## 3. Essential Development Runbooks

### Runbook A: Frontend Development & Bundle Sync
When modifying any UI component in `src/Bullet.Web`:
1. Start dev server:
   ```bash
   cd src/Bullet.Web
   npm.cmd run dev
   ```
2. Build production assets:
   ```bash
   cd src/Bullet.Web
   npm.cmd run build
   ```
3. Copy compiled assets to API host:
   ```powershell
   Copy-Item -Path "src/Bullet.Web/dist/*" -Destination "src/Bullet.Api/wwwroot" -Recurse -Force
   ```

### Runbook B: Executing the 25-Phase Automated E2E Suite
Before committing major changes or releasing, run the full automated browser test suite:
```powershell
# From src/Bullet.Web
cd src/Bullet.Web
node e2e-full-suite.mjs
```
The suite will:
- Auto-start the pre-built backend on `http://127.0.0.1:5000`
- Execute all 25 phases with Puppeteer (Edge/Chrome)
- Save 25 verification screenshots to `src/Bullet.Web/e2e-screenshots/`
- Assert zero uncaught browser console errors

### Runbook C: Building the Desktop Installer
```powershell
# In PowerShell:
./scripts/build-installer.ps1
```
Compiles `dist-installer/Bullet-Setup.exe` and outputs SHA256 checksums.

### Runbook D: Testing Native macOS Build
```bash
dotnet publish src/Bullet.Api/Bullet.Api.csproj -c Release -r osx-arm64 --self-contained false -o publish/mac-arm64
./scripts/run-mac.sh
```

---

## 4. Key Gotchas & Anti-Patterns to Avoid

1. **React SyntheticEvent in Callbacks (Circular JSON Error)**:
   - *Never* write `<button onClick={onFire}>` where `onFire` expects an optional request override object.
   - React passes a `SyntheticEvent` / `MouseEvent` containing DOM and fiber node circular references, crashing `JSON.stringify()`.
   - *Always* write `<button onClick={() => onFire()}>` and verify `typeof override === 'object' && typeof override.url === 'string'`.

2. **Loopback Address Binding**:
   - Always bind servers to `http://127.0.0.1:5000` for deterministic loopback routing in tests and CI, rather than ambiguous `localhost` or `0.0.0.0`.

3. **Brand Logo Consistency**:
   - Always use the unified `<BulletLogo size={...} />` component.
   - Do not create ad-hoc SVG bullet or raindrop shapes.

4. **Windows Mark of the Web & SmartScreen**:
   - Binaries downloaded via browser will have `Zone.Identifier = 3`.
   - Use `Unblock-File .\Bullet-Setup.exe` to strip the zone identifier during local testing.

5. **PowerShell Here-Strings in CI YAML**:
   - In YAML `run: |` blocks on Windows, avoid multiline `@"` here-strings because closing `"@` requires column 0.
   - Use `$lines = @(...) ; $body = $lines -join "`n"` instead for 100% portable formatting.
