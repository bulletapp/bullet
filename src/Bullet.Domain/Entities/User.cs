using Bullet.Domain.Enums;

namespace Bullet.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<RangeMember> Memberships { get; set; } = new();
}

public class RangeMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public MemberRole Role { get; set; } = MemberRole.Engineer;
    public DateTime JoinedAtUtc { get; set; } = DateTime.UtcNow;
}
