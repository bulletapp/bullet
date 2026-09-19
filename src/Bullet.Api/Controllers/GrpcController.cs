using Bullet.Execution.Grpc;
using Bullet.Execution.Models;
using Microsoft.AspNetCore.Mvc;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/grpc")]
public class GrpcController : ControllerBase
{
    private readonly IGrpcReflectionService _reflectionService;
    private readonly IProtoParserService _protoParser;

    public GrpcController(
        IGrpcReflectionService reflectionService,
        IProtoParserService protoParser)
    {
        _reflectionService = reflectionService;
        _protoParser = protoParser;
    }

    [HttpPost("reflect")]
    public async Task<IActionResult> ReflectServer([FromBody] GrpcReflectRequest request, CancellationToken cancellationToken)
    {
        var response = await _reflectionService.ReflectServerAsync(request, cancellationToken);
        if (!response.Success)
        {
            return BadRequest(response);
        }

        return Ok(response);
    }

    [HttpPost("parse-proto")]
    public IActionResult ParseProto([FromBody] GrpcProtoParseRequest request)
    {
        var response = _protoParser.ParseProto(request.ProtoContent);
        if (!response.Success)
        {
            return BadRequest(response);
        }

        return Ok(response);
    }
}
