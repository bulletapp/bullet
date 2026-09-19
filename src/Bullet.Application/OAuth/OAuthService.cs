using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Bullet.Application.OAuth;

public interface IOAuthService
{
    Task<OAuthTokenResponse> RequestTokenAsync(OAuthTokenRequest request, CancellationToken cancellationToken = default);
    PkcePair GeneratePkce();
}

public class OAuthService : IOAuthService
{
    private readonly HttpClient _httpClient;

    public OAuthService(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? new HttpClient();
    }

    public async Task<OAuthTokenResponse> RequestTokenAsync(OAuthTokenRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.AccessTokenUrl))
        {
            return new OAuthTokenResponse
            {
                Success = false,
                ErrorMessage = "Access Token URL is required."
            };
        }

        try
        {
            var formParams = new Dictionary<string, string>
            {
                ["grant_type"] = request.GrantType
            };

            var clientAuthInHeader = string.Equals(request.ClientAuth, "header", StringComparison.OrdinalIgnoreCase);

            // Add Grant-specific parameters
            switch (request.GrantType.ToLowerInvariant())
            {
                case "client_credentials":
                    if (!clientAuthInHeader)
                    {
                        if (!string.IsNullOrEmpty(request.ClientId)) formParams["client_id"] = request.ClientId;
                        if (!string.IsNullOrEmpty(request.ClientSecret)) formParams["client_secret"] = request.ClientSecret;
                    }
                    if (!string.IsNullOrEmpty(request.Scope)) formParams["scope"] = request.Scope;
                    break;

                case "password":
                    if (!string.IsNullOrEmpty(request.Username)) formParams["username"] = request.Username;
                    if (!string.IsNullOrEmpty(request.Password)) formParams["password"] = request.Password;
                    if (!clientAuthInHeader)
                    {
                        if (!string.IsNullOrEmpty(request.ClientId)) formParams["client_id"] = request.ClientId;
                        if (!string.IsNullOrEmpty(request.ClientSecret)) formParams["client_secret"] = request.ClientSecret;
                    }
                    if (!string.IsNullOrEmpty(request.Scope)) formParams["scope"] = request.Scope;
                    break;

                case "authorization_code":
                    if (!string.IsNullOrEmpty(request.Code)) formParams["code"] = request.Code;
                    if (!string.IsNullOrEmpty(request.RedirectUri)) formParams["redirect_uri"] = request.RedirectUri;
                    if (!string.IsNullOrEmpty(request.CodeVerifier)) formParams["code_verifier"] = request.CodeVerifier;
                    if (!clientAuthInHeader)
                    {
                        if (!string.IsNullOrEmpty(request.ClientId)) formParams["client_id"] = request.ClientId;
                        if (!string.IsNullOrEmpty(request.ClientSecret)) formParams["client_secret"] = request.ClientSecret;
                    }
                    break;

                case "refresh_token":
                    if (!string.IsNullOrEmpty(request.RefreshToken)) formParams["refresh_token"] = request.RefreshToken;
                    if (!clientAuthInHeader)
                    {
                        if (!string.IsNullOrEmpty(request.ClientId)) formParams["client_id"] = request.ClientId;
                        if (!string.IsNullOrEmpty(request.ClientSecret)) formParams["client_secret"] = request.ClientSecret;
                    }
                    if (!string.IsNullOrEmpty(request.Scope)) formParams["scope"] = request.Scope;
                    break;

                default:
                    if (!string.IsNullOrEmpty(request.ClientId)) formParams["client_id"] = request.ClientId;
                    if (!string.IsNullOrEmpty(request.ClientSecret)) formParams["client_secret"] = request.ClientSecret;
                    break;
            }

            // Custom Parameters
            if (request.CustomParameters != null)
            {
                foreach (var kvp in request.CustomParameters)
                {
                    formParams[kvp.Key] = kvp.Value;
                }
            }

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, request.AccessTokenUrl)
            {
                Content = new FormUrlEncodedContent(formParams)
            };

            httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            // Basic Auth Header if configured
            if (clientAuthInHeader && !string.IsNullOrEmpty(request.ClientId))
            {
                var secret = request.ClientSecret ?? "";
                var creds = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{request.ClientId}:{secret}"));
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", creds);
            }

            using var httpResponse = await _httpClient.SendAsync(httpRequest, cancellationToken);
            var responseBody = await httpResponse.Content.ReadAsStringAsync(cancellationToken);

            if (!httpResponse.IsSuccessStatusCode)
            {
                string errorMsg = $"HTTP {(int)httpResponse.StatusCode} {httpResponse.ReasonPhrase}";
                try
                {
                    var errorJson = JsonNode.Parse(responseBody);
                    var desc = errorJson?["error_description"]?.ToString() ?? errorJson?["error"]?.ToString() ?? errorJson?["message"]?.ToString();
                    if (!string.IsNullOrEmpty(desc)) errorMsg = desc;
                }
                catch { }

                return new OAuthTokenResponse
                {
                    Success = false,
                    ErrorMessage = errorMsg,
                    RawResponse = responseBody
                };
            }

            var tokenData = JsonNode.Parse(responseBody);
            if (tokenData == null)
            {
                return new OAuthTokenResponse
                {
                    Success = false,
                    ErrorMessage = "Failed to parse token response JSON.",
                    RawResponse = responseBody
                };
            }

            var accessToken = tokenData["access_token"]?.ToString();
            if (string.IsNullOrEmpty(accessToken))
            {
                return new OAuthTokenResponse
                {
                    Success = false,
                    ErrorMessage = "No access_token field found in response.",
                    RawResponse = responseBody
                };
            }

            var tokenType = tokenData["token_type"]?.ToString() ?? "Bearer";
            var refreshToken = tokenData["refresh_token"]?.ToString();
            var scope = tokenData["scope"]?.ToString();
            var idToken = tokenData["id_token"]?.ToString();

            int? expiresIn = null;
            if (int.TryParse(tokenData["expires_in"]?.ToString(), out var exp))
            {
                expiresIn = exp;
            }

            DateTime? expiresAt = expiresIn.HasValue ? DateTime.UtcNow.AddSeconds(expiresIn.Value) : null;

            return new OAuthTokenResponse
            {
                Success = true,
                AccessToken = accessToken,
                TokenType = tokenType,
                ExpiresIn = expiresIn,
                ExpiresAtUtc = expiresAt,
                RefreshToken = refreshToken,
                Scope = scope,
                IdToken = idToken,
                RawResponse = responseBody
            };
        }
        catch (Exception ex)
        {
            return new OAuthTokenResponse
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public PkcePair GeneratePkce()
    {
        // Generate 32 bytes of secure random data -> 43 characters Base64Url
        var bytes = RandomNumberGenerator.GetBytes(32);
        var codeVerifier = Base64UrlEncode(bytes);

        // SHA-256 hash of the verifier
        var hash = SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier));
        var codeChallenge = Base64UrlEncode(hash);

        return new PkcePair
        {
            CodeVerifier = codeVerifier,
            CodeChallenge = codeChallenge,
            CodeChallengeMethod = "S256"
        };
    }

    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
