# Contributing to BULLET 🔫

Thank you for your interest in contributing to **BULLET**! We welcome bug reports, feature requests, documentation improvements, and pull requests from developers around the world.

BULLET is engineered for speed, privacy, and precision: zero mandatory cloud accounts, sub-millisecond execution, and native cross-platform support.

---

## 🛠️ Development Setup

### Prerequisites

- **[.NET 10.0 or 9.0 SDK](https://dotnet.microsoft.com/download)**
- **[Node.js 22 LTS or newer](https://nodejs.org/)** (with `npm`)
- **[Git](https://git-scm.com/)**

### Repository Structure

```
bullet/
├── src/
│   ├── Bullet.Domain/         # Core domain models (Ranges, Arsenals, Shots, Impacts)
│   ├── Bullet.Execution/      # High-performance HTTP/2, HTTP/3, gRPC, and mTLS dispatch engine
│   ├── Bullet.Scripting/      # Jint JavaScript runtime with native pm.* bridge
│   ├── Bullet.Security/       # AES-256-GCM vault encryption & credential sanitizers
│   ├── Bullet.Application/    # Orchestration, SignalR hubs, and mesh collaboration
│   ├── Bullet.Api/            # ASP.NET Core minimal API backend & static asset host
│   ├── Bullet.Desktop/        # Native Windows WebView2 / WPF desktop launcher
│   └── Bullet.Web/            # React 19 + TypeScript + Tailwind CSS UI
├── tests/
│   ├── Bullet.UnitTests/      # Fast domain, scripting, and security tests
│   └── Bullet.IntegrationTests/# End-to-end API and engine tests
├── docs/                      # Technical documentation & GitHub Pages web simulator
└── installer/                 # Inno Setup Windows installer compiler configuration
```

---

## 🚀 Running Locally

### 1. Backend Engine & API

```bash
# Restore solution dependencies
dotnet restore Bullet.slnx

# Run the backend API server (runs on http://localhost:5000 / https://localhost:5001)
dotnet run --project src/Bullet.Api/Bullet.Api.csproj
```

### 2. Frontend Development Server

```bash
cd src/Bullet.Web
npm install
npm run dev
```

The frontend Vite dev server will start at `http://localhost:5173`, proxying API calls to `http://localhost:5000`.

---

## 🧪 Running Tests

Before submitting a pull request, ensure all test suites pass:

```bash
# Run unit tests
dotnet test tests/Bullet.UnitTests/Bullet.UnitTests.csproj

# Run integration tests
dotnet test tests/Bullet.IntegrationTests/Bullet.IntegrationTests.csproj

# Run frontend typecheck and build
cd src/Bullet.Web
npm run build
```

---

## 📋 Pull Request Process

1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feat/my-awesome-feature
   ```
2. **Write clean, idiomatic code**:
   - Follow standard C# and TypeScript naming conventions.
   - Do NOT commit database files (`*.db`), secrets, or personal paths.
   - Add unit tests for new business logic, scripting methods, or security features.
3. **Commit messages**:
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add GraphQL schema introspection support`
   - `fix: correct cookie header casing in HTTP/2 requests`
   - `docs: update field manual export documentation`
4. **Push your branch** and open a Pull Request against `main`. Ensure all automated GitHub Actions checks pass.

---

## 🔒 Reporting Security Issues

Please **do not** open public GitHub issues for security vulnerabilities. Review our [Security Policy](SECURITY.md) to report vulnerabilities privately.

---

## ⚖️ License

By contributing to BULLET, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
