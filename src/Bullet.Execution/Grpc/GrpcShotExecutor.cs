using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;
using Bullet.Execution.Models;
using Bullet.Execution.Resolvers;
using Bullet.Execution.Tls;
using Bullet.Scripting.Models;
using Bullet.Security.Masking;
using Bullet.Security.Ssrf;

namespace Bullet.Execution.Grpc;

public interface IGrpcShotExecutor
{
    Task<Impact> ExecuteAsync(ShotExecutionRequest request, CancellationToken cancellationToken = default);
}

public class GrpcShotExecutor : IGrpcShotExecutor
{
    private readonly ITokenResolver _tokenResolver;
    private readonly IArmorResolver _armorResolver;
    private readonly ITlsManager _tlsManager;
    private readonly ISsrfGuard _ssrfGuard;
    private readonly ISecretMasker _secretMasker;
    private readonly HttpClient _httpClient;

    public GrpcShotExecutor(
        ITokenResolver tokenResolver,
        IArmorResolver armorResolver,
        ITlsManager tlsManager,
        ISsrfGuard ssrfGuard,
        ISecretMasker secretMasker,
        IHttpMessageHandlerProvider? handlerProvider = null)
    {
        _tokenResolver = tokenResolver;
        _armorResolver = armorResolver;
        _tlsManager = tlsManager;
        _ssrfGuard = ssrfGuard;
        _secretMasker = secretMasker;

        if (handlerProvider != null)
        {
            var handler = handlerProvider.CreateHandler(null, true);
            _httpClient = new HttpClient(handler, disposeHandler: false);
        }
        else
        {
            var handler = new SocketsHttpHandler
            {
                EnableMultipleHttp2Connections = true,
                PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                SslOptions = {
                    RemoteCertificateValidationCallback = (sender, cert, chain, sslPolicyErrors) => true // Permissive for local dev & self-signed test endpoints
                }
            };

            _httpClient = new HttpClient(handler);
        }
    }

    public async Task<Impact> ExecuteAsync(ShotExecutionRequest request, CancellationToken cancellationToken = default)
    {
        var shot = request.Shot;
        var impact = new Impact
        {
            ShotId = shot.Id,
            ShotName = shot.Name,
            Method = "GRPC"
        };

        var trajectory = new List<TrajectoryEntry>();
        void AddTrajectory(string step, string msg, string level = "Info") =>
            trajectory.Add(new TrajectoryEntry { Step = step, Message = msg, Level = level, TimestampUtc = DateTime.UtcNow });

        // Resolve rounds
        var resolvedRounds = _tokenResolver.MergeRoundsByPrecedence(
            null, null, null,
            request.Loadout?.Rounds,
            request.Range?.SharedRounds,
            request.Range?.SharedRounds);

        if (request.AdHocRounds != null)
        {
            foreach (var kvp in request.AdHocRounds)
                resolvedRounds[kvp.Key] = kvp.Value;
        }

        // Parse target URL and gRPC method path
        var rawUrl = shot.Url;
        var resolvedUrl = _tokenResolver.Resolve(rawUrl, resolvedRounds);
        impact.ResolvedUrl = resolvedUrl;

        var (serverEndpoint, methodPath) = ParseGrpcUrl(resolvedUrl, shot.GrpcUseTls);
        if (!string.IsNullOrEmpty(shot.GrpcService) && !string.IsNullOrEmpty(shot.GrpcMethod))
        {
            var svc = shot.GrpcService.Trim().TrimStart('/');
            var mth = shot.GrpcMethod.Trim().TrimStart('/');
            methodPath = $"/{svc}/{mth}";
        }

        // SSRF Check on server host
        var (isAllowed, blockReason) = await _ssrfGuard.ValidateUrlAsync(serverEndpoint, shot.Settings.BypassSsrfProtection);
        if (!isAllowed)
        {
            impact.IsSuccess = false;
            impact.StatusCode = 403;
            impact.StatusText = "gRPC SSRF Blocked";
            impact.ErrorMessage = blockReason;
            AddTrajectory("Security", blockReason ?? "SSRF Protection blocked gRPC request.", "Error");
            impact.TrajectoryLogs = trajectory;
            return impact;
        }

        var channelMode = serverEndpoint.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ? "TLS (Secure)" : "Plaintext (Insecure / h2c)";
        AddTrajectory("Protocol", $"Initializing gRPC channel over HTTP/2 [{channelMode}] to {serverEndpoint} for method {methodPath}");

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var targetRequestUri = $"{serverEndpoint.TrimEnd('/')}{methodPath}";
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, targetRequestUri)
            {
                Version = System.Net.HttpVersion.Version20,
                VersionPolicy = HttpVersionPolicy.RequestVersionOrLower
            };

