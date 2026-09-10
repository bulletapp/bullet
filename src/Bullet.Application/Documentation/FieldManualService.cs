using System.Text;
using Bullet.Domain.Entities;

namespace Bullet.Application.Documentation;

public class FieldManualDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<FieldManualSectionDto> Sections { get; set; } = new();
}

public class FieldManualSectionDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<FieldManualEndpointDto> Endpoints { get; set; } = new();
}

public class FieldManualEndpointDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public string ArmorType { get; set; } = "None";
    public List<FieldManualParamDto> Parameters { get; set; } = new();
    public List<FieldManualHeaderDto> Headers { get; set; } = new();
    public string? RequestPayloadExample { get; set; }
}

public class FieldManualParamDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Type { get; set; } = "Query";
    public string? Description { get; set; }
}

public class FieldManualHeaderDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public interface IFieldManualService
{
    FieldManualDto GenerateFieldManual(Arsenal arsenal);
    string GenerateMarkdown(Arsenal arsenal);
}

public class FieldManualService : IFieldManualService
{
    public FieldManualDto GenerateFieldManual(Arsenal arsenal)
    {
        var manual = new FieldManualDto
        {
            Title = arsenal.Name,
            Description = arsenal.Description,
            Tags = arsenal.Tags
        };

        if (arsenal.Shots.Count > 0)
        {
            manual.Sections.Add(new FieldManualSectionDto
            {
                Name = "General",
                Endpoints = arsenal.Shots.Select(MapEndpoint).ToList()
            });
        }

        foreach (var squad in arsenal.Squads)
        {
            manual.Sections.Add(new FieldManualSectionDto
            {
                Name = squad.Name,
                Description = squad.Description,
                Endpoints = squad.Shots.Select(MapEndpoint).ToList()
            });
        }

        return manual;
    }

    private static FieldManualEndpointDto MapEndpoint(Shot shot) => new()
    {
        Id = shot.Id,
        Name = shot.Name,
        Description = shot.Description,
        Method = shot.Method,
        Url = shot.Url,
        ArmorType = shot.Armor.Type.ToString(),
        Parameters = shot.Parameters.Where(p => p.Enabled).Select(p => new FieldManualParamDto
        {
            Key = p.Key,
            Value = p.Value,
            Type = p.Type.ToString(),
            Description = p.Description
        }).ToList(),
        Headers = shot.Headers.Where(h => h.Enabled).Select(h => new FieldManualHeaderDto
        {
            Key = h.Key,
            Value = h.Value,
            Description = h.Description
        }).ToList(),
        RequestPayloadExample = shot.Payload.RawContent
    };

    public string GenerateMarkdown(Arsenal arsenal)
    {
        var manual = GenerateFieldManual(arsenal);
        var sb = new StringBuilder();
        sb.AppendLine($"# {manual.Title}");
        if (!string.IsNullOrEmpty(manual.Description))
            sb.AppendLine($"\n{manual.Description}\n");

        foreach (var section in manual.Sections)
        {
            sb.AppendLine($"## {section.Name}\n");
            foreach (var ep in section.Endpoints)
            {
                sb.AppendLine($"### `{ep.Method}` {ep.Url}");
                sb.AppendLine($"**{ep.Name}**");
                if (!string.IsNullOrEmpty(ep.Description))
                    sb.AppendLine($"\n{ep.Description}");

                if (ep.Headers.Count > 0)
                {
                    sb.AppendLine("\n**Headers:**\n");
                    sb.AppendLine("| Header | Example |");
                    sb.AppendLine("|---|---|");
                    foreach (var h in ep.Headers)
                        sb.AppendLine($"| `{h.Key}` | `{h.Value}` |");
                }

                if (!string.IsNullOrEmpty(ep.RequestPayloadExample))
                {
                    sb.AppendLine("\n**Payload:**\n");
                    sb.AppendLine("```json");
                    sb.AppendLine(ep.RequestPayloadExample);
                    sb.AppendLine("```");
                }

                sb.AppendLine("\n---\n");
            }
        }

        return sb.ToString();
    }
}
