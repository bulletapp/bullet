# Changelog

All notable changes to the **BULLET** API Testing Client will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-19

### 🚀 Added
- **Authentic Rifle Bullet Cartridge Identity**:
  - Replaced legacy droplet icon with a precision-rendered rifle bullet cartridge (spitzer ogive, neck, 45° shoulder taper, straight brass cylinder, extractor groove, and rim flange base).
  - Updated SVGs across web header, tab favicons, and Windows desktop application icons.
- **Cinematic Supersonic Bullet Intro & Sound FX**:
  - High-velocity animated bullet firing across the screen with ballistic shockwave rings and vapor trails.
  - Web Audio API synthesized supersonic crack and bullet flyby sound effects with instant Mute toggle.
- **Postman Collection & Environment Import**:
  - 100% fidelity parser for Postman Collection format v2.0 and v2.1.
  - Full support for nested multi-level folders, query parameters, URL variables, headers, form-data, and JSON bodies.
  - Postman Environment importer mapping variable key-value pairs directly into BULLET environments.
- **Drag & Drop Interactive Workflows**:
  - Drag-and-drop `.json` collection or environment files anywhere onto the BULLET application or sidebar to import instantly with visual drag overlay.
  - Interactive drag-and-drop reordering of collection folders and requests within the sidebar hierarchy.
- **Smart cURL Auto-Detection**:
  - Automatically recognizes pasted cURL commands into the URL bar and provides an instant one-click import banner.
- **Single-File Windows Setup Installer & Code Signing**:
  - Inno Setup compiler integration creating `Bullet-Setup.exe`.
  - Automated Authenticode digital code signing in CI workflow for `Bullet.exe` and `Bullet-Setup.exe` with RFC 3161 DigiCert timestamping.
  - Generates verifiable public certificate `Bullet-Release.cer` as an official release asset.
  - Non-elevated per-user installation to `%LOCALAPPDATA%\Programs\Bullet`.
  - Automatic Start Menu and Desktop shortcuts with uninstaller registration.
  - Release zip archive `Bullet-Desktop-Windows-x64.zip` for portable zero-install execution.
- **25-Phase Automated E2E Browser Test Suite**:
  - Complete end-to-end browser test suite in Puppeteer (`e2e-full-suite.mjs`) covering:
    1. Create Shot & URL Bar
    2. Fire HTTP GET & Inspect Response
    3. Fire POST with JSON Body & Auto-Beautify
    4. Firing Run Execution & Progress
    5. Navigation Across All Views (History, Cookies, Environments, TLS, Settings)
    6. Light Mode Switch
    7. Dark Mode Restoration
    8. Drag-and-Drop Collection Import
    9. Sidebar Drag-and-Drop Item Reordering
    10. Bullet Intro Splash & Canvas Animation
    11. Header Deck & Bullet Logo Cartridge
    12. cURL Paste Auto-Detection
    13. Request Body Editor & Prettification
    14. Bearer & API Key Authorization
    15. Response Assertion Engine
    16. Telemetry & History Search Filters
    17. Environment Variable Interpolation (`{{base_url}}`)
    18. Shot History Clearing & Confirmation
    19. Bulletproof TLS & Custom Certificate Store
    20. Cookie Locker & Domain Inspection
    21. Proxy Configuration
    22. Code Snippet Export (cURL, Python, C#, Node.js)
    23. Postman Environment Import
    24. SSL Verification Bypass Toggle
    25. Brand Bullet Logo & Clean SSL Diagnostics (No Circular JSON)
  - Visual verification with 25 automated screenshot captures archived on every CI run.

### ⚡ Changed
- Removed redundant intro replay crosshair button from header for a cleaner, professional deck.
- Removed redundant "Disable SSL & Retry" prompt from error viewer when SSL is already disabled or unverified.
- Reorganized sidebar layout with dedicated import buttons, drag-and-drop handles, and collection management.
- Standardized UI security metaphors to industry-standard Auth, Body, and SSL lock controls.
- Enhanced GitHub Actions CI workflow to automatically generate release notes and changelog from commit logs.

### 🛡️ Fixed
- Fixed `Converting circular structure to JSON` React synthetic event parameter issue during request firing.
- Fixed SSL verification failure diagnostics with clean, actionable error explanations.
- Supported `bypassSsrfGuard` and `bypassSsrfProtection` property name aliases in `ShotSettings`.
- Bound local backend daemon to single loopback address (`http://127.0.0.1:5000`) for instant, deterministic startup in CI and desktop environments.
