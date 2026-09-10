# Bullet Automated Test Verification Suite

Bullet features a comprehensive test suite across four distinct test projects with 100% test pass rates.

---

## 1. Test Project Breakdown

```
tests/
├── Bullet.UnitTests/         # 6 tests: Token precedence, dynamic rounds, secret masking, armor inheritance, code generation, armory round-trip
├── Bullet.SecurityTests/     # 5 tests: SSRF blocking & bypass, AES-256-GCM encryption, PBKDF2 hashing, JWT signing & verification
├── Bullet.ExecutionTests/    # 4 tests: Trigger modification, Verifier assertions, infinite loop timeout abort, Cookie Locker persistence
└── Bullet.IntegrationTests/  # 3 tests: Full WebApplicationFactory pipeline (Health check, vertical Range->Shot->FiringRun->JUnit, SSRF guard enforcement)
```

---

## 2. Running All Tests

Run the complete solution test suite:

```bash
dotnet test Bullet.slnx
```

Output:
```
Passed!  - Failed: 0, Passed: 5, Total: 5  - Bullet.SecurityTests.dll
Passed!  - Failed: 0, Passed: 6, Total: 6  - Bullet.UnitTests.dll
Passed!  - Failed: 0, Passed: 4, Total: 4  - Bullet.ExecutionTests.dll
Passed!  - Failed: 0, Passed: 3, Total: 3  - Bullet.IntegrationTests.dll
Total Tests: 18 passed, 0 failed, 0 skipped
```

---

## 3. Key Security & Sandbox Tests

- `SsrfGuard_BlocksPrivateAndLoopbackIps`: Confirms attempts to hit `127.0.0.1`, `10.0.0.1`, `192.168.1.1`, or `169.254.169.254` throw `SsrfException`.
- `SsrfGuard_AllowsPrivateIpsWhenBypassed`: Confirms requests succeed when `bypassSsrfGuard = true`.
- `AesSecretStore_EncryptsAndDecryptsCorrectly`: Verifies AES-256-GCM round-trip integrity with distinct random nonces.
- `ScriptSandbox_InfiniteLoop_TimesOut`: Proves that a script containing `while(true) {}` terminates cleanly within 3,000ms with a `ScriptTimeoutException`.
