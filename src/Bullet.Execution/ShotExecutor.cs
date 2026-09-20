using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;
using Bullet.Execution.Models;
using Bullet.Execution.Resolvers;
using Bullet.Execution.Tls;
using Bullet.Scripting;
using Bullet.Scripting.Models;
using Bullet.Security.Masking;
using Bullet.Security.Ssrf;

namespace Bullet.Execution;

public interface IShotExecutor
{
    Task<Impact> FireAsync(ShotExecutionRequest request, CancellationToken cancellationToken = default);
}

public class ShotExecutor : IShotExecutor
{
    private readonly ITokenResolver _tokenResolver;
    private readonly IArmorResolver _armorResolver;
    private readonly ITlsManager _tlsManager;
    private readonly IHttpMessageHandlerProvider _handlerProvider;
    private readonly ISsrfGuard _ssrfGuard;
    private readonly IScriptSandbox _sandbox;
    private readonly ISecretMasker _secretMasker;
    private readonly Bullet.Execution.Grpc.IGrpcShotExecutor _grpcExecutor;

    public ShotExecutor(
        ITokenResolver tokenResolver,
        IArmorResolver armorResolver,
        ITlsManager tlsManager,
        ISsrfGuard ssrfGuard,
        IScriptSandbox sandbox,
        ISecretMasker secretMasker,
        IHttpMessageHandlerProvider? handlerProvider = null,
        Bullet.Execution.Grpc.IGrpcShotExecutor? grpcExecutor = null)
    {
        _tokenResolver = tokenResolver;
        _armorResolver = armorResolver;
        _tlsManager = tlsManager;
        _ssrfGuard = ssrfGuard;
        _sandbox = sandbox;
        _secretMasker = secretMasker;
        _handlerProvider = handlerProvider ?? new DefaultHttpMessageHandlerProvider(tlsManager);
        _grpcExecutor = grpcExecutor ?? new Bullet.Execution.Grpc.GrpcShotExecutor(tokenResolver, armorResolver, tlsManager, ssrfGuard, secretMasker);
    }

    public async Task<Impact> FireAsync(ShotExecutionRequest request, CancellationToken cancellationToken = default)
    {
        var shot = request.Shot;

        // Route gRPC protocol execution
        if (string.Equals(shot.Method, "GRPC", StringComparison.OrdinalIgnoreCase))
        {
            return await _grpcExecutor.ExecuteAsync(request, cancellationToken);
        }

        var impact = new Impact
        {
            ShotId = shot.Id,
            ShotName = shot.Name,
            Method = shot.Method.ToUpperInvariant()
        };

        var trajectory = new List<TrajectoryEntry>();
        void AddTrajectory(string step, string msg, string level = "Info") =>
            trajectory.Add(new TrajectoryEntry { Step = step, Message = msg, Level = level, TimestampUtc = DateTime.UtcNow });

        // Step 1 & 2: Resolve Loadout & Rounds (Shot > Squad > Arsenal > Loadout > Range > Shared)
        var resolvedRounds = _tokenResolver.MergeRoundsByPrecedence(
            null, // Shot-level ad-hoc rounds
            null,
            null,
            request.Loadout?.Rounds,
            request.Range?.SharedRounds,
            request.Range?.SharedRounds);

        if (request.AdHocRounds != null)
        {
            foreach (var kvp in request.AdHocRounds)
                resolvedRounds[kvp.Key] = kvp.Value;
        }

        // Step 3: Resolve Tokens & Path Parameters in URL
        var rawUrl = shot.Url;
        var resolvedUrl = _tokenResolver.Resolve(rawUrl, resolvedRounds);

        // Substitute Path Parameters (e.g. :userId or {userId}) from shot.Parameters
        var pathParams = shot.Parameters.Where(p => p.Enabled && p.Type == ParameterType.Path && !string.IsNullOrWhiteSpace(p.Key)).ToList();
        foreach (var p in pathParams)
        {
            var pKey = _tokenResolver.Resolve(p.Key, resolvedRounds).TrimStart(':');
            var pVal = _tokenResolver.Resolve(p.Value, resolvedRounds);
            resolvedUrl = resolvedUrl.Replace($":{pKey}", Uri.EscapeDataString(pVal))
                                     .Replace($"{{{pKey}}}", Uri.EscapeDataString(pVal));
        }

        impact.ResolvedUrl = resolvedUrl;

        // Step 4: SSRF Check
        var (isAllowed, blockReason) = await _ssrfGuard.ValidateUrlAsync(resolvedUrl, shot.Settings.BypassSsrfProtection);
        if (!isAllowed)
        {
            impact.IsSuccess = false;
            impact.StatusCode = 403;
            impact.StatusText = "Forbidden by SSRF Protection";
            impact.ErrorMessage = blockReason;
            AddTrajectory("Security", blockReason ?? "SSRF Protection blocked request.", "Error");
            impact.TrajectoryLogs = trajectory;
            return impact;
        }

        // Step 5: Resolve Armor
        var effectiveArmor = _armorResolver.ResolveEffectiveArmor(
            shot.Armor,
            request.Squad?.Armor,
            request.Arsenal?.DefaultArmor,
            null);

        // Step 6: Prepare headers & parameters
        var headersDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var h in shot.Headers.Where(x => x.Enabled && !string.IsNullOrWhiteSpace(x.Key)))
        {
            headersDict[h.Key.Trim()] = _tokenResolver.Resolve(h.Value, resolvedRounds);
        }

