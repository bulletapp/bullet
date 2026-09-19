namespace Bullet.Execution.Models;

public class GrpcImpactDetails
{
    public int StatusCode { get; set; } = 0;
    public string StatusText { get; set; } = "OK";
    public string? StatusMessage { get; set; }
    public string Service { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public Dictionary<string, string> InitialMetadata { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> Trailers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public bool IsStreaming { get; set; }
    public List<string> StreamMessages { get; set; } = new();
}

public class GrpcServiceInfo
{
    public string ServiceName { get; set; } = string.Empty;
    public string? PackageName { get; set; }
    public List<GrpcMethodInfo> Methods { get; set; } = new();
}

public class GrpcMethodInfo
{
    public string MethodName { get; set; } = string.Empty;
    public string FullPath { get; set; } = string.Empty; // e.g. "/package.Service/Method"
    public string CallType { get; set; } = "Unary"; // Unary, ServerStreaming, ClientStreaming, BidirectionalStreaming
    public string InputType { get; set; } = string.Empty;
    public string OutputType { get; set; } = string.Empty;
    public string SamplePayloadJson { get; set; } = "{}";
}

public class GrpcReflectRequest
{
    public string ServerUrl { get; set; } = string.Empty;
    public bool UseTls { get; set; } = false;
    public Dictionary<string, string>? Headers { get; set; }
}

public class GrpcReflectResponse
{
    public bool Success { get; set; }
    public List<GrpcServiceInfo> Services { get; set; } = new();
    public string? ErrorMessage { get; set; }
}

public class GrpcProtoParseRequest
{
    public string ProtoContent { get; set; } = string.Empty;
    public string? FileName { get; set; }
}

public class GrpcProtoParseResponse
{
    public bool Success { get; set; }
    public List<GrpcServiceInfo> Services { get; set; } = new();
    public string? ErrorMessage { get; set; }
}
