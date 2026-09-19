using System.Text.RegularExpressions;
using Bullet.Execution.Models;

namespace Bullet.Execution.Grpc;

public interface IProtoParserService
{
    GrpcProtoParseResponse ParseProto(string protoContent);
}

public class ProtoParserService : IProtoParserService
{
    public GrpcProtoParseResponse ParseProto(string protoContent)
    {
        if (string.IsNullOrWhiteSpace(protoContent))
        {
            return new GrpcProtoParseResponse
            {
                Success = false,
                ErrorMessage = "Proto content cannot be empty."
            };
        }

        try
        {
            var services = new List<GrpcServiceInfo>();

            // Extract package name
            var packageMatch = Regex.Match(protoContent, @"^\s*package\s+([a-zA-Z0-9_\.]+)\s*;", RegexOptions.Multiline);
            var packageName = packageMatch.Success ? packageMatch.Groups[1].Value : null;

            // Extract messages and their fields for sample payload generation
            var messages = ExtractMessages(protoContent);

            // Extract services
            var serviceRegex = new Regex(@"service\s+([a-zA-Z0-9_]+)\s*\{([^}]+)\}", RegexOptions.Multiline | RegexOptions.Singleline);
            var serviceMatches = serviceRegex.Matches(protoContent);

            foreach (Match sMatch in serviceMatches)
            {
                var serviceName = sMatch.Groups[1].Value;
                var serviceBody = sMatch.Groups[2].Value;
                var fullServiceName = !string.IsNullOrEmpty(packageName) ? $"{packageName}.{serviceName}" : serviceName;

                var serviceInfo = new GrpcServiceInfo
                {
                    ServiceName = fullServiceName,
                    PackageName = packageName,
                    Methods = new List<GrpcMethodInfo>()
                };

                // Extract RPC methods
                // rpc MethodName ( [stream] InputType ) returns ( [stream] OutputType )
                var rpcRegex = new Regex(@"rpc\s+([a-zA-Z0-9_]+)\s*\(\s*(stream\s+)?([a-zA-Z0-9_\.]+)\s*\)\s*returns\s*\(\s*(stream\s+)?([a-zA-Z0-9_\.]+)\s*\)", RegexOptions.Multiline);
                var rpcMatches = rpcRegex.Matches(serviceBody);

                foreach (Match rpcMatch in rpcMatches)
                {
                    var methodName = rpcMatch.Groups[1].Value;
                    var isClientStream = !string.IsNullOrEmpty(rpcMatch.Groups[2].Value);
                    var inputType = rpcMatch.Groups[3].Value;
                    var isServerStream = !string.IsNullOrEmpty(rpcMatch.Groups[4].Value);
                    var outputType = rpcMatch.Groups[5].Value;

                    string callType = "Unary";
                    if (isClientStream && isServerStream) callType = "BidirectionalStreaming";
                    else if (isServerStream) callType = "ServerStreaming";
                    else if (isClientStream) callType = "ClientStreaming";

                    // Generate sample JSON payload
                    var sampleJson = GenerateSampleJson(inputType, messages);

                    serviceInfo.Methods.Add(new GrpcMethodInfo
                    {
                        MethodName = methodName,
                        FullPath = $"/{fullServiceName}/{methodName}",
                        CallType = callType,
                        InputType = inputType,
                        OutputType = outputType,
                        SamplePayloadJson = sampleJson
                    });
                }

                if (serviceInfo.Methods.Count > 0)
                {
                    services.Add(serviceInfo);
                }
            }

            if (services.Count == 0)
            {
                return new GrpcProtoParseResponse
                {
                    Success = false,
                    ErrorMessage = "No gRPC services found in the provided .proto definition."
                };
            }

            return new GrpcProtoParseResponse
            {
                Success = true,
                Services = services
            };
        }
        catch (Exception ex)
        {
            return new GrpcProtoParseResponse
            {
                Success = false,
                ErrorMessage = $"Failed to parse .proto definition: {ex.Message}"
            };
        }
    }

    private Dictionary<string, List<(string fieldType, string fieldName)>> ExtractMessages(string protoContent)
    {
        var messages = new Dictionary<string, List<(string, string)>>(StringComparer.OrdinalIgnoreCase);

        var msgRegex = new Regex(@"message\s+([a-zA-Z0-9_]+)\s*\{([^}]+)\}", RegexOptions.Multiline | RegexOptions.Singleline);
        var msgMatches = msgRegex.Matches(protoContent);

        foreach (Match mMatch in msgMatches)
        {
            var msgName = mMatch.Groups[1].Value;
            var msgBody = mMatch.Groups[2].Value;
            var fields = new List<(string, string)>();

            // field: [optional/repeated] type name = number;
            var fieldRegex = new Regex(@"^\s*(?:optional\s+|repeated\s+)?([a-zA-Z0-9_\.]+)\s+([a-zA-Z0-9_]+)\s*=\s*\d+\s*;", RegexOptions.Multiline);
            foreach (Match fMatch in fieldRegex.Matches(msgBody))
            {
                var fType = fMatch.Groups[1].Value;
                var fName = fMatch.Groups[2].Value;
                fields.Add((fType, fName));
            }

            messages[msgName] = fields;
        }

        return messages;
    }

    private string GenerateSampleJson(string typeName, Dictionary<string, List<(string fieldType, string fieldName)>> messages)
    {
        var shortName = typeName.Contains('.') ? typeName.Substring(typeName.LastIndexOf('.') + 1) : typeName;
        if (messages.TryGetValue(shortName, out var fields) && fields.Count > 0)
        {
            var lines = new List<string>();
            foreach (var (fType, fName) in fields)
            {
                string val = fType.ToLowerInvariant() switch
                {
                    "string" => "\"example_value\"",
                    "int32" or "int64" or "uint32" or "uint64" or "sint32" or "sint64" => "0",
                    "float" or "double" => "0.0",
                    "bool" => "true",
                    "bytes" => "\"dGVzdA==\"",
                    _ => "{}"
                };
                lines.Add($"  \"{fName}\": {val}");
            }
            return "{\n" + string.Join(",\n", lines) + "\n}";
        }

        return "{}";
    }
}