        // Build query string
        var queryParams = shot.Parameters.Where(p => p.Enabled && p.Type == ParameterType.Query).ToList();
        if (queryParams.Count > 0)
        {
            var sb = new StringBuilder();
            sb.Append(resolvedUrl.Contains('?') ? "&" : "?");
            for (var i = 0; i < queryParams.Count; i++)
            {
                if (i > 0) sb.Append('&');
                var k = _tokenResolver.Resolve(queryParams[i].Key, resolvedRounds);
                var v = _tokenResolver.Resolve(queryParams[i].Value, resolvedRounds);
                sb.Append(Uri.EscapeDataString(k)).Append('=').Append(Uri.EscapeDataString(v));
            }
            resolvedUrl += sb.ToString();
            impact.ResolvedUrl = resolvedUrl;
        }

        // Resolve Payload
        string? resolvedPayloadBody = null;
        if (shot.Payload.Type == PayloadType.Json || shot.Payload.Type == PayloadType.Xml || shot.Payload.Type == PayloadType.PlainText)
        {
            resolvedPayloadBody = _tokenResolver.Resolve(shot.Payload.RawContent, resolvedRounds);
        }
        else if (shot.Payload.Type == PayloadType.GraphQL)
        {
            var gqQuery = _tokenResolver.Resolve(shot.Payload.GraphQLQuery, resolvedRounds);
            var gqVars = _tokenResolver.Resolve(shot.Payload.GraphQLVariables, resolvedRounds);
            resolvedPayloadBody = JsonSerializer.Serialize(new { query = gqQuery, variables = string.IsNullOrWhiteSpace(gqVars) ? null : JsonSerializer.Deserialize<object>(gqVars) });
        }

        // Step 7: Execute Trigger Script (Hierarchy: Arsenal -> Squad -> Shot)
        var triggerScript = shot.TriggerScript ?? request.Squad?.TriggerScript ?? request.Arsenal?.TriggerScript;
        if (!string.IsNullOrWhiteSpace(triggerScript))
        {
            AddTrajectory("Trigger", "Executing pre-request Trigger script...");
            var triggerContext = new ScriptExecutionContext
            {
                StepName = "Trigger",
                Request = new ScriptRequestModel
                {
                    Method = shot.Method,
                    Url = resolvedUrl,
                    Headers = headersDict,
                    Body = resolvedPayloadBody
                },
                Rounds = resolvedRounds,
                Cookies = request.InitialCookies ?? new Dictionary<string, string>()
            };

            var triggerResult = await _sandbox.ExecuteAsync(triggerScript, triggerContext, cancellationToken);
            trajectory.AddRange(triggerResult.TrajectoryLogs);

            if (!triggerResult.Success)
            {
                AddTrajectory("Trigger", $"Trigger script halted execution: {triggerResult.ErrorMessage}", "Error");
            }

            // Apply trigger updates
            if (!string.IsNullOrEmpty(triggerResult.ModifiedUrl))
                resolvedUrl = triggerResult.ModifiedUrl;

            resolvedPayloadBody = triggerResult.ModifiedBody;
            foreach (var kvp in triggerResult.ModifiedHeaders)
                headersDict[kvp.Key] = kvp.Value;

            foreach (var kvp in triggerResult.UpdatedRounds)
                resolvedRounds[kvp.Key] = kvp.Value;
        }

        impact.ResolvedUrl = resolvedUrl;

        // Step 8: Build HttpRequestMessage
        var httpMethod = new HttpMethod(shot.Method);
        using var httpRequest = new HttpRequestMessage(httpMethod, resolvedUrl);