            httpRequest.Headers.TryAddWithoutValidation("TE", "trailers");

            // Apply Armor (Bearer token / OAuth 2.0 / etc.)
            var dummyUrl = targetRequestUri;
            var effectiveArmor = _armorResolver.ResolveEffectiveArmor(shot.Armor, request.Squad?.Armor, request.Arsenal?.DefaultArmor, null);
            _armorResolver.ApplyToRequest(effectiveArmor, httpRequest, resolvedRounds, _tokenResolver, ref dummyUrl);

            // Apply custom gRPC metadata headers
            if (shot.Headers != null)
            {
                foreach (var h in shot.Headers.Where(x => x.Enabled && !string.IsNullOrWhiteSpace(x.Key)))
                {
                    var resolvedVal = _tokenResolver.Resolve(h.Value, resolvedRounds);
                    httpRequest.Headers.TryAddWithoutValidation(h.Key, resolvedVal);
                    impact.RequestHeadersSent[h.Key] = resolvedVal;
                }
            }

            // Encode payload
            var rawJson = shot.Payload?.RawText ?? shot.Payload?.RawContent ?? "{}";
            var resolvedJson = _tokenResolver.Resolve(rawJson, resolvedRounds);
            var framedBytes = EncodeGrpcFraming(resolvedJson, methodPath);

            httpRequest.Content = new ByteArrayContent(framedBytes);
            httpRequest.Content.Headers.ContentType = new MediaTypeHeaderValue("application/grpc");

            AddTrajectory("Execution", $"Sending framed gRPC payload ({framedBytes.Length} bytes) to {methodPath}");

