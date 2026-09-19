using System.Text.Json;
using Bullet.Application.ArmoryTransfer;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Xunit;

namespace Bullet.UnitTests;

public class PostmanTransferTests
{
    private readonly IArmoryTransferService _transferService = new ArmoryTransferService();
    private readonly Guid _rangeId = Guid.NewGuid();

    [Fact]
    public void ImportPostmanCollection_WithAuth_ShouldParseBearerBasicAndApiKey()
    {
        var postmanJson = """
        {
            "info": {
                "name": "Auth Test Collection",
                "description": "Tests all auth mechanisms"
            },
            "auth": {
                "type": "bearer",
                "bearer": [
                    { "key": "token", "value": "collection-token-xyz" }
                ]
            },
            "item": [
                {
                    "name": "Bearer Request",
                    "request": {
                        "method": "GET",
                        "url": "https://api.example.com/bearer",
                        "auth": {
                            "type": "bearer",
                            "bearer": [
                                { "key": "token", "value": "req-bearer-token-123" }
                            ]
                        }
                    }
                },
                {
                    "name": "Basic Request",
                    "request": {
                        "method": "POST",
                        "url": "https://api.example.com/login",
                        "auth": {
                            "type": "basic",
                            "basic": [
                                { "key": "username", "value": "john_doe" },
                                { "key": "password", "value": "p@ssw0rd!" }
                            ]
                        }
                    }
                },
                {
                    "name": "API Key Request",
                    "request": {
                        "method": "GET",
                        "url": "https://api.example.com/data",
                        "auth": {
                            "type": "apikey",
                            "apikey": [
                                { "key": "key", "value": "X-Custom-Key" },
                                { "key": "value", "value": "secret-key-val" },
                                { "key": "in", "value": "header" }
                            ]
                        }
                    }
                }
            ]
        }
        """;

        var arsenal = _transferService.ImportPostmanCollection(postmanJson, _rangeId);

        Assert.Equal("Auth Test Collection", arsenal.Name);
        Assert.Equal(ArmorType.Bearer, arsenal.DefaultArmor.Type);
        Assert.Equal("collection-token-xyz", arsenal.DefaultArmor.GetProperty("token"));

        Assert.Equal(3, arsenal.Shots.Count);

        // 1. Bearer
        var bearerShot = arsenal.Shots[0];
        Assert.Equal(ArmorType.Bearer, bearerShot.Armor.Type);
        Assert.Equal("req-bearer-token-123", bearerShot.Armor.GetProperty("token"));

        // 2. Basic
        var basicShot = arsenal.Shots[1];
        Assert.Equal(ArmorType.Basic, basicShot.Armor.Type);
        Assert.Equal("john_doe", basicShot.Armor.GetProperty("username"));
        Assert.Equal("p@ssw0rd!", basicShot.Armor.GetProperty("password"));

        // 3. API Key
        var apiKeyShot = arsenal.Shots[2];
        Assert.Equal(ArmorType.ApiKey, apiKeyShot.Armor.Type);
        Assert.Equal("X-Custom-Key", apiKeyShot.Armor.GetProperty("key"));
        Assert.Equal("secret-key-val", apiKeyShot.Armor.GetProperty("value"));
        Assert.Equal("header", apiKeyShot.Armor.GetProperty("addTo"));
    }

