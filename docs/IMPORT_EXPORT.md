# Armory Transfer: Import & Export Reference

Bullet provides zero-lock-in migration utilities for transitioning collections, environments, and curl commands across platforms.

---

## 1. Supported Formats

| Format | Import | Export | Notes |
|---|---|---|---|
| **Native Bullet (`.bullet.json`)** | Yes | Yes | Full fidelity representation of Arsenals, Squads, Shots, Triggers, Verifiers, and Loadout Rounds. |
| **Postman v2.1 Collection** | Yes | - | Converts folders into Squads, requests into Shots, pre-request scripts into Triggers, and tests into Verifiers. |
| **OpenAPI 3.0 (JSON / YAML)** | Yes | Yes | Maps OpenAPI paths, operations, parameters, request bodies, and auth schemes to Shots and Armor. |
| **cURL Command** | Yes | Yes | Instant parsing of `-X METHOD`, `-H 'Header'`, `-d 'body'`, `--user`, etc., into a ready-to-fire Shot. |
| **JUnit XML** | - | Yes | Standard CI/CD test report format generated from Firing Runs. |

---

## 2. Secrets Handling During Export

By default, the Native Bullet exporter enforces security by omitting rounds marked with `isSecret = true`:
```json
{
  "key": "jwtToken",
  "value": "",
  "isSecret": true
}
```
Users may optionally check `Include Secret Rounds` if generating a backup for a secure vault.