        // Apply Armor
        _armorResolver.ApplyToRequest(effectiveArmor, httpRequest, resolvedRounds, _tokenResolver, ref resolvedUrl);
        httpRequest.RequestUri = new Uri(resolvedUrl, UriKind.RelativeOrAbsolute);
        impact.ResolvedUrl = resolvedUrl;

        // Apply Headers
        foreach (var kvp in headersDict)
        {
            if (kvp.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
                continue; // Handled on HttpContent
            httpRequest.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
        }

        // Inject Cookie Locker session cookies if not explicitly set in headers
        if (!headersDict.ContainsKey("Cookie") && request.InitialCookies != null && request.InitialCookies.Count > 0)
        {
            var cookieHeader = string.Join("; ", request.InitialCookies.Select(c => $"{c.Key}={c.Value}"));
            httpRequest.Headers.TryAddWithoutValidation("Cookie", cookieHeader);
            AddTrajectory("Cookie", $"Injected {request.InitialCookies.Count} session cookie(s)");
        }

        // Apply Body
        if (shot.Payload.Type != PayloadType.None && (httpMethod != HttpMethod.Get && httpMethod != HttpMethod.Head))
        {
            if (shot.Payload.Type == PayloadType.FormUrlEncoded)
            {
                var formData = shot.Payload.FormData
                    .Where(x => x.Enabled)
                    .Select(x => new KeyValuePair<string, string>(
                        _tokenResolver.Resolve(x.Key, resolvedRounds),
                        _tokenResolver.Resolve(x.Value, resolvedRounds)))
                    .ToList();
                httpRequest.Content = new FormUrlEncodedContent(formData);
            }
            else if (shot.Payload.Type == PayloadType.Multipart)
            {
                var multipart = new MultipartFormDataContent();
                foreach (var item in shot.Payload.MultipartData.Where(x => x.Enabled))
                {
                    var k = _tokenResolver.Resolve(item.Key, resolvedRounds);
                    if (item.IsFile && item.BinaryContent != null)
                    {
                        var byteContent = new ByteArrayContent(item.BinaryContent);
                        if (!string.IsNullOrEmpty(item.ContentType))
                            byteContent.Headers.ContentType = MediaTypeHeaderValue.Parse(item.ContentType);
                        multipart.Add(byteContent, k, item.FileName ?? "file.bin");
                    }
                    else
                    {
                        var v = _tokenResolver.Resolve(item.Value ?? "", resolvedRounds);
                        multipart.Add(new StringContent(v), k);
                    }
                }
                httpRequest.Content = multipart;
            }
            else if (!string.IsNullOrEmpty(resolvedPayloadBody))
            {
                var mediaType = shot.Payload.Type switch
                {
                    PayloadType.Json => "application/json",
                    PayloadType.GraphQL => "application/json",
                    PayloadType.Xml => "application/xml",
                    _ => "text/plain"
                };

                httpRequest.Content = new StringContent(resolvedPayloadBody, Encoding.UTF8, mediaType);
            }
        }

        // Record outgoing request trajectory
        AddTrajectory("Request", $"{shot.Method.ToUpperInvariant()} {resolvedUrl}");
        foreach (var header in httpRequest.Headers)
        {
            var val = string.Join(", ", header.Value);
            var maskedVal = _secretMasker.MaskHeader(header.Key, val);
            impact.RequestHeadersSent[header.Key] = maskedVal;
            AddTrajectory("Headers", $"{header.Key}: {maskedVal}");
        }

        // Step 9: Configure TLS & SocketsHttpHandler
        var verifySsl = shot.Settings.VerifySsl;
        var handler = _handlerProvider.CreateHandler(request.TlsProfile, verifySsl);
        using var client = new HttpClient(handler, disposeHandler: false)
        {
            Timeout = TimeSpan.FromMilliseconds(shot.Settings.TimeoutMs > 0 ? shot.Settings.TimeoutMs : 30000)
        };

        // Step 10: Fire Request with stopwatch
        var sw = Stopwatch.StartNew();
        HttpResponseMessage? httpResponse = null;

        try
        {
            var tlsDesc = !verifySsl 
                ? "SSL certificate verification: DISABLED (accepting all certificates)" 
                : (request.TlsProfile != null ? $"Bulletproof TLS profile active: {request.TlsProfile.Name}" : "Standard TLS (Verify SSL enabled)");
            AddTrajectory("TLS", tlsDesc);
            httpResponse = await client.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            var ttfbMs = sw.Elapsed.TotalMilliseconds;
            impact.Timing.TtfbMs = ttfbMs;

            impact.StatusCode = (int)httpResponse.StatusCode;
            impact.StatusText = httpResponse.ReasonPhrase ?? httpResponse.StatusCode.ToString();
            impact.IsSuccess = httpResponse.IsSuccessStatusCode;

            // Capture response headers
            foreach (var h in httpResponse.Headers)
                impact.ResponseHeaders[h.Key] = string.Join(", ", h.Value);

            if (httpResponse.Content?.Headers != null)
            {
                foreach (var h in httpResponse.Content.Headers)
                    impact.ResponseHeaders[h.Key] = string.Join(", ", h.Value);
                impact.ContentType = httpResponse.Content.Headers.ContentType?.MediaType;
            }

            // Extract cookies according to RFC 6265
            var setCookieHeaders = new List<string>();
            if (httpResponse.Headers.TryGetValues("Set-Cookie", out var scValues))
            {
                setCookieHeaders.AddRange(scValues);
            }
            if (httpResponse.Content?.Headers != null && httpResponse.Content.Headers.TryGetValues("Set-Cookie", out var cscValues))
            {
                setCookieHeaders.AddRange(cscValues);
            }
            if (setCookieHeaders.Count == 0 && impact.ResponseHeaders.TryGetValue("Set-Cookie", out var fallbackSc))
            {
                setCookieHeaders.Add(fallbackSc);
            }

            foreach (var sc in setCookieHeaders)
            {
                var parsedCookie = ParseSetCookieHeader(sc);
                if (parsedCookie != null)
                {
                    impact.Cookies.Add(parsedCookie);
                }
            }

            // Read response body (capped at 2MB for memory safety)
            if (httpResponse.Content != null)
            {
                var contentBytes = await httpResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                impact.SizeBytes = contentBytes.LongLength;

                var isBinaryType = impact.ContentType != null &&
                    (impact.ContentType.StartsWith("image/") ||
                     impact.ContentType.StartsWith("audio/") ||
                     impact.ContentType.StartsWith("video/") ||
                     impact.ContentType.Contains("octet-stream") ||
                     impact.ContentType.Contains("pdf"));

                impact.IsBinary = isBinaryType;

                if (isBinaryType)
                {
                    impact.RawBytes = contentBytes;
                    impact.BodyPreview = $"[Binary content: {contentBytes.Length} bytes, type: {impact.ContentType}]";
                }
                else
                {
                    // Max 2MB string preview
                    var maxLen = Math.Min(contentBytes.Length, 2 * 1024 * 1024);
                    impact.BodyPreview = Encoding.UTF8.GetString(contentBytes, 0, maxLen);
                }
            }

            sw.Stop();
            impact.DurationMs = sw.Elapsed.TotalMilliseconds;
            impact.Timing.TotalMs = impact.DurationMs;
            impact.Timing.ContentDownloadMs = Math.Max(0, impact.DurationMs - ttfbMs);

            AddTrajectory("Timing", $"TTFB: {impact.Timing.TtfbMs:F1}ms | Total: {impact.Timing.TotalMs:F1}ms");
            AddTrajectory("Impact", $"{impact.StatusCode} {impact.StatusText} ({impact.DurationMs:F0}ms, {impact.SizeBytes} bytes)", impact.IsSuccess ? "Success" : "Warn");

            // Step 11: Execute Verifiers (Shot > Squad > Arsenal)
            var verifierScript = shot.VerifierScript ?? request.Squad?.VerifierScript ?? request.Arsenal?.VerifierScript;
            if (!string.IsNullOrWhiteSpace(verifierScript))
            {
                AddTrajectory("Verifier", "Executing post-request Verifier assertions...");
                var verifierContext = new ScriptExecutionContext
                {
                    StepName = "Verifier",
                    Request = new ScriptRequestModel
                    {
                        Method = shot.Method,
                        Url = resolvedUrl,
                        Headers = headersDict,
                        Body = resolvedPayloadBody
                    },
                    Response = new ScriptResponseModel
                    {
                        Status = impact.StatusCode,
                        StatusText = impact.StatusText,
                        Headers = impact.ResponseHeaders,
                        Body = impact.BodyPreview,
                        TimeMs = impact.DurationMs,
                        SizeBytes = impact.SizeBytes
                    },
                    Rounds = resolvedRounds,
                    Cookies = request.InitialCookies ?? new Dictionary<string, string>()
                };

                var verifierResult = await _sandbox.ExecuteAsync(verifierScript, verifierContext, cancellationToken);
                trajectory.AddRange(verifierResult.TrajectoryLogs);
                impact.Verifications = verifierResult.Verifications;

                foreach (var kvp in verifierResult.UpdatedRounds)
                    impact.ExportedRounds[kvp.Key] = kvp.Value;
            }
        }
        catch (OperationCanceledException)
        {
            sw.Stop();
            impact.DurationMs = sw.Elapsed.TotalMilliseconds;
            impact.StatusCode = 499;
            impact.StatusText = "Client Closed Request (Cancelled)";
            impact.ErrorMessage = "Execution was cancelled by the user.";
            AddTrajectory("Execution", "Shot execution cancelled.", "Warn");
        }
        catch (Exception ex)
        {
            sw.Stop();
            impact.DurationMs = sw.Elapsed.TotalMilliseconds;
            impact.StatusCode = 0;

            var isSslError = ex is System.Security.Authentication.AuthenticationException ||
                             ex.InnerException is System.Security.Authentication.AuthenticationException ||
                             ex.Message.Contains("SSL", StringComparison.OrdinalIgnoreCase) ||
                             ex.Message.Contains("certificate", StringComparison.OrdinalIgnoreCase);

            impact.StatusText = isSslError ? "SSL Error" : "Could not get response";

            var detailedMessage = ex.Message;
            if (ex.InnerException != null)
            {
                detailedMessage = $"{ex.Message} -> {ex.InnerException.Message}";
                if (ex.InnerException.InnerException != null)
                {
                    detailedMessage += $" -> {ex.InnerException.InnerException.Message}";
                }
            }
            impact.ErrorMessage = detailedMessage;

            var targetHost = Uri.TryCreate(resolvedUrl, UriKind.Absolute, out var u) ? u.Host : "unknown";
            impact.TlsDiagnostics = TlsDiagnostics.DiagnoseFailure(ex, targetHost, request.TlsProfile);

            AddTrajectory("Error", $"Request failed: {detailedMessage}", "Error");
            if (impact.TlsDiagnostics.PotentialIssues.Count > 0)
            {
                foreach (var issue in impact.TlsDiagnostics.PotentialIssues)
                    AddTrajectory("TLS", issue, "Error");
                AddTrajectory("TLS Recommendation", impact.TlsDiagnostics.Recommendation, "Warn");
            }
        }
        finally
        {
            httpResponse?.Dispose();
        }

        impact.TrajectoryLogs = trajectory;
        return impact;
    }