    [Fact]
    public void ImportPostmanCollection_WithQueryParamsAndPathVariables_ShouldParseParameters()
    {
        var postmanJson = """
        {
            "info": {
                "name": "Params Test"
            },
            "item": [
                {
                    "name": "Filtered Search",
                    "request": {
                        "method": "GET",
                        "url": {
                            "raw": "https://api.example.com/users/:userId/posts?category=tech&sort=desc",
                            "query": [
                                { "key": "category", "value": "tech", "disabled": false, "description": "Tech news" },
                                { "key": "sort", "value": "desc", "disabled": true, "description": "Sort order" }
                            ],
                            "variable": [
                                { "key": "userId", "value": "42", "description": "Target user ID" }
                            ]
                        }
                    }
                },
                {
                    "name": "Raw URL Query Parsing",
                    "request": {
                        "method": "GET",
                        "url": "https://api.example.com/search?q=bullet&limit=50"
                    }
                }
            ]
        }
        """;

        var arsenal = _transferService.ImportPostmanCollection(postmanJson, _rangeId);
        Assert.Equal(2, arsenal.Shots.Count);

        var paramShot = arsenal.Shots[0];
        Assert.Equal(3, paramShot.Parameters.Count);

        var query1 = paramShot.Parameters.FirstOrDefault(p => p.Key == "category");
        Assert.NotNull(query1);
        Assert.Equal("tech", query1.Value);
        Assert.True(query1.Enabled);
        Assert.Equal(ParameterType.Query, query1.Type);

        var query2 = paramShot.Parameters.FirstOrDefault(p => p.Key == "sort");
        Assert.NotNull(query2);
        Assert.Equal("desc", query2.Value);
        Assert.False(query2.Enabled);

        var pathVar = paramShot.Parameters.FirstOrDefault(p => p.Key == "userId");
        Assert.NotNull(pathVar);
        Assert.Equal("42", pathVar.Value);
        Assert.Equal(ParameterType.Path, pathVar.Type);

        // Raw fallback
        var rawShot = arsenal.Shots[1];
        Assert.Equal(2, rawShot.Parameters.Count);
        Assert.Contains(rawShot.Parameters, p => p.Key == "q" && p.Value == "bullet");
        Assert.Contains(rawShot.Parameters, p => p.Key == "limit" && p.Value == "50");
    }

    [Fact]
    public void ImportPostmanCollection_WithDiverseBodyTypes_ShouldParseCorrectPayload()
    {
        var postmanJson = """
        {
            "info": {
                "name": "Body Types Test"
            },
            "item": [
                {
                    "name": "Raw JSON",
                    "request": {
                        "method": "POST",
                        "url": "https://api.example.com/json",
                        "body": {
                            "mode": "raw",
                            "raw": "{\"title\":\"Bullet API\"}",
                            "options": { "raw": { "language": "json" } }
                        }
                    }
                },
                {
                    "name": "UrlEncoded",
                    "request": {
                        "method": "POST",
                        "url": "https://api.example.com/oauth/token",
                        "body": {
                            "mode": "urlencoded",
                            "urlencoded": [
                                { "key": "grant_type", "value": "password", "disabled": false },
                                { "key": "client_id", "value": "app-123", "disabled": false }
                            ]
                        }
                    }
                },
                {
                    "name": "FormData",
                    "request": {
                        "method": "POST",
                        "url": "https://api.example.com/upload",
                        "body": {
                            "mode": "formdata",
                            "formdata": [
                                { "key": "file", "type": "file", "src": "avatar.png", "disabled": false },
                                { "key": "description", "type": "text", "value": "Profile photo", "disabled": false }
                            ]
                        }
                    }
                },
                {
                    "name": "GraphQL",
                    "request": {
                        "method": "POST",
                        "url": "https://api.example.com/graphql",
                        "body": {
                            "mode": "graphql",
                            "graphql": {
                                "query": "query GetUser($id: ID!) { user(id: $id) { name } }",
                                "variables": "{\"id\": 1}"
                            }
                        }
                    }
                }
            ]
        }
        """;

        var arsenal = _transferService.ImportPostmanCollection(postmanJson, _rangeId);
        Assert.Equal(4, arsenal.Shots.Count);

        // 1. Raw JSON
        var jsonShot = arsenal.Shots[0];
        Assert.Equal(PayloadType.Json, jsonShot.Payload.Type);
        Assert.Equal("{\"title\":\"Bullet API\"}", jsonShot.Payload.RawContent);

        // 2. UrlEncoded
        var formShot = arsenal.Shots[1];
        Assert.Equal(PayloadType.FormUrlEncoded, formShot.Payload.Type);
        Assert.Equal(2, formShot.Payload.FormData.Count);
        Assert.Equal("grant_type", formShot.Payload.FormData[0].Key);
        Assert.Equal("password", formShot.Payload.FormData[0].Value);

        // 3. Multipart
        var multiShot = arsenal.Shots[2];
        Assert.Equal(PayloadType.Multipart, multiShot.Payload.Type);
        Assert.Equal(2, multiShot.Payload.MultipartData.Count);
        Assert.True(multiShot.Payload.MultipartData[0].IsFile);
        Assert.Equal("avatar.png", multiShot.Payload.MultipartData[0].FileName);

        // 4. GraphQL
        var gqlShot = arsenal.Shots[3];
        Assert.Equal(PayloadType.GraphQL, gqlShot.Payload.Type);
        Assert.Contains("query GetUser", gqlShot.Payload.GraphQLQuery);
        Assert.Equal("{\"id\": 1}", gqlShot.Payload.GraphQLVariables);
    }

