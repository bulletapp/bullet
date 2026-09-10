# Bullet Security Architecture & Threat Model

> **Status**: Production-grade  
> **Standards**: OWASP API Security Top 10, NIST SP 800-38D (AES-GCM), RFC 2898 (PBKDF2)

---

## 1. SSRF Guard (Server-Side Request Forgery Defense)

Bullet is designed to execute real, arbitrary HTTP requests. To prevent attackers or compromised scripts from attacking internal services, cloud metadata APIs, or loopback interfaces, all requests pass through `Bullet.Security.SsrfGuard`.

### Blocked IP Ranges & Hostnames by Default

- **Loopback**: `127.0.0.0/8`, `::1`, `localhost`
- **Private Networks (RFC 1918)**:
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
- **Link-Local & Multicast**:
  - `169.254.0.0/16` (RFC 3927)
  - `224.0.0.0/4`
- **Cloud Metadata Endpoints**:
  - `169.254.169.254` (AWS, Azure, GCP Instance Metadata Service)
  - `metadata.google.internal`

### Explicit Bypass Semantics
SSRF blocking is strictly enforced by default. A request targeting private IPs will fail with `SsrfException: Access to private or loopback destination is blocked by Bullet SSRF Guard`.

Developers testing local APIs may explicitly set `bypassSsrfGuard = true` on an individual Shot's settings. When bypassed:
- The UI renders an amber warning banner.
- The Trajectory Console records an `[SSRF Guard Bypassed]` warning audit event.
- Exporting to JSON flags the bypass.

---

## 2. AES-256-GCM Cryptographic Storage

All sensitive secrets stored in the database (such as private keys, passwords, and tokens marked with `isSecret = true`) are encrypted at rest using **AES-256-GCM** via `AesSecretStore`:

- **Key Size**: 256 bits (32 bytes).
- **Nonce / IV**: 96-bit (12 bytes) cryptographically secure random nonce generated per encryption operation.
- **Authentication Tag**: 128-bit (16 bytes) GCM authentication tag verifying ciphertext integrity.
- **Envelope Format**: `[Nonce (12B)] || [Tag (16B)] || [Ciphertext]`.

---

## 3. Automated Secret Masking

To eliminate credential leakage through log aggregation, developer screenshots, or team sharing, the `SecretMasker` intercepts all headers, URLs, and telemetry before display:

- **Bearer Tokens**: `Bearer eyJhbGci...` -> `Bearer *******`
- **Basic Auth**: `Basic dXNlcjpw...` -> `Basic *******`
- **API Keys**: Masked with leading and trailing characters only (e.g. `sk_live_...48f9`).
- **Private Keys**: Replaces everything between `-----BEGIN ... PRIVATE KEY-----` and `-----END ... PRIVATE KEY-----`.

---

## 4. Sandboxed Script Execution

Trigger and Verifier JavaScript scripts run inside an isolated Jint runtime configured with:

1. **Strict Execution Timeout**: Aborts any infinite loops (`while(true)`) after **3,000 milliseconds**.
2. **Memory Quota**: Limits JavaScript heap allocation to **10 Megabytes**.
3. **No OS / Filesystem Access**: Scripts cannot access system files, spawn processes, or access host environment variables.
4. **Isolated Scope**: Execution scope contains strictly the `bullet.*` SDK.