    public static ImpactCookie? ParseSetCookieHeader(string rawHeader)
    {
        if (string.IsNullOrWhiteSpace(rawHeader)) return null;

        var parts = rawHeader.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return null;

        // First part is name=value
        var nameValuePart = parts[0];
        var eqIdx = nameValuePart.IndexOf('=');
        if (eqIdx <= 0) return null;

        var name = nameValuePart[..eqIdx].Trim();
        var val = nameValuePart[(eqIdx + 1)..].Trim();

        var cookie = new ImpactCookie
        {
            Name = name,
            Value = val,
            Path = "/"
        };

        for (var i = 1; i < parts.Length; i++)
        {
            var directive = parts[i];
            var dirEq = directive.IndexOf('=');
            var dirName = (dirEq > 0 ? directive[..dirEq] : directive).Trim();
            var dirVal = dirEq > 0 ? directive[(dirEq + 1)..].Trim() : string.Empty;

            if (dirName.Equals("Path", StringComparison.OrdinalIgnoreCase))
            {
                cookie.Path = string.IsNullOrEmpty(dirVal) ? "/" : dirVal;
            }
            else if (dirName.Equals("Domain", StringComparison.OrdinalIgnoreCase))
            {
                cookie.Domain = dirVal.TrimStart('.');
            }
            else if (dirName.Equals("Expires", StringComparison.OrdinalIgnoreCase))
            {
                if (DateTime.TryParse(dirVal, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal, out var dt))
                {
                    cookie.Expires = dt;
                }
            }
            else if (dirName.Equals("Max-Age", StringComparison.OrdinalIgnoreCase))
            {
                if (int.TryParse(dirVal, out var maxAgeSec))
                {
                    cookie.Expires = DateTime.UtcNow.AddSeconds(maxAgeSec);
                }
            }
            else if (dirName.Equals("HttpOnly", StringComparison.OrdinalIgnoreCase))
            {
                cookie.HttpOnly = true;
            }
            else if (dirName.Equals("Secure", StringComparison.OrdinalIgnoreCase))
            {
                cookie.Secure = true;
            }
            else if (dirName.Equals("SameSite", StringComparison.OrdinalIgnoreCase))
            {
                cookie.SameSite = dirVal;
            }
        }

        return cookie;
    }
}
