using System.Text;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;

namespace Bullet.Application.CodeShot;

public interface ICodeShotService
{
    string Generate(Shot shot, string language, string? resolvedUrl = null, Dictionary<string, string>? resolvedHeaders = null);
    IEnumerable<string> SupportedLanguages { get; }
}

public class CodeShotService : ICodeShotService
{
    public IEnumerable<string> SupportedLanguages => new[]
    {
        "csharp", "typescript", "javascript", "python", "curl", "go", "rust", "java", "php", "swift"
    };

    public string Generate(Shot shot, string language, string? resolvedUrl = null, Dictionary<string, string>? resolvedHeaders = null)
    {
        var url = string.IsNullOrWhiteSpace(resolvedUrl) ? shot.Url : resolvedUrl;
        var method = shot.Method.ToUpperInvariant();
        var body = shot.Payload.RawContent ?? "";

        var headers = resolvedHeaders != null 
            ? new Dictionary<string, string>(resolvedHeaders, StringComparer.OrdinalIgnoreCase)
            : shot.Headers.Where(h => h.Enabled).ToDictionary(h => h.Key, h => h.Value, StringComparer.OrdinalIgnoreCase);

        // Apply Armor credentials to headers if not already set
        if (shot.Armor != null && shot.Armor.Type != ArmorType.None && shot.Armor.Type != ArmorType.Inherit)
        {
            if (shot.Armor.Type == ArmorType.Bearer)
            {
                var token = shot.Armor.GetProperty("token");
                if (!string.IsNullOrEmpty(token) && !headers.ContainsKey("Authorization"))
                {
                    headers["Authorization"] = $"Bearer {token}";
                }
            }
            else if (shot.Armor.Type == ArmorType.Basic)
            {
                var username = shot.Armor.GetProperty("username") ?? "";
                var password = shot.Armor.GetProperty("password") ?? "";
                if ((!string.IsNullOrEmpty(username) || !string.IsNullOrEmpty(password)) && !headers.ContainsKey("Authorization"))
                {
                    var creds = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
                    headers["Authorization"] = $"Basic {creds}";
                }
            }
            else if (shot.Armor.Type == ArmorType.ApiKey)
            {
                var key = shot.Armor.GetProperty("key");
                var val = shot.Armor.GetProperty("value") ?? "";
                var addTo = shot.Armor.GetProperty("addTo") ?? "header";
                if (!string.IsNullOrEmpty(key))
                {
                    if (addTo.Equals("header", StringComparison.OrdinalIgnoreCase) && !headers.ContainsKey(key))
                    {
                        headers[key] = val;
                    }
                    else if (addTo.Equals("query", StringComparison.OrdinalIgnoreCase))
                    {
                        var sep = url.Contains('?') ? "&" : "?";
                        url += $"{sep}{Uri.EscapeDataString(key)}={Uri.EscapeDataString(val)}";
                    }
                }
            }
        }

        if (string.Equals(method, "GRPC", StringComparison.OrdinalIgnoreCase))
        {
            return GenerateGrpc(shot, language, url, body);
        }

        return language.ToLowerInvariant() switch
        {
            "csharp" => GenerateCSharp(method, url, headers, body),
            "typescript" or "javascript" => GenerateJavaScript(method, url, headers, body),
            "python" => GeneratePython(method, url, headers, body),
            "curl" => GenerateCurl(method, url, headers, body),
            "go" => GenerateGo(method, url, headers, body),
            "rust" => GenerateRust(method, url, headers, body),
            "java" => GenerateJava(method, url, headers, body),
            "php" => GeneratePhp(method, url, headers, body),
            "swift" => GenerateSwift(method, url, headers, body),
            _ => GenerateCurl(method, url, headers, body)
        };
    }

    private static string GenerateGrpc(Shot shot, string language, string url, string body)
    {
        var cleanTarget = url.Replace("http://", "").Replace("https://", "").TrimEnd('/');
        var serviceMethod = $"{shot.GrpcService}/{shot.GrpcMethod}";
        var plaintextFlag = shot.GrpcUseTls ? "" : "-plaintext ";
        var escapedBody = string.IsNullOrWhiteSpace(body) ? "{}" : body.Replace("\"", "\\\"");

        if (language.Equals("curl", StringComparison.OrdinalIgnoreCase))
        {
            return $"grpcurl {plaintextFlag}-d \"{escapedBody}\" {cleanTarget} {serviceMethod}";
        }

        return $"// BULLET gRPC Invocation ({cleanTarget})\n" +
               $"// Service: {shot.GrpcService} | Method: {shot.GrpcMethod}\n" +
               $"// CLI Command (grpcurl):\n" +
               $"grpcurl {plaintextFlag}-d \"{escapedBody}\" {cleanTarget} {serviceMethod}";
    }

