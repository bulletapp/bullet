namespace Bullet.Domain.Enums;

public enum MemberRole
{
    Viewer = 0,
    Engineer = 1,
    Admin = 2,
    Owner = 3
}

public enum RoundType
{
    String,
    Number,
    Boolean,
    Json
}

public enum ArmorType
{
    Inherit,
    None,
    Basic,
    Bearer,
    ApiKey,
    OAuth2,
    AwsSigV4,
    Custom
}

public enum PayloadType
{
    None,
    Json,
    Xml,
    PlainText,
    FormUrlEncoded,
    Multipart,
    Binary,
    GraphQL
}

public enum ParameterType
{
    Query,
    Path
}

public enum FiringRunStatus
{
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled
}
