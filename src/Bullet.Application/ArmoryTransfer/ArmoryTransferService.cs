using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;

namespace Bullet.Application.ArmoryTransfer;

public interface IArmoryTransferService
{
    Arsenal ImportNative(string jsonContent, Guid rangeId);
    Arsenal ImportPostmanCollection(string jsonContent, Guid rangeId);
    Shot ImportCurl(string curlCommand, Guid arsenalId);
    Arsenal ImportOpenApi(string jsonContent, Guid rangeId);

    string ExportNative(Arsenal arsenal, List<Loadout>? loadouts = null, bool includeSecrets = false);
    string ExportOpenApi(Arsenal arsenal);
    string ExportJunitXml(FiringRun firingRun);
}

public class ArmoryTransferService : IArmoryTransferService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public Arsenal ImportNative(string jsonContent, Guid rangeId)
    {
        var model = JsonSerializer.Deserialize<BulletNativeExportModel>(jsonContent, JsonOptions)
            ?? throw new ArgumentException("Invalid .bullet.json format.");

        var arsenalDto = model.Arsenal ?? throw new ArgumentException("No Arsenal definition in file.");

        var arsenal = new Arsenal
        {
            RangeId = rangeId,
            Name = arsenalDto.Name,
            Description = arsenalDto.Description,
            Tags = arsenalDto.Tags,
            DefaultArmor = arsenalDto.DefaultArmor,
            TriggerScript = arsenalDto.TriggerScript,
            VerifierScript = arsenalDto.VerifierScript
        };

        foreach (var shotDto in arsenalDto.Shots)
        {
            arsenal.Shots.Add(new Shot
            {
                ArsenalId = arsenal.Id,
                Name = shotDto.Name,
                Description = shotDto.Description,
                Method = shotDto.Method,
                Url = shotDto.Url,
                Parameters = shotDto.Parameters,
                Headers = shotDto.Headers,
                Payload = shotDto.Payload,
                Armor = shotDto.Armor,
                Settings = shotDto.Settings,
                TriggerScript = shotDto.TriggerScript,
                VerifierScript = shotDto.VerifierScript
            });
        }

        foreach (var squadDto in arsenalDto.Squads)
        {
            var squad = new Squad
            {
                ArsenalId = arsenal.Id,
                Name = squadDto.Name,
                Description = squadDto.Description,
                Armor = squadDto.Armor,
                TriggerScript = squadDto.TriggerScript,
                VerifierScript = squadDto.VerifierScript
            };

            foreach (var shotDto in squadDto.Shots)
            {
                squad.Shots.Add(new Shot
                {
                    ArsenalId = arsenal.Id,
                    SquadId = squad.Id,
                    Name = shotDto.Name,
                    Description = shotDto.Description,
                    Method = shotDto.Method,
                    Url = shotDto.Url,
                    Parameters = shotDto.Parameters,
                    Headers = shotDto.Headers,
                    Payload = shotDto.Payload,
                    Armor = shotDto.Armor,
                    Settings = shotDto.Settings,
                    TriggerScript = shotDto.TriggerScript,
                    VerifierScript = shotDto.VerifierScript
                });
            }

            arsenal.Squads.Add(squad);
        }

        return arsenal;
    }

    public Arsenal ImportPostmanCollection(string jsonContent, Guid rangeId)
    {
        using var doc = JsonDocument.Parse(jsonContent);
        var root = doc.RootElement;

        var name = "Imported Postman Collection";
        if (root.TryGetProperty("info", out var info) && info.TryGetProperty("name", out var n))
        {
            name = n.GetString() ?? name;
        }

        var arsenal = new Arsenal
        {
            RangeId = rangeId,
            Name = name,
            Description = "Imported from Postman Collection v2.1"
        };

        if (root.TryGetProperty("item", out var items) && items.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in items.EnumerateArray())
            {
                ProcessPostmanItem(item, arsenal, null);
            }
        }

        return arsenal;
    }

    private void ProcessPostmanItem(JsonElement item, Arsenal arsenal, Squad? parentSquad)
    {
        var name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "Unnamed" : "Unnamed";

        // Check if folder (Squad)
        if (item.TryGetProperty("item", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            var squad = new Squad
            {
                ArsenalId = arsenal.Id,
                ParentSquadId = parentSquad?.Id,
                Name = name
            };

            arsenal.Squads.Add(squad);

            foreach (var child in children.EnumerateArray())
            {
                ProcessPostmanItem(child, arsenal, squad);
            }
        }
        else if (item.TryGetProperty("request", out var request))
        {
            var shot = new Shot
            {
                ArsenalId = arsenal.Id,
                SquadId = parentSquad?.Id,
                Name = name
            };

            if (request.ValueKind == JsonValueKind.String)
            {
                shot.Url = request.GetString() ?? "";
                shot.Method = "GET";
            }
            else if (request.ValueKind == JsonValueKind.Object)
            {
                if (request.TryGetProperty("method", out var m))
                    shot.Method = m.GetString() ?? "GET";

                if (request.TryGetProperty("url", out var u))
                {
                    if (u.ValueKind == JsonValueKind.String)
                        shot.Url = u.GetString() ?? "";
                    else if (u.TryGetProperty("raw", out var rawUrl))
                        shot.Url = rawUrl.GetString() ?? "";
                }

                if (request.TryGetProperty("header", out var headers) && headers.ValueKind == JsonValueKind.Array)
                {
                    foreach (var h in headers.EnumerateArray())
                    {
                        var key = h.TryGetProperty("key", out var hk) ? hk.GetString() : "";
                        var val = h.TryGetProperty("value", out var hv) ? hv.GetString() : "";
                        if (!string.IsNullOrEmpty(key))
                        {
                            shot.Headers.Add(new ShotHeader { Key = key, Value = val ?? "", Enabled = true });
                        }
                    }
                }

                if (request.TryGetProperty("body", out var body) && body.ValueKind == JsonValueKind.Object)
                {
                    if (body.TryGetProperty("mode", out var mode) && mode.GetString() == "raw" &&
                        body.TryGetProperty("raw", out var raw))
                    {
                        shot.Payload = new PayloadConfig
                        {
                            Type = PayloadType.Json,
                            RawContent = raw.GetString()
                        };
                    }
                }
            }

            // Extract Postman tests and prerequests into Bullet Verifier & Trigger scripts
            if (item.TryGetProperty("event", out var events) && events.ValueKind == JsonValueKind.Array)
            {
                foreach (var ev in events.EnumerateArray())
                {
                    var listen = ev.TryGetProperty("listen", out var l) ? l.GetString() : "";
                    if (ev.TryGetProperty("script", out var script) && script.TryGetProperty("exec", out var exec) && exec.ValueKind == JsonValueKind.Array)
                    {
                        var lines = new List<string>();
                        foreach (var line in exec.EnumerateArray())
                            lines.Add(line.GetString() ?? "");

                        var scriptContent = string.Join("\n", lines)
                            .Replace("pm.test(", "bullet.test(")
                            .Replace("pm.expect(", "bullet.expect(")
                            .Replace("pm.response.to.have.status(", "bullet.expect(bullet.response.status).toBe(")
                            .Replace("pm.environment.get(", "bullet.loadout.get(")
                            .Replace("pm.environment.set(", "bullet.loadout.set(");

                        if (listen == "prerequest")
                            shot.TriggerScript = scriptContent;
                        else if (listen == "test")
                            shot.VerifierScript = scriptContent;
                    }
                }
            }

            if (parentSquad != null)
                parentSquad.Shots.Add(shot);
            else
                arsenal.Shots.Add(shot);
        }
    }

    public Shot ImportCurl(string curlCommand, Guid arsenalId)
    {
        var shot = new Shot
        {
            ArsenalId = arsenalId,
            Name = "cURL Import",
            Method = "GET"
        };

        var cleaned = curlCommand.Replace("\\\r\n", " ").Replace("\\\n", " ").Trim();

        // Extract URL
        var urlMatch = Regex.Match(cleaned, @"(?:curl\s+)?(?:-X\s+[A-Z]+\s+)?['""]?(https?://[^\s'""]+)['""]?");
        if (urlMatch.Success)
            shot.Url = urlMatch.Groups[1].Value;

        // Extract Method
        var methodMatch = Regex.Match(cleaned, @"-X\s+([A-Z]+)");
        if (methodMatch.Success)
            shot.Method = methodMatch.Groups[1].Value.ToUpperInvariant();

        // Extract Headers
        var headerMatches = Regex.Matches(cleaned, @"-H\s+['""]([^'""]+)['""]");
        foreach (Match hm in headerMatches)
        {
            var headerStr = hm.Groups[1].Value;
            var splitIdx = headerStr.IndexOf(':');
            if (splitIdx > 0)
            {
                var k = headerStr[..splitIdx].Trim();
                var v = headerStr[(splitIdx + 1)..].Trim();
                shot.Headers.Add(new ShotHeader { Key = k, Value = v, Enabled = true });
            }
        }

        // Extract Body (-d or --data or --data-raw)
        var bodyMatch = Regex.Match(cleaned, @"(?:-d|--data|--data-raw)\s+['""]([\s\S]*?)['""](?:\s+-|\s*$)");
        if (bodyMatch.Success)
        {
            shot.Payload = new PayloadConfig
            {
                Type = PayloadType.Json,
                RawContent = bodyMatch.Groups[1].Value
            };
            if (methodMatch.Success == false)
                shot.Method = "POST";
        }

        return shot;
    }

    public Arsenal ImportOpenApi(string jsonContent, Guid rangeId)
    {
        using var doc = JsonDocument.Parse(jsonContent);
        var root = doc.RootElement;

        var title = "Imported OpenAPI Specification";
        if (root.TryGetProperty("info", out var info) && info.TryGetProperty("title", out var t))
            title = t.GetString() ?? title;

        var arsenal = new Arsenal
        {
            RangeId = rangeId,
            Name = title,
            Description = "Imported from OpenAPI 3.x"
        };

        var squadsByTag = new Dictionary<string, Squad>(StringComparer.OrdinalIgnoreCase);

        if (root.TryGetProperty("paths", out var paths) && paths.ValueKind == JsonValueKind.Object)
        {
            foreach (var pathProp in paths.EnumerateObject())
            {
                var path = pathProp.Name;
                foreach (var methodProp in pathProp.Value.EnumerateObject())
                {
                    var method = methodProp.Name.ToUpperInvariant();
                    if (method != "GET" && method != "POST" && method != "PUT" && method != "DELETE" && method != "PATCH")
                        continue;

                    var op = methodProp.Value;
                    var summary = op.TryGetProperty("summary", out var s) ? s.GetString() : $"{method} {path}";
                    var tag = "General";
                    if (op.TryGetProperty("tags", out var tags) && tags.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var tagItem in tags.EnumerateArray())
                        {
                            tag = tagItem.GetString() ?? tag;
                            break;
                        }
                    }

                    if (!squadsByTag.TryGetValue(tag, out var squad))
                    {
                        squad = new Squad
                        {
                            ArsenalId = arsenal.Id,
                            Name = tag
                        };
                        squadsByTag[tag] = squad;
                        arsenal.Squads.Add(squad);
                    }

                    var shot = new Shot
                    {
                        ArsenalId = arsenal.Id,
                        SquadId = squad.Id,
                        Name = summary ?? $"{method} {path}",
                        Method = method,
                        Url = "{{apiHost}}" + path
                    };

                    // Add headers / parameters if defined
                    if (op.TryGetProperty("parameters", out var parameters) && parameters.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var p in parameters.EnumerateArray())
                        {
                            var pName = p.TryGetProperty("name", out var pn) ? pn.GetString() : "";
                            var pIn = p.TryGetProperty("in", out var pi) ? pi.GetString() : "query";
                            if (!string.IsNullOrEmpty(pName))
                            {
                                if (pIn == "query")
                                    shot.Parameters.Add(new ShotParameter { Key = pName, Value = $"{{{{{pName}}}}}", Type = ParameterType.Query });
                                else if (pIn == "header")
                                    shot.Headers.Add(new ShotHeader { Key = pName, Value = $"{{{{{pName}}}}}", Enabled = true });
                            }
                        }
                    }

                    // Request body example
                    if (op.TryGetProperty("requestBody", out var rb) && rb.TryGetProperty("content", out var ct))
                    {
                        if (ct.TryGetProperty("application/json", out var appJson))
                        {
                            shot.Payload = new PayloadConfig
                            {
                                Type = PayloadType.Json,
                                RawContent = "{\n  \"example\": \"value\"\n}"
                            };
                            shot.Headers.Add(new ShotHeader { Key = "Content-Type", Value = "application/json", Enabled = true });
                        }
                    }

                    squad.Shots.Add(shot);
                }
            }
        }

        return arsenal;
    }

    public string ExportNative(Arsenal arsenal, List<Loadout>? loadouts = null, bool includeSecrets = false)
    {
        var model = new BulletNativeExportModel
        {
            Format = "bullet",
            Version = "1.0",
            ExportedAtUtc = DateTime.UtcNow,
            Arsenal = new ArsenalExportDto
            {
                Name = arsenal.Name,
                Description = arsenal.Description,
                Tags = arsenal.Tags,
                DefaultArmor = arsenal.DefaultArmor,
                TriggerScript = arsenal.TriggerScript,
                VerifierScript = arsenal.VerifierScript,
                Shots = arsenal.Shots.Select(MapShotToDto).ToList(),
                Squads = arsenal.Squads.Select(s => new SquadExportDto
                {
                    Name = s.Name,
                    Description = s.Description,
                    Armor = s.Armor,
                    TriggerScript = s.TriggerScript,
                    VerifierScript = s.VerifierScript,
                    Shots = s.Shots.Select(MapShotToDto).ToList()
                }).ToList()
            }
        };

        if (loadouts != null)
        {
            foreach (var l in loadouts)
            {
                model.Loadouts.Add(new LoadoutExportDto
                {
                    Name = l.Name,
                    IsProduction = l.IsProduction,
                    Rounds = l.Rounds.Select(r => new RoundExportDto
                    {
                        Name = r.Name,
                        Value = (r.IsSecret && !includeSecrets) ? "********" : r.Value,
                        Type = r.Type,
                        IsSecret = r.IsSecret,
                        IsEnabled = r.IsEnabled,
                        Description = r.Description
                    }).ToList()
                });
            }
        }

        return JsonSerializer.Serialize(model, JsonOptions);
    }

    private static ShotExportDto MapShotToDto(Shot shot) => new()
    {
        Name = shot.Name,
        Description = shot.Description,
        Method = shot.Method,
        Url = shot.Url,
        Parameters = shot.Parameters,
        Headers = shot.Headers,
        Payload = shot.Payload,
        Armor = shot.Armor,
        Settings = shot.Settings,
        TriggerScript = shot.TriggerScript,
        VerifierScript = shot.VerifierScript
    };

    public string ExportOpenApi(Arsenal arsenal)
    {
        var pathsNode = new JsonObject();
        var allShots = arsenal.Shots.Concat(arsenal.Squads.SelectMany(s => s.Shots));

        foreach (var shot in allShots)
        {
            var cleanPath = shot.Url;
            if (cleanPath.StartsWith("http", StringComparison.OrdinalIgnoreCase) && Uri.TryCreate(cleanPath, UriKind.Absolute, out var uri))
                cleanPath = uri.AbsolutePath;
            else if (cleanPath.StartsWith("{{apiHost}}"))
                cleanPath = cleanPath["{{apiHost}}".Length..];

            if (string.IsNullOrEmpty(cleanPath) || !cleanPath.StartsWith('/'))
                cleanPath = "/" + cleanPath;

            var pathObj = pathsNode[cleanPath] as JsonObject;
            if (pathObj == null)
            {
                pathObj = new JsonObject();
                pathsNode[cleanPath] = pathObj;
            }

            var opObj = new JsonObject
            {
                ["summary"] = shot.Name,
                ["description"] = shot.Description ?? "",
                ["responses"] = new JsonObject
                {
                    ["200"] = new JsonObject { ["description"] = "Successful response" }
                }
            };

            pathObj[shot.Method.ToLowerInvariant()] = opObj;
        }

        var root = new JsonObject
        {
            ["openapi"] = "3.0.0",
            ["info"] = new JsonObject
            {
                ["title"] = arsenal.Name,
                ["version"] = "1.0.0",
                ["description"] = arsenal.Description ?? "Generated by BULLET: Load. Aim. API."
            },
            ["paths"] = pathsNode
        };

        return root.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
    }

    public string ExportJunitXml(FiringRun firingRun)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine($"<testsuites name=\"Bullet Firing Run - {EscapeXml(firingRun.Name)}\" tests=\"{firingRun.TotalShots}\" failures=\"{firingRun.FailedShots}\" time=\"{(firingRun.TotalDurationMs / 1000.0):F3}\">");
        sb.AppendLine($"  <testsuite name=\"{EscapeXml(firingRun.Name)}\" tests=\"{firingRun.TotalShots}\" failures=\"{firingRun.FailedShots}\" time=\"{(firingRun.TotalDurationMs / 1000.0):F3}\">");

        foreach (var res in firingRun.Results)
        {
            sb.AppendLine($"    <testcase name=\"{EscapeXml(res.ShotName)}\" classname=\"{EscapeXml(res.Method)} {EscapeXml(res.Url)}\" time=\"{(res.DurationMs / 1000.0):F3}\">");
            if (!res.Passed)
            {
                sb.AppendLine($"      <failure message=\"{EscapeXml(res.ErrorMessage ?? "Test failed")}\">{EscapeXml(res.AssertionResultsJson ?? "")}</failure>");
            }
            sb.AppendLine("    </testcase>");
        }

        sb.AppendLine("  </testsuite>");
        sb.AppendLine("</testsuites>");
        return sb.ToString();
    }

    private static string EscapeXml(string str) =>
        str.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&apos;");
}
