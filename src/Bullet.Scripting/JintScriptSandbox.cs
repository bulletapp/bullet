using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Bullet.Domain.ValueObjects;
using Bullet.Scripting.Models;
using Jint;
using Jint.Native;

namespace Bullet.Scripting;

public class JintScriptSandbox : IScriptSandbox
{
    public Task<ScriptExecutionResult> ExecuteAsync(
        string? script,
        ScriptExecutionContext context,
        CancellationToken cancellationToken = default)
    {
        var result = new ScriptExecutionResult
        {
            ModifiedUrl = context.Request.Url,
            ModifiedBody = context.Request.Body
        };

        foreach (var kvp in context.Request.Headers)
            result.ModifiedHeaders[kvp.Key] = kvp.Value;

        foreach (var kvp in context.Rounds)
            result.UpdatedRounds[kvp.Key] = kvp.Value;

        foreach (var kvp in context.Cookies)
            result.UpdatedCookies[kvp.Key] = kvp.Value;

        if (string.IsNullOrWhiteSpace(script))
        {
            return Task.FromResult(result);
        }

        try
        {
            var engine = new Engine(cfg =>
            {
                cfg.LimitMemory(10_000_000);
                cfg.TimeoutInterval(TimeSpan.FromSeconds(3));
                cfg.MaxStatements(100_000);
            });

            // Console logger
            void LogTrajectory(string level, string msg)
            {
                result.TrajectoryLogs.Add(new TrajectoryEntry
                {
                    Step = context.StepName,
                    Level = level,
                    Message = msg,
                    TimestampUtc = DateTime.UtcNow
                });
            }

            // Expose console log helpers
            Action<JsValue[]> jsLog = args =>
            {
                var msg = string.Join(" ", args.Select(a => a.ToString()));
                LogTrajectory("Info", msg);
            };
            Action<JsValue[]> jsWarn = args =>
            {
                var msg = string.Join(" ", args.Select(a => a.ToString()));
                LogTrajectory("Warn", msg);
            };
            Action<JsValue[]> jsError = args =>
            {
                var msg = string.Join(" ", args.Select(a => a.ToString()));
                LogTrajectory("Error", msg);
            };

            // Crypto helpers
            Func<string, string> md5Hash = input =>
            {
                using var md5 = MD5.Create();
                var bytes = md5.ComputeHash(Encoding.UTF8.GetBytes(input ?? string.Empty));
                return Convert.ToHexString(bytes).ToLowerInvariant();
            };

            Func<string, string> sha256Hash = input =>
            {
                using var sha = SHA256.Create();
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input ?? string.Empty));
                return Convert.ToHexString(bytes).ToLowerInvariant();
            };

            Func<string, string> base64Encode = input =>
                Convert.ToBase64String(Encoding.UTF8.GetBytes(input ?? string.Empty));

            Func<string, string> base64Decode = input =>
            {
                try
                {
                    var bytes = Convert.FromBase64String(input ?? string.Empty);
                    return Encoding.UTF8.GetString(bytes);
                }
                catch
                {
                    return string.Empty;
                }
            };

            // Setup bullet object structure in Jint
            engine.SetValue("__jsLog", jsLog);
            engine.SetValue("__jsWarn", jsWarn);
            engine.SetValue("__jsError", jsError);
            engine.SetValue("__md5", md5Hash);
            engine.SetValue("__sha256", sha256Hash);
            engine.SetValue("__b64Enc", base64Encode);
            engine.SetValue("__b64Dec", base64Decode);

            // Rounds get/set
            Func<string, string?> roundGet = key =>
            {
                if (key != null && result.UpdatedRounds.TryGetValue(key, out var val))
                    return val;
                return null;
            };

            Action<string, string> roundSet = (key, val) =>
            {
                if (!string.IsNullOrWhiteSpace(key))
                {
                    result.UpdatedRounds[key] = val ?? string.Empty;
                    LogTrajectory("Info", $"Round set: {key} = {val}");
                }
            };