    private static string GenerateCurl(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.Append($"curl -X {method} \"{url}\"");
        foreach (var h in headers)
        {
            sb.Append($" \\\n  -H \"{h.Key}: {h.Value}\"");
        }
        if (!string.IsNullOrEmpty(body) && method != "GET" && method != "HEAD")
        {
            var escaped = body.Replace("\"", "\\\"");
            sb.Append($" \\\n  -d \"{escaped}\"");
        }
        return sb.ToString();
    }

    private static string GenerateCSharp(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("using System;");
        sb.AppendLine("using System.Net.Http;");
        sb.AppendLine("using System.Text;");
        sb.AppendLine("using System.Threading.Tasks;");
        sb.AppendLine();
        sb.AppendLine("using var client = new HttpClient();");
        sb.AppendLine($"using var request = new HttpRequestMessage(HttpMethod.{ToTitleCase(method)}, \"{url}\");");

        foreach (var h in headers)
        {
            if (h.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
            sb.AppendLine($"request.Headers.TryAddWithoutValidation(\"{h.Key}\", \"{h.Value}\");");
        }

        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            var contentType = headers.TryGetValue("Content-Type", out var ct) ? ct : "application/json";
            var escaped = EscapeString(body);
            sb.AppendLine($"request.Content = new StringContent(\"{escaped}\", Encoding.UTF8, \"{contentType}\");");
        }

        sb.AppendLine();
        sb.AppendLine("var response = await client.SendAsync(request);");
        sb.AppendLine("var responseBody = await response.Content.ReadAsStringAsync();");
        sb.AppendLine("Console.WriteLine($\"Status: {(int)response.StatusCode}\");");
        sb.AppendLine("Console.WriteLine(responseBody);");
        return sb.ToString();
    }

