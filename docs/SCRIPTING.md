# Bullet Scripting Reference (`bullet.*` SDK)

Bullet includes an embedded, high-performance, sandboxed JavaScript runtime powered by Jint 4.16.2. Scripts can run in two phases:
1. **Trigger Scripts**: Pre-request phase. Executed before the Shot is sent over the network. Used for calculating dynamic signatures, timestamps, and injecting headers.
2. **Verifier Scripts**: Post-response phase. Executed after response impact. Used for automated assertions, response validation, and extracting variables for subsequent requests.

---

## 1. Global `bullet` Object

### `bullet.request` (Triggers Only)
- `bullet.request.url`: The target URL string.
- `bullet.request.method`: The HTTP method (GET, POST, etc.).
- `bullet.request.headers.get(name)`: Read an outgoing header value.
- `bullet.request.headers.add(name, value)`: Append or override an outgoing header.
- `bullet.request.headers.remove(name)`: Remove an outgoing header.
- `bullet.request.body`: Read or replace the raw request payload body.

### `bullet.response` (Verifiers Only)
- `bullet.response.status`: Integer HTTP status code (e.g. `200`).
- `bullet.response.statusText`: HTTP status text (e.g. `"OK"`).
- `bullet.response.responseTime`: Round-trip duration in milliseconds (e.g. `45.2`).
- `bullet.response.body`: Raw response body as a string.
- `bullet.response.json()`: Automatically parses the response body as JSON.
- `bullet.response.headers.get(name)`: Read a response header.

### `bullet.rounds` (Variables)
- `bullet.rounds.get(key)`: Retrieve a variable from the current execution context.
- `bullet.rounds.set(key, value)`: Set a variable for the current or subsequent Shots.
- `bullet.rounds.has(key)`: Check if a round variable exists.

### `bullet.test(name, assertionFn)` (Verifiers Only)
Defines an assertion test block. Tests are reported in the UI checklist, JUnit XML, and CLI runner:

```javascript
bullet.test("Status code is 200 OK", function() {
    bullet.expect(bullet.response.status).toBe(200);
});

bullet.test("Response time is under 200ms", function() {
    bullet.expect(bullet.response.responseTime).toBeLessThan(200);
});
```

### `bullet.expect(actual)` Matcher Library
- `.toBe(expected)`: Strict equality comparison.
- `.toEqual(expected)`: Deep object/array equality.
- `.toBeDefined()`: Value is not null or undefined.
- `.toBeTruthy()`: Value coerces to true.
- `.toBeFalsy()`: Value coerces to false.
- `.toContain(item)`: String substring or array inclusion.
- `.toBeGreaterThan(number)`: Greater than comparison.
- `.toBeLessThan(number)`: Less than comparison.

### `bullet.crypto` (Cryptographic Utilities)
- `bullet.crypto.sha256(str)`: Returns lowercase hex SHA-256 hash.
- `bullet.crypto.md5(str)`: Returns lowercase hex MD5 hash.
- `bullet.crypto.base64Encode(str)`: Encodes string to Base64.
- `bullet.crypto.base64Decode(str)`: Decodes Base64 to UTF-8 string.

### `bullet.console` (Trajectory Logging)
- `bullet.console.log(msg)`: Output informational log to Trajectory Console.
- `bullet.console.warn(msg)`: Output warning log to Trajectory Console.
- `bullet.console.error(msg)`: Output error log to Trajectory Console.
