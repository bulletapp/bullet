# Changelog

All notable changes to the **BULLET** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.2] - 2026-09-20

### 🛡️ Security Hardening & Vulnerability Remediation
- **OAuth Reflected XSS Protection**: Strict HTML entity sanitization on callback redirect parameters (`error`, `error_description`, `code`).
- **Comprehensive SSRF Defense**: Hardened against IPv4-mapped IPv6 evasions, raw IP literals, post-trigger script URL rewrites, and unconditional cloud instance metadata blocking (`169.254.169.254`, `metadata.google.internal`). Added CIDR blocks for Carrier-Grade NAT, Multicast, and Reserved ranges.
- **RFC 6265 Cookie Locker Scoping**: Implemented domain matching to eliminate cross-domain cookie leakage across different hosts in the same workspace. Expired cookies are automatically filtered.
- **Response Preview Sandboxing**: Hardened HTML response preview `<iframe>` with null sandboxing (`sandbox=""`) to prevent untrusted responses from executing scripts in the application origin.
- **Restricted CORS Policy**: Locked down API origins to `localhost`, local private WiFi/LAN subnets (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`), local mDNS (`*.local`), and intranet machine names, blocking drive-by CSRF attacks from external websites.
- **WiFi Mesh Credential Sanitization**: Client TLS private keys, certificates, and passwords are automatically stripped prior to broadcasting workspace snapshots to peers over LAN.
- **gRPC TLS Enforcement**: Restored full certificate trust chain verification on gRPC channel connections.
- **Desktop WebView2 Navigation Trapping**: External links and new windows are isolated and delegated directly to the user's default system browser.

### ⚡ New Features & Quality Enhancements
- **Postman Scripting Bridge (`pm.*`)**: Native support for Postman pre-request and test assertion syntax (`pm.test`, `pm.expect`, `pm.response.to.have.status()`, `pm.response.json()`, `pm.environment`, `pm.variables`), enabling imported collections to run without script modifications.
- **Arsenal Field Manual**: Interactive documentation modal with 1-click export to Markdown (`.md`) and OpenAPI/JSON (`.json`), clipboard copy, and file downloads.
- **Target Range Mock Server Status Codes & Dynamic Routing**: Mock servers now return custom HTTP status codes (201, 400, 404, 500, etc.) and match parameterized routes (`/users/:id`, wildcard `/api/*`).
- **URL Path Variables Substitution**: Full token and variable resolution for `:param` and `{param}` path variables in the execution pipeline.
- **CLI Single-Shot Runner**: Added `bullet shot fire <url_or_file>` with support for GitHub Actions CI annotations (`::error title=...`) and `--bail` / `--stop-on-error`.
- **CodeShot Auth Injection**: Generated cURL and multi-language snippets automatically inject configured Bearer, Basic, and API Key credentials, plus `grpcurl` commands.
- **Sentinel Background Execution**: Eagerly loads environment loadouts and rounds during automated scheduled runs.
- **36-Phase Automated E2E Suite**: Expanded Puppeteer browser test suite from 34 to 36 end-to-end verification phases covering the Field Manual modal and Postman `pm.*` scripting bridge.

---

## [0.0.1] - 2026-09-20 (Initial Release)

> **BULLET** is the blazing-fast, open-source, local-first alternative to Postman and Insomnia for testing **REST**, **GraphQL**, **gRPC**, and **WebSockets**. Built with **.NET 10**, **C# 13**, **React 19**, and **Vite** — engineered with zero cloud lock-in, absolute offline privacy, mTLS client certificates, and serverless WiFi Mesh LAN collaboration.

### 🚀 Core Architecture & Execution Engine
- **Ultra-Fast .NET 10 Engine**: Native HTTP execution pipeline with sub-millisecond connection timing diagnostics (DNS lookup, TCP handshake, TLS negotiation, Time to First Byte, Content Transfer).
- **100% Local-First Data Storage**: Zero cloud lock-in or forced account logins. Stores all workspaces, collections, environments, and logs locally using EF Core with SQLite or PostgreSQL.
- **Sandboxed JavaScript Scripting**: Pre-request Triggers and response Verifiers powered by Jint 4.16.2 with strict memory limits (10MB) and CPU timeout protection (3-second quota). Infinite loops abort safely without hanging the process.
- **SSRF Guard Network Security**: Comprehensive private IP range protection blocking loopback (`127.0.0.1`), private networks (`10.x`, `192.168.x`, `172.16.x`), and cloud metadata services (`169.254.169.254`). Configurable per-request bypass for local microservice development.
- **AES-256-GCM Secret Protection**: Hardware-accelerated authenticated encryption with individual 96-bit nonces for all sensitive variables, tokens, and credentials.
- **Automated Secret Masking**: Credentials and secrets are automatically masked in the UI, Trajectory console, and execution history.

### ⚡ Workbench & Developer Experience
- **Multi-Tab Request Workbench**: Seamlessly open and switch between multiple requests without losing unsaved parameters or response states. Features method color badges, dirty indicator dots (`●`), and quick tab creation (`+`).
- **URL Path Variables Auto-Detection**: Automatically identifies URL path variables (`:param` or `{param}`) and renders interactive fields in the Params tab with instant substitution.
- **Environment Quick-Look Popover (`[👁️]`)**: Convenient header popover to inspect active environment variables, search keys/values, toggle secret visibility, and add variables on the fly.
- **Vibrant Response Syntax Highlighting**: Color-coded JSON highlighting with Sky keys, Emerald strings, Amber numbers, and Purple booleans. Includes real-time response text search with accented match highlighting.
- **Polyglot Code Generator**: 1-click code snippet generation across 10 languages (cURL, C# HttpClient, TypeScript fetch, JavaScript axios, Python requests, Go net/http, Rust reqwest, Java 11, PHP cURL, Ruby Net::HTTP).
- **Cookie Locker**: Full domain-scoped cookie storage and session persistence manager.
- **1-Click Postman & OpenAPI Import**: Complete translation of Postman v2.1 Collections and Environments with 100% fidelity.

### 🔌 gRPC Studio
- **Server Reflection Discovery**: Live auto-discovery of gRPC services, methods, and message contracts.
- **Protobuf Schema Parser & Import**: Native `.proto` file drag-and-drop upload modal with interactive service/method selector and sample payload generation.
- **TLS Security Lock**: Toggle between plaintext (h2c) and encrypted (TLS HTTP/2) gRPC transport with visual status indicator.
- **Metadata & Trailers Inspection**: Complete inspection of gRPC request metadata, response headers, and status trailers.

### 🔐 Bulletproof TLS & Client Certificates (mTLS)
- **Mutual TLS Client Certificates**: Configure client certificates via PEM, PFX (with passphrase), or separate key files scoped per target hostname.
- **Custom CA Bundles**: Add custom enterprise root and intermediate certificates for internal PKI validation.
- **Global & Per-Shot SSL Toggles**: Toggle global SSL validation bypass directly from the header, or configure per-shot SSL verification settings.

### 🌐 WiFi Mesh LAN Collaboration
- **Serverless Peer-to-Peer Sharing**: Share and discover workspaces across your local WiFi/LAN network via UDP multicast and SignalR hubs without external servers or cloud accounts.
- **Bidirectional Collaborative Sync**: Real-time collaborative workspace synchronization with conflict-free updates.
- **Access Control & Password Protection**: Protect shared workspaces with passwords and enforce ReadOnly observer mode or ReadWrite contributor permissions.

### 🏃 Automated Testing & CI/CD
- **Firing Run Collection Runner**: Embedded runner for executing sequential or batch requests with configurable iterations, delay, and data-driven inputs.
- **Target Range Mock Engine**: Integrated local mock server supporting simulated latency, custom status codes, and path routing.
- **Sentinels Background Monitors**: Autonomous scheduled health check workers with execution logs and status alerts.
- **JUnit XML CI/CD Reporting**: Export test results formatted for native integration with GitHub Actions, GitLab CI, and Jenkins.

### 🎨 Design & Accessibility
- **Uniform Header Bar**: Pixel-perfect `h-8` (`32px`) height and aligned baselines across all header controls, dropdowns, and toggles.
- **WCAG AA Compliant Light Mode**: Custom color palette ensuring high-contrast readability for status badges, syntax tokens, and UI cards on light backgrounds.
- **Modern Dark & Light Themes**: Instant theme switching with smooth transitions and persistent user preference.
- **Web Audio FX**: Tactile sound effects for firing requests, test successes, and errors (with mute toggle).

### 📦 Platform & Distribution
- **Single-File Windows Setup Installer (`Bullet-Setup.exe`)**: Built with Inno Setup; non-elevated per-user installation with desktop shortcuts and auto-launch.
- **Portable Windows Package (`Bullet-Desktop-Windows-x64.zip`)**: Zero-install standalone desktop executable.
- **Native macOS Application Bundles**: Native double-clickable app bundles for Apple Silicon (`arm64`) and Intel (`x64`).
- **Progressive Web App (PWA)**: Installable directly from Chrome, Edge, and Safari ("Add to Dock") as a standalone windowed desktop application.
- **Docker Compose**: Pre-configured multi-container stack with PostgreSQL, API, and Web client.

### 🧪 Automated Quality Verification
- **34-Phase Browser E2E Suite**: 100% automated browser verification covering all UI controls, SSL toggles, gRPC cockpit, OAuth2 PKCE, WiFi mesh, multi-tab workbench, and path variables.
- **53 Automated Backend Tests**: Comprehensive unit and integration test coverage across all domain and security layers.