            engine.SetValue("__roundGet", roundGet);
            engine.SetValue("__roundSet", roundSet);

            // Cookies get/set
            Func<string, string?> cookieGet = key =>
            {
                if (key != null && result.UpdatedCookies.TryGetValue(key, out var val))
                    return val;
                return null;
            };

            Action<string, string> cookieSet = (key, val) =>
            {
                if (!string.IsNullOrWhiteSpace(key))
                    result.UpdatedCookies[key] = val ?? string.Empty;
            };

            engine.SetValue("__cookieGet", cookieGet);
            engine.SetValue("__cookieSet", cookieSet);

            // Request headers get/set
            Func<string, string?> reqHeaderGet = key =>
            {
                if (key != null && result.ModifiedHeaders.TryGetValue(key, out var val))
                    return val;
                return null;
            };

            Action<string, string> reqHeaderSet = (key, val) =>
            {
                if (!string.IsNullOrWhiteSpace(key))
                    result.ModifiedHeaders[key] = val ?? string.Empty;
            };

            Action<string> reqHeaderRemove = key =>
            {
                if (!string.IsNullOrWhiteSpace(key))
                    result.ModifiedHeaders.Remove(key);
            };

            engine.SetValue("__reqHeaderGet", reqHeaderGet);
            engine.SetValue("__reqHeaderSet", reqHeaderSet);
            engine.SetValue("__reqHeaderRemove", reqHeaderRemove);

            // Test execution collector
            Action<string, bool, string?> recordTest = (name, passed, errMsg) =>
            {
                result.Verifications.Add(new VerificationResult
                {
                    TestName = name,
                    Passed = passed,
                    ErrorMessage = errMsg
                });

                LogTrajectory(passed ? "Success" : "Error", $"Verifier: {name} {(passed ? "✓" : $"✗ - {errMsg}")}");
            };

            engine.SetValue("__recordTest", recordTest);

            // Prepare Request state
            var reqJson = JsonSerializer.Serialize(new
            {
                method = context.Request.Method,
                url = context.Request.Url,
                body = context.Request.Body ?? ""
            });

            // Prepare Response state
            string respJson = "null";
            if (context.Response != null)
            {
                respJson = JsonSerializer.Serialize(new
                {
                    status = context.Response.Status,
                    statusText = context.Response.StatusText,
                    headers = context.Response.Headers,
                    body = context.Response.Body ?? "",
                    time = context.Response.TimeMs,
                    size = context.Response.SizeBytes
                });
            }

