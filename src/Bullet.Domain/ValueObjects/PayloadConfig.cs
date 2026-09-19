using Bullet.Domain.Enums;

namespace Bullet.Domain.ValueObjects;

public class PayloadConfig
{
    public PayloadType Type { get; set; } = PayloadType.None;
    public string? RawContent { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("rawText")]
    public string? RawText
    {
        get => RawContent;
        set => RawContent = value;
    }
    public List<FormDataItem> FormData { get; set; } = new();
    public List<MultipartItem> MultipartData { get; set; } = new();
    public string? GraphQLQuery { get; set; }
    public string? GraphQLVariables { get; set; }
}

public class FormDataItem
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public string? Description { get; set; }
}

public class MultipartItem
{
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public string? FileName { get; set; }
    public string? ContentType { get; set; }
    public byte[]? BinaryContent { get; set; }
    public bool IsFile { get; set; }
    public bool Enabled { get; set; } = true;
    public string? Description { get; set; }
}
