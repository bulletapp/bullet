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
    Loadout ImportPostmanEnvironment(string jsonContent, Guid rangeId);
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
        var description = "Imported from Postman Collection v2.1";
        if (root.TryGetProperty("info", out var info))
        {
            if (info.TryGetProperty("name", out var n) && !string.IsNullOrWhiteSpace(n.GetString()))
                name = n.GetString()!;
            if (info.TryGetProperty("description", out var d) && !string.IsNullOrWhiteSpace(d.GetString()))
                description = d.GetString()!;
        }

        var arsenal = new Arsenal
        {
            RangeId = rangeId,
            Name = name,
            Description = description
        };

        // Collection-level Auth (Default Armor)
        if (root.TryGetProperty("auth", out var collAuth))
        {
            arsenal.DefaultArmor = ParsePostmanAuth(collAuth);
        }

        // Collection-level Events (Pre-request & Test scripts)
        if (root.TryGetProperty("event", out var collEvents) && collEvents.ValueKind == JsonValueKind.Array)
        {
            ParsePostmanEvents(collEvents, out var pre, out var test);
            arsenal.TriggerScript = pre;
            arsenal.VerifierScript = test;
        }

        if (root.TryGetProperty("item", out var items) && items.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in items.EnumerateArray())
            {
                ProcessPostmanItem(item, arsenal, null);
            }
        }

        return arsenal;
    }

    public Loadout ImportPostmanEnvironment(string jsonContent, Guid rangeId)
    {
        using var doc = JsonDocument.Parse(jsonContent);
        var root = doc.RootElement;

        var name = "Imported Postman Environment";
        if (root.TryGetProperty("name", out var n) && !string.IsNullOrWhiteSpace(n.GetString()))
        {
            name = n.GetString()!;
        }

        bool isProd = name.Contains("prod", StringComparison.OrdinalIgnoreCase);

        var loadout = new Loadout
        {
            RangeId = rangeId,
            Name = name,
            Description = "Imported from Postman Environment",
            IsProduction = isProd
        };

        if (root.TryGetProperty("values", out var values) && values.ValueKind == JsonValueKind.Array)
        {
            foreach (var val in values.EnumerateArray())
            {
                var key = val.TryGetProperty("key", out var k) ? k.GetString() : "";
                if (string.IsNullOrWhiteSpace(key)) continue;

                var value = val.TryGetProperty("value", out var v) ? v.GetString() ?? "" : "";
                var enabled = !val.TryGetProperty("enabled", out var en) || en.GetBoolean();
                var typeStr = val.TryGetProperty("type", out var t) ? t.GetString() : "default";
                bool isSecret = string.Equals(typeStr, "secret", StringComparison.OrdinalIgnoreCase);

                loadout.Rounds.Add(new Round
                {
                    Name = key,
                    Value = value,
                    Type = RoundType.String,
                    IsSecret = isSecret,
                    IsEnabled = enabled
                });
            }
        }

        return loadout;
    }

    private void ProcessPostmanItem(JsonElement item, Arsenal arsenal, Squad? parentSquad)
    {
        var name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "Unnamed" : "Unnamed";
        var description = item.TryGetProperty("description", out var desc) ? desc.GetString() : null;

        // Check if folder (Squad)
        if (item.TryGetProperty("item", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            var squad = new Squad
            {
                ArsenalId = arsenal.Id,
                ParentSquadId = parentSquad?.Id,
                Name = name,
                Description = description
            };

            // Folder-level Auth
            if (item.TryGetProperty("auth", out var squadAuth))
            {
                squad.Armor = ParsePostmanAuth(squadAuth);
            }

            // Folder-level Events
            if (item.TryGetProperty("event", out var squadEvents) && squadEvents.ValueKind == JsonValueKind.Array)
            {
                ParsePostmanEvents(squadEvents, out var pre, out var test);
                squad.TriggerScript = pre;
                squad.VerifierScript = test;
            }

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
                Name = name,
                Description = description
            };

            if (request.ValueKind == JsonValueKind.String)
            {
                shot.Url = request.GetString() ?? "";
                shot.Method = "GET";
                ParseQueryParamsFromRawUrl(shot.Url, shot);
            }
            else if (request.ValueKind == JsonValueKind.Object)
            {
                if (request.TryGetProperty("method", out var m))
                    shot.Method = m.GetString() ?? "GET";

                string rawUrl = "";
                if (request.TryGetProperty("url", out var u))
                {
                    if (u.ValueKind == JsonValueKind.String)
                    {
                        rawUrl = u.GetString() ?? "";
                        shot.Url = rawUrl;
                    }
                    else if (u.ValueKind == JsonValueKind.Object)
                    {
                        if (u.TryGetProperty("raw", out var rawUrlEl))
                            rawUrl = rawUrlEl.GetString() ?? "";
                        shot.Url = rawUrl;

                        // Query parameters
                        if (u.TryGetProperty("query", out var queries) && queries.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var q in queries.EnumerateArray())
                            {
                                var qk = q.TryGetProperty("key", out var jk) ? jk.GetString() : "";
                                var qv = q.TryGetProperty("value", out var jv) ? jv.GetString() : "";
                                var dis = q.TryGetProperty("disabled", out var jd) && jd.GetBoolean();
                                var qd = q.TryGetProperty("description", out var jdesc) ? jdesc.GetString() : null;
                                if (!string.IsNullOrEmpty(qk))
                                {
                                    shot.Parameters.Add(new ShotParameter
                                    {
                                        Key = qk,
                                        Value = qv ?? "",
                                        Type = ParameterType.Query,
                                        Enabled = !dis,
                                        Description = qd
                                    });
                                }
                            }
                        }

                        // Path variables (:param)
                        if (u.TryGetProperty("variable", out var vars) && vars.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var v in vars.EnumerateArray())
                            {
                                var vk = v.TryGetProperty("key", out var jvk) ? jvk.GetString() : "";
                                var vv = v.TryGetProperty("value", out var jvv) ? jvv.GetString() : "";
                                var vd = v.TryGetProperty("description", out var jvd) ? jvd.GetString() : null;
                                if (!string.IsNullOrEmpty(vk))
                                {
                                    shot.Parameters.Add(new ShotParameter
                                    {
                                        Key = vk,
                                        Value = vv ?? "",
                                        Type = ParameterType.Path,
                                        Enabled = true,
                                        Description = vd
                                    });
                                }
                            }
                        }
                    }
                }

                // If no query parameters were parsed from query array, fallback to rawUrl query string
                if (!shot.Parameters.Any(p => p.Type == ParameterType.Query) && !string.IsNullOrEmpty(rawUrl))
                {
                    ParseQueryParamsFromRawUrl(rawUrl, shot);
                }

                // Headers
                if (request.TryGetProperty("header", out var headers) && headers.ValueKind == JsonValueKind.Array)
                {
                    foreach (var h in headers.EnumerateArray())
                    {
                        var key = h.TryGetProperty("key", out var hk) ? hk.GetString() : "";
                        var val = h.TryGetProperty("value", out var hv) ? hv.GetString() : "";
                        var dis = h.TryGetProperty("disabled", out var hd) && hd.GetBoolean();
                        var hdesc = h.TryGetProperty("description", out var hdsc) ? hdsc.GetString() : null;
                        if (!string.IsNullOrEmpty(key))
                        {
                            shot.Headers.Add(new ShotHeader
                            {
                                Key = key,
                                Value = val ?? "",
                                Enabled = !dis,
                                Description = hdesc
                            });
                        }
                    }
                }

                // Request-level Auth
                if (request.TryGetProperty("auth", out var reqAuth))
                {
                    shot.Armor = ParsePostmanAuth(reqAuth);
                }

                // Body
                if (request.TryGetProperty("body", out var body) && body.ValueKind == JsonValueKind.Object)
                {
                    shot.Payload = ParsePostmanBody(body);
                }
            }

            // Extract Postman tests and prerequests into Bullet Verifier & Trigger scripts
            if (item.TryGetProperty("event", out var events) && events.ValueKind == JsonValueKind.Array)
            {
                ParsePostmanEvents(events, out var pre, out var test);
                shot.TriggerScript = pre;
                shot.VerifierScript = test;
            }

            if (parentSquad != null)
                parentSquad.Shots.Add(shot);
            else
                arsenal.Shots.Add(shot);
        }
    }

    private static ArmorConfig ParsePostmanAuth(JsonElement auth)
    {
        if (auth.ValueKind != JsonValueKind.Object)
            return new ArmorConfig { Type = ArmorType.Inherit };

        var typeStr = auth.TryGetProperty("type", out var t) ? t.GetString()?.ToLowerInvariant() : "inherit";

        return typeStr switch
        {
            "bearer" => ParseBearerAuth(auth),
            "basic" => ParseBasicAuth(auth),
            "apikey" => ParseApiKeyAuth(auth),
            "noauth" => ArmorConfig.None(),
            _ => new ArmorConfig { Type = ArmorType.Inherit }
        };
    }

    private static ArmorConfig ParseBearerAuth(JsonElement auth)
    {
        var config = new ArmorConfig { Type = ArmorType.Bearer };
        if (auth.TryGetProperty("bearer", out var bearerArr) && bearerArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in bearerArr.EnumerateArray())
            {
                var k = item.TryGetProperty("key", out var jk) ? jk.GetString() : "";
                var v = item.TryGetProperty("value", out var jv) ? jv.GetString() : "";
                if (string.Equals(k, "token", StringComparison.OrdinalIgnoreCase) && v != null)
                {
                    config.SetProperty("token", v);
                }
            }
        }
        return config;
    }

    private static ArmorConfig ParseBasicAuth(JsonElement auth)
    {
        var config = new ArmorConfig { Type = ArmorType.Basic };
        if (auth.TryGetProperty("basic", out var basicArr) && basicArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in basicArr.EnumerateArray())
            {
                var k = item.TryGetProperty("key", out var jk) ? jk.GetString() : "";
                var v = item.TryGetProperty("value", out var jv) ? jv.GetString() : "";
                if (string.Equals(k, "username", StringComparison.OrdinalIgnoreCase) && v != null)
                    config.SetProperty("username", v);
                else if (string.Equals(k, "password", StringComparison.OrdinalIgnoreCase) && v != null)
                    config.SetProperty("password", v);
            }
        }
        return config;
    }

    private static ArmorConfig ParseApiKeyAuth(JsonElement auth)
    {
        var config = new ArmorConfig { Type = ArmorType.ApiKey };
        string key = "", value = "", inLoc = "Header";
        if (auth.TryGetProperty("apikey", out var apiArr) && apiArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in apiArr.EnumerateArray())
            {
                var k = item.TryGetProperty("key", out var jk) ? jk.GetString() : "";
                var v = item.TryGetProperty("value", out var jv) ? jv.GetString() : "";
                if (string.Equals(k, "key", StringComparison.OrdinalIgnoreCase)) key = v ?? "";
                else if (string.Equals(k, "value", StringComparison.OrdinalIgnoreCase)) value = v ?? "";
                else if (string.Equals(k, "in", StringComparison.OrdinalIgnoreCase)) inLoc = v ?? "Header";
            }
        }
        config.SetProperty("key", key);
        config.SetProperty("value", value);
        config.SetProperty("addTo", inLoc);
        return config;
    }

    private static PayloadConfig ParsePostmanBody(JsonElement body)
    {
        var config = new PayloadConfig { Type = PayloadType.None };
        var mode = body.TryGetProperty("mode", out var m) ? m.GetString()?.ToLowerInvariant() : "";

        if (mode == "raw")
        {
            var raw = body.TryGetProperty("raw", out var r) ? r.GetString() : "";
            config.RawContent = raw;

            string lang = "";
            if (body.TryGetProperty("options", out var opts) &&
                opts.TryGetProperty("raw", out var rawOpt) &&
                rawOpt.TryGetProperty("language", out var langEl))
            {
                lang = langEl.GetString()?.ToLowerInvariant() ?? "";
            }

            config.Type = lang switch
            {
                "xml" => PayloadType.Xml,
                "text" or "plain" => PayloadType.PlainText,
                "json" => PayloadType.Json,
                _ => (raw?.TrimStart().StartsWith('{') == true || raw?.TrimStart().StartsWith('[') == true)
                    ? PayloadType.Json
                    : PayloadType.PlainText
            };
        }
        else if (mode == "urlencoded")
        {
            config.Type = PayloadType.FormUrlEncoded;
            if (body.TryGetProperty("urlencoded", out var urlencoded) && urlencoded.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in urlencoded.EnumerateArray())
                {
                    var k = item.TryGetProperty("key", out var jk) ? jk.GetString() : "";
                    var v = item.TryGetProperty("value", out var jv) ? jv.GetString() : "";
                    var dis = item.TryGetProperty("disabled", out var jd) && jd.GetBoolean();
                    var desc = item.TryGetProperty("description", out var jdesc) ? jdesc.GetString() : null;
                    if (!string.IsNullOrEmpty(k))
                    {
                        config.FormData.Add(new FormDataItem
                        {
                            Key = k,
                            Value = v ?? "",
                            Enabled = !dis,
                            Description = desc
                        });
                    }
                }
            }
        }
        else if (mode == "formdata")
        {
            config.Type = PayloadType.Multipart;
            if (body.TryGetProperty("formdata", out var formdata) && formdata.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in formdata.EnumerateArray())
                {
                    var k = item.TryGetProperty("key", out var jk) ? jk.GetString() : "";
                    var v = item.TryGetProperty("value", out var jv) ? jv.GetString() : "";
                    var t = item.TryGetProperty("type", out var jt) ? jt.GetString() : "text";
                    var src = item.TryGetProperty("src", out var js) ? js.GetString() : null;
                    var dis = item.TryGetProperty("disabled", out var jd) && jd.GetBoolean();
                    var desc = item.TryGetProperty("description", out var jdesc) ? jdesc.GetString() : null;
                    if (!string.IsNullOrEmpty(k))
                    {
                        config.MultipartData.Add(new MultipartItem
                        {
                            Key = k,
                            Value = v ?? "",
                            IsFile = string.Equals(t, "file", StringComparison.OrdinalIgnoreCase),
                            FileName = src,
                            Enabled = !dis,
                            Description = desc
                        });
                    }
                }
            }
        }
        else if (mode == "graphql")
        {
            config.Type = PayloadType.GraphQL;
            if (body.TryGetProperty("graphql", out var gql))
            {
                config.GraphQLQuery = gql.TryGetProperty("query", out var q) ? q.GetString() : "";
                config.GraphQLVariables = gql.TryGetProperty("variables", out var v) ? v.GetString() : "";
            }
        }

        return config;
    }

    private static void ParseQueryParamsFromRawUrl(string rawUrl, Shot shot)
    {
        try
        {
            var queryIdx = rawUrl.IndexOf('?');
            if (queryIdx >= 0 && queryIdx < rawUrl.Length - 1)
            {
                var queryString = rawUrl[(queryIdx + 1)..];
                var hashIdx = queryString.IndexOf('#');
                if (hashIdx >= 0) queryString = queryString[..hashIdx];

                var pairs = queryString.Split('&', StringSplitOptions.RemoveEmptyEntries);
                foreach (var pair in pairs)
                {
                    var eqIdx = pair.IndexOf('=');
                    string key, val;
                    if (eqIdx >= 0)
                    {
                        key = Uri.UnescapeDataString(pair[..eqIdx]);
                        val = Uri.UnescapeDataString(pair[(eqIdx + 1)..]);
                    }
                    else
                    {
                        key = Uri.UnescapeDataString(pair);
                        val = "";
                    }

                    if (!string.IsNullOrEmpty(key) && !shot.Parameters.Any(p => p.Type == ParameterType.Query && p.Key == key))
                    {
                        shot.Parameters.Add(new ShotParameter
                        {
                            Key = key,
                            Value = val,
                            Type = ParameterType.Query,
                            Enabled = true
                        });
                    }
                }
            }
        }
        catch
        {
            // Fallback gracefully if malformed URL
        }
    }

    private static void ParsePostmanEvents(JsonElement events, out string? triggerScript, out string? verifierScript)
    {
        triggerScript = null;
        verifierScript = null;

        foreach (var ev in events.EnumerateArray())
        {
            var listen = ev.TryGetProperty("listen", out var l) ? l.GetString() : "";
            if (ev.TryGetProperty("script", out var script) &&
                script.TryGetProperty("exec", out var exec) &&
                exec.ValueKind == JsonValueKind.Array)
            {
                var lines = new List<string>();
                foreach (var line in exec.EnumerateArray())
                    lines.Add(line.GetString() ?? "");

                var content = TranslatePostmanScript(string.Join("\n", lines));
                if (listen == "prerequest")
                    triggerScript = content;
                else if (listen == "test")
                    verifierScript = content;
            }
        }
    }

    private static string TranslatePostmanScript(string postmanScript)
    {
        if (string.IsNullOrWhiteSpace(postmanScript)) return "";

        return postmanScript
            .Replace("pm.test(", "bullet.test(")
            .Replace("pm.expect(", "bullet.expect(")
            .Replace("pm.response.to.have.status(", "bullet.expect(bullet.response.status).toBe(")
            .Replace("pm.response.json()", "bullet.response.json()")
            .Replace("pm.response.text()", "bullet.response.text()")
            .Replace("pm.environment.get(", "bullet.loadout.get(")
            .Replace("pm.environment.set(", "bullet.loadout.set(")
            .Replace("pm.variables.get(", "bullet.rounds.get(")
            .Replace("pm.variables.set(", "bullet.rounds.set(")
            .Replace("pm.collectionVariables.get(", "bullet.rounds.get(")
            .Replace("pm.collectionVariables.set(", "bullet.rounds.set(")
            .Replace("pm.globals.get(", "bullet.loadout.get(")
            .Replace("pm.globals.set(", "bullet.loadout.set(");
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