            // JavaScript Bullet SDK initialization script
            var bootstrapSdk = $$"""
            const __initialReq = {{reqJson}};
            const __initialResp = {{respJson}};

            const bullet = {
                request: {
                    method: __initialReq.method,
                    url: __initialReq.url,
                    body: __initialReq.body,
                    headers: {
                        get: (k) => __reqHeaderGet(k),
                        set: (k, v) => __reqHeaderSet(k, String(v)),
                        has: (k) => __reqHeaderGet(k) !== null,
                        remove: (k) => __reqHeaderRemove(k)
                    }
                },
                response: __initialResp ? {
                    status: __initialResp.status,
                    statusText: __initialResp.statusText,
                    body: __initialResp.body,
                    time: __initialResp.time,
                    size: __initialResp.size,
                    headers: {
                        get: (k) => {
                            if (!k) return null;
                            const lower = k.toLowerCase();
                            for (const key of Object.keys(__initialResp.headers || {})) {
                                if (key.toLowerCase() === lower) return __initialResp.headers[key];
                            }
                            return null;
                        },
                        has: (k) => {
                            if (!k) return false;
                            const lower = k.toLowerCase();
                            return Object.keys(__initialResp.headers || {}).some(x => x.toLowerCase() === lower);
                        }
                    },
                    json: () => {
                        try {
                            return JSON.parse(__initialResp.body || '{}');
                        } catch (e) {
                            return null;
                        }
                    }
                } : null,
                loadout: {
                    get: (k) => __roundGet(k),
                    set: (k, v) => __roundSet(k, String(v)),
                    has: (k) => __roundGet(k) !== null
                },
                rounds: {
                    get: (k) => __roundGet(k),
                    set: (k, v) => __roundSet(k, String(v)),
                    has: (k) => __roundGet(k) !== null
                },
                cookies: {
                    get: (k) => __cookieGet(k),
                    set: (k, v) => __cookieSet(k, String(v))
                },
                crypto: {
                    md5: (str) => __md5(String(str)),
                    sha256: (str) => __sha256(String(str)),
                    base64Encode: (str) => __b64Enc(String(str)),
                    base64Decode: (str) => __b64Dec(String(str))
                },
                console: {
                    log: (...args) => __jsLog(args),
                    info: (...args) => __jsLog(args),
                    warn: (...args) => __jsWarn(args),
                    error: (...args) => __jsError(args)
                },
                expect: function(actual) {
                    return {
                        toBe: (expected) => {
                            if (actual !== expected) throw new Error(`Expected '${expected}' but got '${actual}'`);
                        },
                        notToBe: (expected) => {
                            if (actual === expected) throw new Error(`Expected not '${expected}'`);
                        },
                        toEqual: (expected) => {
                            if (JSON.stringify(actual) !== JSON.stringify(expected))
                                throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
                        },
                        toContain: (expected) => {
                            if (typeof actual === 'string' && !actual.includes(expected))
                                throw new Error(`Expected string to contain '${expected}'`);
                            else if (Array.isArray(actual) && !actual.includes(expected))
                                throw new Error(`Expected array to contain '${expected}'`);
                        },
                        toBeDefined: () => {
                            if (actual === undefined || actual === null) throw new Error("Expected value to be defined");
                        },
                        toBeNull: () => {
                            if (actual !== null) throw new Error(`Expected null but got '${actual}'`);
                        },
                        toBeGreaterThan: (n) => {
                            if (Number(actual) <= Number(n)) throw new Error(`Expected ${actual} > ${n}`);
                        },
                        toBeLessThan: (n) => {
                            if (Number(actual) >= Number(n)) throw new Error(`Expected ${actual} < ${n}`);
                        },
                        toMatch: (pattern) => {
                            const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
                            if (!regex.test(String(actual))) throw new Error(`Value '${actual}' did not match pattern ${pattern}`);
                        }
                    };
                },
                test: function(name, fn) {
                    try {
                        fn();
                        __recordTest(name, true, null);
                    } catch (err) {
                        __recordTest(name, false, err && err.message ? err.message : String(err));
                    }
                }
            };

            const pm = {
                test: bullet.test,
                expect: bullet.expect,
                response: bullet.response ? {
                    ...bullet.response,
                    code: bullet.response.status,
                    status: bullet.response.statusText,
                    responseTime: bullet.response.time,
                    responseSize: bullet.response.size,
                    to: {
                        have: {
                            status: (code) => {
                                if (bullet.response.status !== code)
                                    throw new Error(`Expected status ${code} but got ${bullet.response.status}`);
                            }
                        }
                    }
                } : null,
                request: bullet.request,
                environment: bullet.loadout,
                collectionVariables: bullet.rounds,
                variables: bullet.rounds
            };
            """;

            engine.Execute(bootstrapSdk);
            engine.Execute(script);

            // Sync back modifications to request url and body if modified in script
            var updatedUrl = engine.Evaluate("pm?.request?.url || bullet.request.url").AsString();
            if (!string.IsNullOrEmpty(updatedUrl))
                result.ModifiedUrl = updatedUrl;

            var updatedBody = engine.Evaluate("pm?.request?.body || bullet.request.body").AsString();
            if (updatedBody != null)
                result.ModifiedBody = updatedBody;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
            result.TrajectoryLogs.Add(new TrajectoryEntry
            {
                Step = context.StepName,
                Level = "Error",
                Message = $"Script error: {ex.Message}",
                TimestampUtc = DateTime.UtcNow
            });
        }

        return Task.FromResult(result);
    }
}
