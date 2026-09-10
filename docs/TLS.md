# Bulletproof TLS Architecture

Bullet features native support for enterprise and banking-grade TLS scenarios including mutual TLS (mTLS), custom enterprise CA certificate bundles, and cipher suite diagnostics.

---

## 1. Capabilities

1. **Mutual TLS (mTLS) Authentication**:
   - Provide client certificate in PEM format (`-----BEGIN CERTIFICATE-----`).
   - Provide private key in PEM format (`-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----`).
   - Bullet dynamically builds an in-memory `X509Certificate2Collection` and attaches it to the HTTP handler.

2. **Custom Enterprise CA Bundles**:
   - For internal microservices signed by private or corporate Certificate Authorities.
   - Attaches the custom root certificate chain to the TLS validation callback without modifying the host operating system's trust store.

3. **Protocol Enforcement**:
   - Configure minimum and maximum TLS protocol versions (TLS 1.2 or TLS 1.3).

4. **Self-Signed Override**:
   - Enable `InsecureSkipVerify` per profile to permit testing against local self-signed dev certificates without disabling security globally.

---

## 2. Real-Time Telemetry & Timing Breakdown

When a Shot is executed, Bullet captures granular TCP and TLS connection metrics:

- `DnsLookupMs`: Domain resolution time.
- `TcpConnectMs`: TCP 3-way handshake duration.
- `TlsHandshakeMs`: TLS client/server hello and certificate validation time.
- `TimeToFirstByteMs`: Server processing latency until first impact byte is received.
- `ContentDownloadMs`: Time spent streaming response payload.
- `TlsProtocol`: Negotiated protocol (e.g. `Tls13`).
- `CipherSuite`: Negotiated cipher suite (e.g. `TLS_AES_128_GCM_SHA256`).