    [Fact]
    public void ImportPostmanCollection_WithFoldersAndScripts_ShouldConvertCorrectly()
    {
        var postmanJson = """
        {
            "info": { "name": "Nested Test" },
            "item": [
                {
                    "name": "Auth Squad",
                    "item": [
                        {
                            "name": "Login Shot",
                            "event": [
                                {
                                    "listen": "prerequest",
                                    "script": {
                                        "exec": [
                                            "pm.environment.set('reqTime', Date.now());",
                                            "console.log('Sending request');"
                                        ]
                                    }
                                },
                                {
                                    "listen": "test",
                                    "script": {
                                        "exec": [
                                            "pm.test('Status is 200', function() {",
                                            "    pm.response.to.have.status(200);",
                                            "});"
                                        ]
                                    }
                                }
                            ],
                            "request": {
                                "method": "GET",
                                "url": "https://api.example.com/login"
                            }
                        }
                    ]
                }
            ]
        }
        """;

        var arsenal = _transferService.ImportPostmanCollection(postmanJson, _rangeId);
        Assert.Single(arsenal.Squads);

        var squad = arsenal.Squads[0];
        Assert.Equal("Auth Squad", squad.Name);
        Assert.Single(squad.Shots);

        var shot = squad.Shots[0];
        Assert.Equal("Login Shot", shot.Name);
        Assert.Contains("bullet.loadout.set('reqTime', Date.now());", shot.TriggerScript);
        Assert.Contains("bullet.test('Status is 200'", shot.VerifierScript);
        Assert.Contains("bullet.expect(bullet.response.status).toBe(200);", shot.VerifierScript);
    }

    [Fact]
    public void ImportPostmanEnvironment_ShouldParseRoundsAndSecrets()
    {
        var postmanEnvJson = """
        {
            "id": "env-12345",
            "name": "Production Environment",
            "values": [
                {
                    "key": "baseUrl",
                    "value": "https://prod.bullet.dev",
                    "type": "default",
                    "enabled": true
                },
                {
                    "key": "jwtSecret",
                    "value": "top-secret-signing-key",
                    "type": "secret",
                    "enabled": true
                },
                {
                    "key": "debugMode",
                    "value": "false",
                    "type": "default",
                    "enabled": false
                }
            ],
            "_postman_variable_scope": "environment"
        }
        """;

        var loadout = _transferService.ImportPostmanEnvironment(postmanEnvJson, _rangeId);

        Assert.Equal("Production Environment", loadout.Name);
        Assert.True(loadout.IsProduction);
        Assert.Equal(3, loadout.Rounds.Count);

        var baseUrl = loadout.Rounds.First(r => r.Name == "baseUrl");
        Assert.Equal("https://prod.bullet.dev", baseUrl.Value);
        Assert.False(baseUrl.IsSecret);
        Assert.True(baseUrl.IsEnabled);

        var secret = loadout.Rounds.First(r => r.Name == "jwtSecret");
        Assert.Equal("top-secret-signing-key", secret.Value);
        Assert.True(secret.IsSecret);

        var debug = loadout.Rounds.First(r => r.Name == "debugMode");
        Assert.False(debug.IsEnabled);
    }
}