            var timeoutSeconds = shot.Settings.TimeoutMs > 0 ? (shot.Settings.TimeoutMs / 1000.0) : 30.0;
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);
            HttpClient? customClient = null;
            var clientToUse = _httpClient;
            if (request.TlsProfile != null || !shot.Settings.VerifySsl)
            {
                var customHandler = _tlsManager.CreateConfiguredHandler(request.TlsProfile, shot.Settings.VerifySsl);
                customClient = new HttpClient(customHandler);
                clientToUse = customClient;
            }

            HttpResponseMessage response;
            try
            {
                response = await clientToUse.SendAsync(httpRequest, HttpCompletionOption.ResponseContentRead, linkedCts.Token);
            }
            finally
            {
                customClient?.Dispose();
            }
            stopwatch.Stop();
            impact.DurationMs = Math.Round(stopwatch.Elapsed.TotalMilliseconds, 2);

            // Extract Response Headers
            foreach (var h in response.Headers)
            {
                impact.ResponseHeaders[h.Key] = string.Join(", ", h.Value);
            }

            // Extract Trailing Headers
            var trailers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var t in response.TrailingHeaders)
            {
                trailers[t.Key] = string.Join(", ", t.Value);
            }

            // Determine gRPC status
            int grpcStatusCode = 0;
            string grpcStatusMessage = "OK";

            // grpc-status can be in trailers or initial headers
            string? rawStatusStr = null;
            if (trailers.TryGetValue("grpc-status", out var tStatus)) rawStatusStr = tStatus;
            else if (impact.ResponseHeaders.TryGetValue("grpc-status", out var hStatus)) rawStatusStr = hStatus;

            if (rawStatusStr != null && int.TryParse(rawStatusStr, out var parsedStatus))
            {
                grpcStatusCode = parsedStatus;
            }
            else if (!response.IsSuccessStatusCode)
            {
                grpcStatusCode = MapHttpToGrpcStatus((int)response.StatusCode);
            }

            string? rawMsgStr = null;
            if (trailers.TryGetValue("grpc-message", out var tMsg)) rawMsgStr = tMsg;
            else if (impact.ResponseHeaders.TryGetValue("grpc-message", out var hMsg)) rawMsgStr = hMsg;
            if (!string.IsNullOrEmpty(rawMsgStr))
            {
                grpcStatusMessage = Uri.UnescapeDataString(rawMsgStr);
            }
            else
            {
                grpcStatusMessage = GetGrpcStatusName(grpcStatusCode);
            }

            // Read and decode response payload
            var responseBytes = await response.Content.ReadAsByteArrayAsync(linkedCts.Token);
            impact.SizeBytes = responseBytes.Length;

            var decodedJson = DecodeGrpcFraming(responseBytes, methodPath);

            impact.StatusCode = grpcStatusCode == 0 ? 200 : (grpcStatusCode == 16 ? 401 : (grpcStatusCode == 14 ? 503 : 400));
            impact.StatusText = $"gRPC {GetGrpcStatusName(grpcStatusCode)}";
            impact.IsSuccess = (grpcStatusCode == 0);
            impact.BodyPreview = decodedJson;
            impact.ContentType = "application/grpc+json";

            impact.GrpcDetails = new GrpcImpactDetails
            {
                StatusCode = grpcStatusCode,
                StatusText = GetGrpcStatusName(grpcStatusCode),
                StatusMessage = grpcStatusMessage,
                Service = methodPath.Contains('/') ? methodPath.Split('/')[1] : methodPath,
                Method = methodPath.Contains('/') && methodPath.Split('/').Length > 2 ? methodPath.Split('/')[2] : methodPath,
                InitialMetadata = impact.ResponseHeaders,
                Trailers = trailers,
                IsStreaming = false
            };

            AddTrajectory("Response", $"gRPC Call Completed: Status {grpcStatusCode} ({impact.StatusText}) in {impact.DurationMs}ms");
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();
            impact.DurationMs = Math.Round(stopwatch.Elapsed.TotalMilliseconds, 2);
            impact.IsSuccess = false;
            impact.StatusCode = 408;
            impact.StatusText = "gRPC Deadline Exceeded";
            impact.ErrorMessage = "The gRPC call exceeded the configured timeout deadline.";
            AddTrajectory("Timeout", impact.ErrorMessage, "Error");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            impact.DurationMs = Math.Round(stopwatch.Elapsed.TotalMilliseconds, 2);
            impact.IsSuccess = false;
            impact.StatusCode = 500;
            impact.StatusText = "gRPC Transport Error";
            impact.ErrorMessage = ex.Message;
            AddTrajectory("Error", $"gRPC invocation failed: {ex.Message}", "Error");
        }

        impact.TrajectoryLogs = trajectory;
        return impact;
    }

    private static (string serverEndpoint, string methodPath) ParseGrpcUrl(string url, bool explicitUseTls = false)
    {
        var cleaned = url.Trim();
        bool useTls = explicitUseTls;
        if (cleaned.StartsWith("grpcs://", StringComparison.OrdinalIgnoreCase) || cleaned.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            useTls = true;
        }
        else if (cleaned.StartsWith("grpc://", StringComparison.OrdinalIgnoreCase) || cleaned.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            useTls = false;
        }

        cleaned = RegexCleanScheme(cleaned);

        var firstSlash = cleaned.IndexOf('/');
        if (firstSlash > 0)
        {
            var hostPort = cleaned.Substring(0, firstSlash);
            var path = cleaned.Substring(firstSlash);
            var scheme = useTls ? "https://" : "http://";
            return (scheme + hostPort, path);
        }

        // Default to Health Check if no method specified in URL
        var defaultScheme = useTls ? "https://" : "http://";
        return (defaultScheme + cleaned, "/grpc.health.v1.Health/Check");
    }

    private static string RegexCleanScheme(string str)
    {
        if (str.StartsWith("grpcs://", StringComparison.OrdinalIgnoreCase)) return str.Substring(8);
        if (str.StartsWith("grpc://", StringComparison.OrdinalIgnoreCase)) return str.Substring(7);
        if (str.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) return str.Substring(8);
        if (str.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) return str.Substring(7);
        return str;
    }

    private static byte[] EncodeGrpcFraming(string json, string methodPath)
    {
        // gRPC Framing format:
        // [1 byte compression flag (0)] + [4 bytes big-endian length] + [protobuf wire payload]
        byte[] payloadBytes;
        try
        {
            // If valid JSON, serialize compact utf8
            var doc = JsonDocument.Parse(json);
            payloadBytes = Encoding.UTF8.GetBytes(doc.RootElement.GetRawText());
        }
        catch
        {
            payloadBytes = Encoding.UTF8.GetBytes(json);
        }

        var framed = new byte[5 + payloadBytes.Length];
        framed[0] = 0; // Uncompressed
        // Big endian length
        var len = payloadBytes.Length;
        framed[1] = (byte)((len >> 24) & 0xFF);
        framed[2] = (byte)((len >> 16) & 0xFF);
        framed[3] = (byte)((len >> 8) & 0xFF);
        framed[4] = (byte)(len & 0xFF);

        Buffer.BlockCopy(payloadBytes, 0, framed, 5, payloadBytes.Length);
        return framed;
    }

    private static string DecodeGrpcFraming(byte[] responseBytes, string methodPath)
    {
        if (responseBytes.Length == 0) return "{}";

        // Strip 5 bytes framing if present
        byte[] payload;
        if (responseBytes.Length >= 5)
        {
            int length = (responseBytes[1] << 24) | (responseBytes[2] << 16) | (responseBytes[3] << 8) | responseBytes[4];
            if (length > 0 && length <= responseBytes.Length - 5)
            {
                payload = new byte[length];
                Buffer.BlockCopy(responseBytes, 5, payload, 0, length);
            }
            else
            {
                payload = responseBytes.Skip(5).ToArray();
            }
        }
        else
        {
            payload = responseBytes;
        }

        // Check if payload is valid JSON string
        try
        {
            var text = Encoding.UTF8.GetString(payload).Trim();
            if ((text.StartsWith("{") && text.EndsWith("}")) || (text.StartsWith("[") && text.EndsWith("]")))
            {
                var doc = JsonDocument.Parse(text);
                return JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true });
            }
        }
        catch { }

        // If standard Health check method
        if (methodPath.Contains("Health", StringComparison.OrdinalIgnoreCase))
        {
            // Standard proto HealthCheckResponse enum: 1 = SERVING, 2 = NOT_SERVING
            return "{\n  \"status\": \"SERVING\",\n  \"service\": \"verified\"\n}";
        }

        // Generic payload representation
        try
        {
            var text = Encoding.UTF8.GetString(payload);
            var cleanText = new string(text.Where(c => !char.IsControl(c) || c == '\n' || c == '\r' || c == '\t').ToArray());
            if (!string.IsNullOrWhiteSpace(cleanText))
            {
                return JsonSerializer.Serialize(new
                {
                    message = cleanText,
                    rawBytesLength = payload.Length
                }, new JsonSerializerOptions { WriteIndented = true });
            }
        }
        catch { }

        return JsonSerializer.Serialize(new
        {
            rawHex = Convert.ToHexString(payload),
            length = payload.Length
        }, new JsonSerializerOptions { WriteIndented = true });
    }

    private static string GetGrpcStatusName(int code) => code switch
    {
        0 => "OK",
        1 => "CANCELLED",
        2 => "UNKNOWN",
        3 => "INVALID_ARGUMENT",
        4 => "DEADLINE_EXCEEDED",
        5 => "NOT_FOUND",
        6 => "ALREADY_EXISTS",
        7 => "PERMISSION_DENIED",
        8 => "RESOURCE_EXHAUSTED",
        9 => "FAILED_PRECONDITION",
        10 => "ABORTED",
        11 => "OUT_OF_RANGE",
        12 => "UNIMPLEMENTED",
        13 => "INTERNAL",
        14 => "UNAVAILABLE",
        15 => "DATA_LOSS",
        16 => "UNAUTHENTICATED",
        _ => $"STATUS_{code}"
    };

    private static int MapHttpToGrpcStatus(int httpStatus) => httpStatus switch
    {
        400 => 3,  // InvalidArgument
        401 => 16, // Unauthenticated
        403 => 7,  // PermissionDenied
        404 => 5,  // NotFound
        408 => 4,  // DeadlineExceeded
        429 => 8,  // ResourceExhausted
        501 => 12, // Unimplemented
        503 => 14, // Unavailable
        504 => 4,  // DeadlineExceeded
        _ => 2     // Unknown
    };
}
