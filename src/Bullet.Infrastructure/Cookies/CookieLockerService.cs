using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Infrastructure.Cookies;

public interface ICookieLocker
{
    Task<List<CookieRecord>> GetCookiesAsync(Guid rangeId, string? domain = null);
    Task StoreCookieAsync(Guid rangeId, string domain, string name, string value, string? path = "/", DateTime? expires = null, bool secure = false, bool httpOnly = false, string sameSite = "Lax");
    Task DeleteCookieAsync(Guid cookieId);
    Task ClearRangeCookiesAsync(Guid rangeId);
}

public class CookieLockerService : ICookieLocker
{
    private readonly BulletDbContext _db;

    public CookieLockerService(BulletDbContext db)
    {
        _db = db;
    }

    public async Task<List<CookieRecord>> GetCookiesAsync(Guid rangeId, string? domain = null)
    {
        var query = _db.Cookies.Where(c => c.RangeId == rangeId);
        if (!string.IsNullOrWhiteSpace(domain))
        {
            query = query.Where(c => c.Domain.Contains(domain));
        }
        return await query.OrderBy(c => c.Domain).ThenBy(c => c.Name).ToListAsync();
    }

    public async Task StoreCookieAsync(Guid rangeId, string domain, string name, string value, string? path = "/", DateTime? expires = null, bool secure = false, bool httpOnly = false, string sameSite = "Lax")
    {
        var existing = await _db.Cookies.FirstOrDefaultAsync(c => c.RangeId == rangeId && c.Domain == domain && c.Name == name);
        if (existing != null)
        {
            existing.Value = value;
            existing.Path = path ?? "/";
            existing.ExpiresUtc = expires;
            existing.IsSecure = secure;
            existing.IsHttpOnly = httpOnly;
            existing.SameSite = sameSite;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {
            _db.Cookies.Add(new CookieRecord
            {
                RangeId = rangeId,
                Domain = domain,
                Name = name,
                Value = value,
                Path = path ?? "/",
                ExpiresUtc = expires,
                IsSecure = secure,
                IsHttpOnly = httpOnly,
                SameSite = sameSite,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
    }

    public async Task DeleteCookieAsync(Guid cookieId)
    {
        var cookie = await _db.Cookies.FindAsync(cookieId);
        if (cookie != null)
        {
            _db.Cookies.Remove(cookie);
            await _db.SaveChangesAsync();
        }
    }

    public async Task ClearRangeCookiesAsync(Guid rangeId)
    {
        var cookies = await _db.Cookies.Where(c => c.RangeId == rangeId).ToListAsync();
        _db.Cookies.RemoveRange(cookies);
        await _db.SaveChangesAsync();
    }
}