    private static string GenerateJavaScript(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"const response = await fetch(\"{url}\", {{");
        sb.AppendLine($"  method: \"{method}\",");
        sb.AppendLine("  headers: {");
        foreach (var h in headers)
        {
            sb.AppendLine($"    \"{h.Key}\": \"{EscapeString(h.Value)}\",");
        }
        sb.AppendLine("  },");
        if (!string.IsNullOrEmpty(body) && method != "GET" && method != "HEAD")
        {
            sb.AppendLine($"  body: JSON.stringify({body.Trim()})");
        }
        sb.AppendLine("});");
        sb.AppendLine("const data = await response.json();");
        sb.AppendLine("console.log(data);");
        return sb.ToString();
    }

    private static string GeneratePython(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("import requests");
        sb.AppendLine();
        sb.AppendLine($"url = \"{url}\"");
        sb.AppendLine("headers = {");
        foreach (var h in headers)
        {
            sb.AppendLine($"    \"{h.Key}\": \"{EscapeString(h.Value)}\",");
        }
        sb.AppendLine("}");
        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            sb.AppendLine($"payload = {body.Trim()}");
            sb.AppendLine($"response = requests.{method.ToLowerInvariant()}(url, headers=headers, json=payload)");
        }
        else
        {
            sb.AppendLine($"response = requests.{method.ToLowerInvariant()}(url, headers=headers)");
        }
        sb.AppendLine("print(response.status_code)");
        sb.AppendLine("print(response.text)");
        return sb.ToString();
    }

    private static string GenerateGo(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("package main");
        sb.AppendLine();
        sb.AppendLine("import (");
        sb.AppendLine("    \"fmt\"");
        sb.AppendLine("    \"io\"");
        sb.AppendLine("    \"net/http\"");
        sb.AppendLine("    \"strings\"");
        sb.AppendLine(")");
        sb.AppendLine();
        sb.AppendLine("func main() {");
        sb.AppendLine("    client := &http.Client{}");
        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            sb.AppendLine($"    payload := strings.NewReader(`{body.Trim()}`)");
            sb.AppendLine($"    req, err := http.NewRequest(\"{method}\", \"{url}\", payload)");
        }
        else
        {
            sb.AppendLine($"    req, err := http.NewRequest(\"{method}\", \"{url}\", nil)");
        }
        sb.AppendLine("    if err != nil { panic(err) }");
        foreach (var h in headers)
        {
            sb.AppendLine($"    req.Header.Set(\"{h.Key}\", \"{h.Value}\")");
        }
        sb.AppendLine("    resp, err := client.Do(req)");
        sb.AppendLine("    if err != nil { panic(err) }");
        sb.AppendLine("    defer resp.Body.Close()");
        sb.AppendLine("    body, _ := io.ReadAll(resp.Body)");
        sb.AppendLine("    fmt.Println(string(body))");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GenerateRust(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("use reqwest::header::HeaderMap;");
        sb.AppendLine();
        sb.AppendLine("#[tokio::main]");
        sb.AppendLine("async fn main() -> Result<(), Box<dyn std::error::Error>> {");
        sb.AppendLine("    let client = reqwest::Client::new();");
        sb.AppendLine($"    let res = client.{method.ToLowerInvariant()}(\"{url}\")");
        foreach (var h in headers)
        {
            sb.AppendLine($"        .header(\"{h.Key}\", \"{h.Value}\")");
        }
        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            sb.AppendLine($"        .body(r#\"{body.Trim()}\"#)");
        }
        sb.AppendLine("        .send()");
        sb.AppendLine("        .await?;");
        sb.AppendLine("    println!(\"Status: {}\", res.status());");
        sb.AppendLine("    println!(\"{}\", res.text().await?);");
        sb.AppendLine("    Ok(())");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GenerateJava(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("import java.net.URI;");
        sb.AppendLine("import java.net.http.HttpClient;");
        sb.AppendLine("import java.net.http.HttpRequest;");
        sb.AppendLine("import java.net.http.HttpResponse;");
        sb.AppendLine();
        sb.AppendLine("public class App {");
        sb.AppendLine("    public static void main(String[] args) throws Exception {");
        sb.AppendLine("        HttpClient client = HttpClient.newHttpClient();");
        sb.AppendLine("        HttpRequest.Builder builder = HttpRequest.newBuilder()");
        sb.AppendLine($"            .uri(URI.create(\"{url}\"))");
        foreach (var h in headers)
        {
            sb.AppendLine($"            .header(\"{h.Key}\", \"{h.Value}\")");
        }
        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            sb.AppendLine($"            .method(\"{method}\", HttpRequest.BodyPublishers.ofString(\"{EscapeString(body)}\"));");
        }
        else
        {
            sb.AppendLine($"            .method(\"{method}\", HttpRequest.BodyPublishers.noBody());");
        }
        sb.AppendLine("        HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());");
        sb.AppendLine("        System.out.println(response.body());");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        return sb.ToString();
    }

    private static string GeneratePhp(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<?php");
        sb.AppendLine("$ch = curl_init();");
        sb.AppendLine($"curl_setopt($ch, CURLOPT_URL, \"{url}\");");
        sb.AppendLine($"curl_setopt($ch, CURLOPT_CUSTOMREQUEST, \"{method}\");");
        sb.AppendLine("curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);");
        sb.AppendLine("$headers = [");
        foreach (var h in headers)
        {
            sb.AppendLine($"    \"{h.Key}: {h.Value}\",");
        }
        sb.AppendLine("];");
        sb.AppendLine("curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);");
        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            sb.AppendLine($"curl_setopt($ch, CURLOPT_POSTFIELDS, \"{EscapeString(body)}\");");
        }
        sb.AppendLine("$response = curl_exec($ch);");
        sb.AppendLine("curl_close($ch);");
        sb.AppendLine("echo $response;");
        return sb.ToString();
    }

    private static string GenerateSwift(string method, string url, Dictionary<string, string> headers, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("import Foundation");
        sb.AppendLine();
        sb.AppendLine($"var request = URLRequest(url: URL(string: \"{url}\")!)");
        sb.AppendLine($"request.httpMethod = \"{method}\"");
        foreach (var h in headers)
        {
            sb.AppendLine($"request.addValue(\"{h.Value}\", forHTTPHeaderField: \"{h.Key}\")");
        }
        if (!string.IsNullOrEmpty(body) && method != "GET")
        {
            sb.AppendLine($"request.httpBody = \"{EscapeString(body)}\".data(using: .utf8)");
        }
        sb.AppendLine();
        sb.AppendLine("let task = URLSession.shared.dataTask(with: request) { data, response, error in");
        sb.AppendLine("    if let data = data, let text = String(data: data, encoding: .utf8) {");
        sb.AppendLine("        print(text)");
        sb.AppendLine("    }");
        sb.AppendLine("}");
        sb.AppendLine("task.resume()");
        return sb.ToString();
    }

    private static string EscapeString(string input) =>
        input.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");

    private static string ToTitleCase(string method) =>
        char.ToUpperInvariant(method[0]) + method[1..].ToLowerInvariant();
}
